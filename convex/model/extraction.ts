// Turns what a trader said into a ledger entry. The model only reads and
// structures; arithmetic and sanity checks happen here in plain code so a
// wrong guess is caught before it reaches the books.
import { z } from "zod";
import { chat, parseJsonReply, type LlmConfig } from "./llm";
import { LANGUAGES, type Language } from "./languages";
import { extractSpokenNumbers, isGrounded } from "./numbers";

export const ENTRY_TYPES = ["sale", "expense", "payment_received", "stock_purchase"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

/** What the model must return. Unknown values are null, never guessed. */
export const modelOutputSchema = z.object({
  type: z.enum(ENTRY_TYPES),
  daysAgo: z.number().int().min(0).max(60),
  customerName: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.number().nullable(),
      amount: z.number().nullable(),
    }),
  ),
  total: z.number().nullable(),
  paid: z.number().nullable(),
  note: z.string().nullable(),
});
export type ModelOutput = z.infer<typeof modelOutputSchema>;

// Hand written rather than generated so it stays inside the subset of JSON
// Schema that Ollama's structured output accepts.
const nullableNumber = { type: ["number", "null"] };
const nullableString = { type: ["string", "null"] };
export const modelOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type", "daysAgo", "customerName", "items", "total", "paid", "note"],
  properties: {
    type: { type: "string", enum: [...ENTRY_TYPES] },
    daysAgo: { type: "integer", minimum: 0, maximum: 60 },
    customerName: nullableString,
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "qty", "amount"],
        properties: { name: { type: "string" }, qty: nullableNumber, amount: nullableNumber },
      },
    },
    total: nullableNumber,
    paid: nullableNumber,
    note: nullableString,
  },
};

export type Flag = { field: string; code: string; message: string };

export type ExtractedEntry = {
  type: EntryType;
  occurredOn: string;
  customerName: string | null;
  items: { name: string; qty: number | null; amount: number | null }[];
  total: number | null;
  paid: number | null;
  balance: number | null;
  note: string | null;
  flags: Flag[];
};

const SYSTEM_PROMPT = `You keep the sales and debt book for a small trader in Nigeria.
The trader speaks one short sentence about something that happened in their business. Turn it into one ledger entry.

Entry types:
- sale: the trader sold goods or a service to someone.
- payment_received: a customer paid money they already owed. No goods change hands.
- expense: the trader spent money running the business (transport, rent, NEPA bill, data, food for shop boy).
- stock_purchase: the trader bought goods to resell.

Rules:
- Amounts are in naira. Write them as plain numbers: "forty five thousand" is 45000, "45k" is 45000, "two k" is 2000, "five hundred naira" is 500, "1.5m" is 1500000.
- Traders often drop "thousand" from a second figure: "sold for forty five thousand, she paid thirty five" means paid 35000.
- total is the full value of the sale or purchase. paid is what was handed over now.
- If the trader says nothing about credit, debt or balance, the sale was paid in full: paid equals total.
- If the trader mentions credit or a balance but not how much was paid, paid is null.
- For payment_received, total and paid are both the amount paid, and items is empty.
- item amount is the line total for that item, not the unit price. If a unit price is given ("12k each"), multiply by qty.
- Never invent a number. If an amount was not said, use null.
- customerName is the person sold to, paid by, or bought from. If the name matches one of the trader's existing customers, return the existing spelling exactly. Keep titles like Mama, Iya, Alhaji, Oga. Use null if no person is mentioned.
- daysAgo is 0 for today, 1 for yesterday, and so on. If no day is mentioned, use 0.
- note captures a promise or detail worth remembering in a few words, like "will pay balance tomorrow". Otherwise null.
- The trader may speak English, Nigerian Pidgin, Yoruba, Hausa or Igbo, or mix them. Item names stay in plain English where obvious (rice, garri, palm oil).`;

type Example = { say: string; customers: string[]; out: ModelOutput };

