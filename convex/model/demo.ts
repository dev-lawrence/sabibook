import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { applyEntry, ensureProfile } from "./ledger";

type Item = { name: string; qty: number | null; amount: number | null };

function shiftDate(isoDate: string, daysBack: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

const CUSTOMERS = ["Mama Ngozi", "Emeka", "Iya Bisi", "Alhaji Musa", "Chiamaka"];

type Seed = {
  daysAgo: number;
  type: "sale" | "expense" | "payment_received" | "stock_purchase";
  customer: string | null;
  items: Item[];
  total: number;
  paid: number;
  note?: string;
};

const ENTRIES: Seed[] = [
  { daysAgo: 6, type: "stock_purchase", customer: "Alhaji Musa", items: [{ name: "rice (50kg bag)", qty: 2, amount: 160000 }], total: 160000, paid: 160000 },
  { daysAgo: 6, type: "sale", customer: "Mama Ngozi", items: [{ name: "rice (50kg bag)", qty: 3, amount: 45000 }], total: 45000, paid: 35000, note: "will pay balance tomorrow" },
  { daysAgo: 5, type: "sale", customer: "Emeka", items: [{ name: "indomie (carton)", qty: 2, amount: 24000 }], total: 24000, paid: 10000 },
  { daysAgo: 5, type: "expense", customer: null, items: [{ name: "transport to Balogun market", qty: null, amount: 2500 }], total: 2500, paid: 2500 },
  { daysAgo: 4, type: "sale", customer: "Iya Bisi", items: [{ name: "eggs (crate)", qty: 2, amount: 9000 }], total: 9000, paid: 0, note: "took on credit" },
  { daysAgo: 4, type: "sale", customer: null, items: [{ name: "groundnut oil (gallon)", qty: 2, amount: 17000 }], total: 17000, paid: 17000 },
  { daysAgo: 3, type: "payment_received", customer: "Emeka", items: [], total: 10000, paid: 10000 },
  { daysAgo: 3, type: "sale", customer: "Chiamaka", items: [{ name: "milo (tin)", qty: 3, amount: 7500 }], total: 7500, paid: 4500 },
  { daysAgo: 2, type: "expense", customer: null, items: [{ name: "NEPA bill", qty: null, amount: 8000 }], total: 8000, paid: 8000 },
  { daysAgo: 2, type: "payment_received", customer: "Mama Ngozi", items: [], total: 5000, paid: 5000 },
  { daysAgo: 1, type: "stock_purchase", customer: "Alhaji Musa", items: [{ name: "groundnut oil (gallon)", qty: 4, amount: 34000 }], total: 34000, paid: 34000 },
  { daysAgo: 1, type: "sale", customer: "Mama Ngozi", items: [{ name: "garri (bag)", qty: 2, amount: 28000 }], total: 28000, paid: 10000 },
  { daysAgo: 0, type: "sale", customer: null, items: [{ name: "bread", qty: 4, amount: 4000 }, { name: "sugar (1kg)", qty: 2, amount: 2500 }], total: 6500, paid: 6500 },
];

/** Gives a new guest a believable week of trading. Totals stay consistent via applyEntry. */
export async function seedDemo(ctx: MutationCtx, userId: Id<"users">, today: string) {
  const profile = await ensureProfile(ctx, userId);
  await ctx.db.patch("profiles", profile._id, { businessName: "Mama Tolu Provisions" });

  const ids = new Map<string, Id<"customers">>();
  for (const name of CUSTOMERS) {
    ids.set(
      name,
      await ctx.db.insert("customers", { userId, name, nameLower: name.toLowerCase(), balance: 0 }),
    );
  }

  for (const e of ENTRIES) {
    const entryId = await ctx.db.insert("entries", {
      userId,
      type: e.type,
      occurredOn: shiftDate(today, e.daysAgo),
      customerId: e.customer ? ids.get(e.customer) : undefined,
      customerName: e.customer ?? undefined,
      items: e.items,
      total: e.total,
      paid: e.paid,
      balance: e.type === "payment_received" ? 0 : e.total - e.paid,
      currency: "NGN",
      status: "confirmed",
      flags: [],
      note: e.note,
    });
    const entry = (await ctx.db.get("entries", entryId))!;
    await applyEntry(ctx, entry, 1);
  }
}
