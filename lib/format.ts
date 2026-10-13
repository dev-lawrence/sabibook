// Money and wording helpers shared by every screen.

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/** 45000 -> "₦45,000". Null or NaN shows a hyphen so we never print a wrong number. */
export function formatNaira(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return naira.format(n);
}

export type EntryType = "sale" | "expense" | "payment_received" | "stock_purchase";

export const ENTRY_TYPES: EntryType[] = ["sale", "expense", "payment_received", "stock_purchase"];

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  sale: "Sale",
  expense: "Expense",
  payment_received: "Payment received",
  stock_purchase: "Stock bought",
};

/** Money coming in is green, money going out is plain ink. */
export function isMoneyIn(type: EntryType): boolean {
  return type === "sale" || type === "payment_received";
}

/** "2 x Rice, Beans" style one-liner for lists. */
export function summariseItems(items: { name: string; qty: number | null }[]): string {
  if (items.length === 0) return "";
  const shown = items.slice(0, 2).map((i) => (i.qty && i.qty !== 1 ? `${i.qty} ${i.name}` : i.name));
  const more = items.length - shown.length;
  return shown.join(", ") + (more > 0 ? ` +${more} more` : "");
}

/** Digits only, so "45,000" or "N45000" typed by hand still works. Empty means not known. */
export function parseAmount(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  return Number(digits);
}
