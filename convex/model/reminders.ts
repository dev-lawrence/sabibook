import { LANGUAGES, type Language } from "./languages";
import type { ChatMessage } from "./llm";

export function formatNaira(amount: number): string {
  const rounded = Math.round(amount);
  return `₦${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export type ReminderContext = {
  customerName: string;
  balance: number;
  language: Language;
  businessName: string | null;
  recent: { occurredOn: string; items: string[]; balance: number | null }[];
};

export function buildReminderMessages(c: ReminderContext): ChatMessage[] {
  const lang = LANGUAGES[c.language];
  const system = `You write WhatsApp messages for a small trader in Nigeria who wants to remind a customer about money owed.
Write one short, warm, polite reminder of at most 60 words.
- Write it in ${lang.promptName}.${lang.beta ? " If you are not fully confident in that language, mix it naturally with simple English." : ""}
- Mention the amount owed exactly as ${formatNaira(c.balance)}.
- No threats, no pressure, no guilt. Friendly and respectful.
- Never use em dashes.
- Output only the message text, nothing else.
${c.businessName ? `- Sign off with the business name: ${c.businessName}.` : "- Do not invent a business name."}`;

  const recent = c.recent.length
    ? c.recent
        .map(
          (r) =>
            `- ${r.occurredOn}: ${r.items.length ? r.items.join(", ") : "goods"}${
              r.balance ? ` (left ${formatNaira(r.balance)})` : ""
            }`,
        )
        .join("\n")
    : "none";
  const user = `Customer: ${c.customerName}
Amount owed: ${formatNaira(c.balance)}
Recent purchases:
${recent}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Models sometimes add quotes or dashes despite instructions. */
export function cleanReminder(text: string): string {
  return text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s*[—–]\s*/g, ", ")
    .trim();
}