const EXAMPLES: Example[] = [
  {
    say: "I sold three bags of rice to Mama Ngozi for forty five thousand, she paid thirty five, she go balance me tomorrow.",
    customers: ["Mama Ngozi", "Emeka"],
    out: {
      type: "sale",
      daysAgo: 0,
      customerName: "Mama Ngozi",
      items: [{ name: "rice", qty: 3, amount: 45000 }],
      total: 45000,
      paid: 35000,
      note: "will pay balance tomorrow",
    },
  },
  {
    say: "Yesterday Emeka pay me ten thousand for the money wey him dey owe.",
    customers: ["Mama Ngozi", "Emeka"],
    out: {
      type: "payment_received",
      daysAgo: 1,
      customerName: "Emeka",
      items: [],
      total: 10000,
      paid: 10000,
      note: null,
    },
  },
  {
    say: "I buy two carton of indomie 12k each and one gallon of groundnut oil for 8,500 from Alhaji Musa",
    customers: [],
    out: {
      type: "stock_purchase",
      daysAgo: 0,
      customerName: "Alhaji Musa",
      items: [
        { name: "indomie (carton)", qty: 2, amount: 24000 },
        { name: "groundnut oil (gallon)", qty: 1, amount: 8500 },
      ],
      total: 32500,
      paid: 32500,
      note: null,
    },
  },
  {
    say: "Transport to Balogun market today na two thousand five hundred.",
    customers: [],
    out: {
      type: "expense",
      daysAgo: 0,
      customerName: null,
      items: [{ name: "transport to Balogun market", qty: null, amount: 2500 }],
      total: 2500,
      paid: 2500,
      note: null,
    },
  },
  {
    say: "Iya Bisi collect two crates of eggs on credit, she never pay anything.",
    customers: ["Iya Bisi"],
    out: {
      type: "sale",
      daysAgo: 0,
      customerName: "Iya Bisi",
      items: [{ name: "eggs (crate)", qty: 2, amount: null }],
      total: null,
      paid: 0,
      note: "took on credit",
    },
  },
];

function userTurn(say: string, customers: string[], language: Language, today: string) {
  const known = customers.length ? customers.join(", ") : "none yet";
  return `Today is ${today}. Usual language: ${LANGUAGES[language].promptName}.
Existing customers: ${known}
Trader said: "${say}"`;
}

export function buildMessages(input: {
  transcript: string;
  customers: string[];
  language: Language;
  today: string;
}) {
  const shots = EXAMPLES.flatMap((ex) => [
    { role: "user" as const, content: userTurn(ex.say, ex.customers, "en", "2026-10-13") },
    { role: "assistant" as const, content: JSON.stringify(ex.out) },
  ]);
  return [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...shots,
    {
      role: "user" as const,
      content: userTurn(input.transcript, input.customers, input.language, input.today),
    },
  ];
}

