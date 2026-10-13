import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Language } from "./languages";

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Please sign in first.");
  return userId;
}

export async function getProfile(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function ensureProfile(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await getProfile(ctx, userId);
  if (existing) return existing;
  const id = await ctx.db.insert("profiles", { userId, language: "en", owedToYou: 0 });
  return (await ctx.db.get("profiles", id))!;
}

export async function getLanguage(ctx: QueryCtx, userId: Id<"users">): Promise<Language> {
  return (await getProfile(ctx, userId))?.language ?? "en";
}

export async function getOwnedEntry(
  ctx: QueryCtx,
  userId: Id<"users">,
  entryId: Id<"entries">,
): Promise<Doc<"entries">> {
  const entry = await ctx.db.get("entries", entryId);
  if (!entry || entry.userId !== userId) throw new ConvexError("Entry not found.");
  return entry;
}

export async function getOwnedCustomer(
  ctx: QueryCtx,
  userId: Id<"users">,
  customerId: Id<"customers">,
): Promise<Doc<"customers">> {
  const customer = await ctx.db.get("customers", customerId);
  if (!customer || customer.userId !== userId) throw new ConvexError("Customer not found.");
  return customer;
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function findCustomerByName(ctx: QueryCtx, userId: Id<"users">, name: string) {
  return await ctx.db
    .query("customers")
    .withIndex("by_userId_and_nameLower", (q) =>
      q.eq("userId", userId).eq("nameLower", normalizeName(name).toLowerCase()),
    )
    .first();
}

export async function findOrCreateCustomer(ctx: MutationCtx, userId: Id<"users">, name: string) {
  const existing = await findCustomerByName(ctx, userId, name);
  if (existing) return existing._id;
  const clean = normalizeName(name);
  return await ctx.db.insert("customers", {
    userId,
    name: clean,
    nameLower: clean.toLowerCase(),
    balance: 0,
  });
}

/** Names passed to the model so it can reuse existing spellings. */
export async function customerNames(ctx: QueryCtx, userId: Id<"users">, limit = 200) {
  const customers = await ctx.db
    .query("customers")
    .withIndex("by_userId_and_nameLower", (q) => q.eq("userId", userId))
    .take(limit);
  return customers.map((c) => c.name);
}

/** How much an entry changes what a customer owes. */
export function debtDelta(entry: Pick<Doc<"entries">, "type" | "balance" | "paid">): number {
  if (entry.type === "sale") return entry.balance ?? 0;
  if (entry.type === "payment_received") return -(entry.paid ?? 0);
  return 0;
}

async function bumpDailyTotals(
  ctx: MutationCtx,
  entry: Doc<"entries">,
  sign: 1 | -1,
) {
  const total = entry.total ?? 0;
  const paid = entry.paid ?? 0;
  const delta = {
    sales: entry.type === "sale" ? total : 0,
    cashIn: entry.type === "sale" || entry.type === "payment_received" ? paid : 0,
    expenses: entry.type === "expense" ? total : 0,
    stock: entry.type === "stock_purchase" ? total : 0,
  };
  const row = await ctx.db
    .query("dailyTotals")
    .withIndex("by_userId_and_date", (q) =>
      q.eq("userId", entry.userId).eq("date", entry.occurredOn),
    )
    .unique();
  if (row) {
    await ctx.db.patch("dailyTotals", row._id, {
      sales: row.sales + sign * delta.sales,
      cashIn: row.cashIn + sign * delta.cashIn,
      expenses: row.expenses + sign * delta.expenses,
      stock: row.stock + sign * delta.stock,
      count: row.count + sign,
    });
  } else if (sign === 1) {
    await ctx.db.insert("dailyTotals", {
      userId: entry.userId,
      date: entry.occurredOn,
      ...delta,
      count: 1,
    });
  }
}

async function bumpCustomerBalance(ctx: MutationCtx, entry: Doc<"entries">, sign: 1 | -1) {
  if (!entry.customerId) return;
  const delta = sign * debtDelta(entry);
  if (delta === 0) return;
  const customer = await ctx.db.get("customers", entry.customerId);
  if (!customer) return;
  const before = customer.balance;
  const after = before + delta;
  await ctx.db.patch("customers", customer._id, { balance: after });

  // "Owed to you" counts only money customers owe, not credit they hold.
  const owedDelta = Math.max(after, 0) - Math.max(before, 0);
  if (owedDelta !== 0) {
    const profile = await ensureProfile(ctx, entry.userId);
    await ctx.db.patch("profiles", profile._id, { owedToYou: profile.owedToYou + owedDelta });
  }
}

/** Apply a confirmed entry to the running totals (sign 1) or undo it (-1). */
export async function applyEntry(ctx: MutationCtx, entry: Doc<"entries">, sign: 1 | -1) {
  await bumpDailyTotals(ctx, entry, sign);
  await bumpCustomerBalance(ctx, entry, sign);
}

export async function confirmEntry(ctx: MutationCtx, entry: Doc<"entries">) {
  if (entry.status === "confirmed") return;
  if (entry.total === null || entry.paid === null) {
    throw new ConvexError("Add the total and the amount paid before saving.");
  }
  let customerId = entry.customerId;
  if (!customerId && entry.customerName) {
    customerId = await findOrCreateCustomer(ctx, entry.userId, entry.customerName);
  }
  const balance = entry.type === "payment_received" ? 0 : entry.total - entry.paid;
  await ctx.db.patch("entries", entry._id, { status: "confirmed", customerId, balance });
  const confirmed = (await ctx.db.get("entries", entry._id))!;
  await applyEntry(ctx, confirmed, 1);
}
