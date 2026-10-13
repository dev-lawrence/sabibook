import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOwnedEntry, getProfile, requireUserId } from "./model/ledger";

export const create = mutation({
  args: { entryId: v.id("entries") },
  handler: async (ctx, { entryId }) => {
    const userId = await requireUserId(ctx);
    const entry = await getOwnedEntry(ctx, userId, entryId);
    if (entry.status !== "confirmed") throw new ConvexError("Save the entry before sharing a receipt.");
    const existing = await ctx.db
      .query("receipts")
      .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
      .first();
    if (existing) return existing.token;
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    await ctx.db.insert("receipts", { token, entryId, userId });
    return token;
  },
});

/** Public. Anyone with the link can read; nothing internal leaves here. */
export const get = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const receipt = await ctx.db
      .query("receipts")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!receipt) return null;
    const entry = await ctx.db.get("entries", receipt.entryId);
    if (!entry || entry.status !== "confirmed") return null;
    const profile = await getProfile(ctx, receipt.userId);
    return {
      businessName: profile?.businessName ?? null,
      type: entry.type,
      occurredOn: entry.occurredOn,
      customerName: entry.customerName ?? null,
      items: entry.items,
      total: entry.total,
      paid: entry.paid,
      balance: entry.balance,
      currency: entry.currency,
    };
  },
});