function shiftDate(isoDate: string, daysBack: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/** Match a heard name to an existing customer, ignoring case and spacing. */
export function matchCustomer(name: string | null, customers: string[]): string | null {
  if (!name) return null;
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return customers.find((c) => c.toLowerCase().replace(/\s+/g, " ") === key) ?? name.trim();
}

/**
 * Deterministic checks after the model. Fills in only what arithmetic
 * proves, and flags everything else for the trader to look at.
 */
export function postProcess(
  raw: ModelOutput,
  ctx: { transcript: string; today: string; customers: string[] },
): ExtractedEntry {
  const flags: Flag[] = [];
  const items = raw.items.map((i) => ({ ...i, name: i.name.trim() }));
  let total = raw.total;
  let paid = raw.paid;

  if (raw.type === "payment_received") {
    // One amount, two fields. Copying it across is not inventing.
    total = total ?? paid;
    paid = paid ?? total;
  }

  const itemAmounts = items.map((i) => i.amount);
  const allItemsPriced = items.length > 0 && itemAmounts.every((a) => a !== null);
  const itemSum = allItemsPriced ? itemAmounts.reduce<number>((s, a) => s + (a ?? 0), 0) : null;

  if (total === null && itemSum !== null) total = itemSum;

  // Every amount must trace back to something the trader actually said.
  const heard = extractSpokenNumbers(ctx.transcript);
  const groundedItems = itemAmounts.filter(
    (a): a is number => a !== null && isGrounded(a, heard),
  );
  items.forEach((item, idx) => {
    if (item.amount !== null && !isGrounded(item.amount, heard)) {
      flags.push({
        field: `items.${idx}.amount`,
        code: "amount_not_heard",
        message: `I did not hear ${item.amount} for ${item.name}. Please check.`,
      });
    }
  });
  if (total !== null && !isGrounded(total, heard, groundedItems)) {
    flags.push({ field: "total", code: "amount_not_heard", message: "Check the total. I may have misheard it." });
  }
  if (paid !== null && paid !== 0 && paid !== total && !isGrounded(paid, heard, total !== null ? [total] : [])) {
    flags.push({ field: "paid", code: "amount_not_heard", message: "Check how much was paid." });
  }

  const customerName = matchCustomer(raw.customerName, ctx.customers);
  const checked = structuralChecks({ type: raw.type, items, total, paid, customerName });
  flags.push(...checked.flags);
  const balance = checked.balance;

  return {
    type: raw.type,
    occurredOn: shiftDate(ctx.today, raw.daysAgo),
    customerName,
    items,
    total,
    paid,
    balance,
    note: raw.note,
    flags,
  };
}

/**
 * Checks that depend only on the entry itself. Run after extraction and
 * again whenever the trader edits a draft.
 */
export function structuralChecks(entry: {
  type: EntryType;
  items: { name: string; amount: number | null }[];
  total: number | null;
  paid: number | null;
  customerName: string | null;
}): { balance: number | null; flags: Flag[] } {
  const { type, items, total, paid, customerName } = entry;
  const flags: Flag[] = [];

  if (total === null) {
    flags.push({ field: "total", code: "missing", message: "How much was it in total?" });
  }
  if (paid === null) {
    flags.push({ field: "paid", code: "missing", message: "How much was paid now?" });
  }

  const priced = items.length > 0 && items.every((i) => i.amount !== null);
  const itemSum = priced ? items.reduce((s, i) => s + (i.amount ?? 0), 0) : null;
  if (itemSum !== null && total !== null && itemSum !== total) {
    flags.push({
      field: "items",
      code: "items_mismatch",
      message: `Items add up to ${itemSum} but the total is ${total}.`,
    });
  }

  let balance: number | null = total !== null && paid !== null ? total - paid : null;
  if (type === "payment_received") balance = 0;
  if (balance !== null && balance < 0) {
    flags.push({ field: "paid", code: "overpaid", message: "Paid is more than the total." });
  }

  const owesSomething = type === "sale" && (balance === null || balance > 0) && paid !== total;
  if (owesSomething && !customerName) {
    flags.push({
      field: "customerName",
      code: "credit_without_customer",
      message: "Who is owing? Add a name so you can collect it.",
    });
  }
  if (type === "payment_received" && !customerName) {
    flags.push({ field: "customerName", code: "missing", message: "Who paid you?" });
  }

  return { balance, flags };
}

export async function extractEntry(
  config: LlmConfig,
  input: { transcript: string; customers: string[]; language: Language; today: string },
): Promise<{ entry: ExtractedEntry; ms: number; raw: ModelOutput }> {
  const messages = buildMessages(input);
  const ask = () =>
    chat(config, messages, { jsonSchema: { name: "ledger_entry", schema: modelOutputJsonSchema } });

  // Without server-side constraints a reply can be malformed; one retry
  // fixes most of those. Validation is the same either way.
  let totalMs = 0;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { content, ms } = await ask();
    totalMs += ms;
    try {
      const raw = modelOutputSchema.parse(parseJsonReply(content));
      return {
        entry: postProcess(raw, {
          transcript: input.transcript,
          today: input.today,
          customers: input.customers,
        }),
        ms: totalMs,
        raw,
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Model reply did not match the schema");
}
