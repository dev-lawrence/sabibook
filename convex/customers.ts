import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { applyEntry, getOwnedCustomer, requireUserId } from "./model/ledger";
import { normalizeNigerianPhone } from "./model/phone";

export const debtors = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("customers")
      .withIndex("by_userId_and_balance", (q) => q.eq("userId", userId).gt("balance", 0))
      .order("desc")
      .take(100);
  },
});

export const get = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const userId = await requireUserId(ctx);
    return await getOwnedCustomer(ctx, userId, customerId);
  },
});

/** For name autocomplete. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("customers")
      .withIndex("by_userId_and_nameLower", (q) => q.eq("userId", userId))
      .take(200);
  },
});

export const setPhone = mutation({
  args: { customerId: v.id("customers"), phone: v.string() },
  handler: async (ctx, { customerId, phone }) => {
    const userId = await requireUserId(ctx);
    const customer = await getOwnedCustomer(ctx, userId, customerId);
    const normalized = normalizeNigerianPhone(phone);
    if (!normalized) throw new ConvexError("That phone number does not look right.");
    await ctx.db.patch("customers", customer._id, { phone: normalized });
    return normalized;
  },
});

/** One tap "they paid me" from the debtor list. */
export const recordPayment = mutation({
  args: { customerId: v.id("customers"), amount: v.number(), occurredOn: v.string() },
  handler: async (ctx, { customerId, amount, occurredOn }) => {
    const userId = await requireUserId(ctx);
    const customer = await getOwnedCustomer(ctx, userId, customerId);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ConvexError("Enter an amount greater than zero.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
      throw new ConvexError("occurredOn must be an ISO date like 2026-10-13.");
    }
    const entryId = await ctx.db.insert("entries", {
      userId,
      type: "payment_received",
      occurredOn,
      customerId: customer._id,
      customerName: customer.name,
      items: [],
      total: amount,
      paid: amount,
      balance: 0,
      currency: "NGN",
      status: "confirmed",
      flags: [],
    });
    const entry = (await ctx.db.get("entries", entryId))!;
    await applyEntry(ctx, entry, 1);
    return entryId;
  },
});
