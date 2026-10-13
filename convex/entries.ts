import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { structuralChecks, type Flag } from "./model/extraction";
import {
  applyEntry,
  confirmEntry,
  findCustomerByName,
  getOwnedCustomer,
  getOwnedEntry,
  normalizeName,
  requireUserId,
} from "./model/ledger";
import { entryTypeValidator, itemValidator } from "./schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fieldValue(
  field: string,
  e: Pick<Doc<"entries">, "total" | "paid" | "items">,
): number | null | undefined {
  if (field === "total") return e.total;
  if (field === "paid") return e.paid;
  const m = /^items\.(\d+)\.amount$/.exec(field);
  if (m) return e.items[Number(m[1])]?.amount;
  return undefined;
}

export const get = query({
  args: { entryId: v.id("entries") },
  handler: async (ctx, { entryId }) => {
    const userId = await requireUserId(ctx);
    const { userId: _u, ...entry } = await getOwnedEntry(ctx, userId, entryId);
    const note = entry.voiceNoteId ? await ctx.db.get("voiceNotes", entry.voiceNoteId) : null;
    const receipt = await ctx.db
      .query("receipts")
      .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
      .first();
    return {
      ...entry,
      transcript: note?.transcript ?? null,
      source: note?.source ?? null,
      receiptToken: receipt?.token ?? null,
    };
  },
});

export const updateDraft = mutation({
  args: {
    entryId: v.id("entries"),
    type: entryTypeValidator,
    occurredOn: v.string(),
    customerName: v.union(v.string(), v.null()),
    items: v.array(itemValidator),
    total: v.union(v.number(), v.null()),
    paid: v.union(v.number(), v.null()),
    note: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const entry = await getOwnedEntry(ctx, userId, args.entryId);
    if (entry.status !== "draft") throw new ConvexError("Only unsaved entries can be edited.");
    if (!ISO_DATE.test(args.occurredOn)) throw new ConvexError("Pick a valid date.");

    const name = args.customerName ? normalizeName(args.customerName) : "";
    const match = name ? await findCustomerByName(ctx, userId, name) : null;
    const customerName = name ? (match?.name ?? name) : null;

    const { balance, flags } = structuralChecks({
      type: args.type,
      items: args.items,
      total: args.total,
      paid: args.paid,
      customerName,
    });
    // A "did not hear" warning stays only while the number it points at is untouched.
    const kept: Flag[] = entry.flags.filter(
      (f) =>
        f.code === "amount_not_heard" &&
        fieldValue(f.field, entry) === fieldValue(f.field, args),
    );

    await ctx.db.patch("entries", entry._id, {
      type: args.type,
      occurredOn: args.occurredOn,
      customerId: match?._id,
      customerName: customerName ?? undefined,
      items: args.items,
      total: args.total,
      paid: args.paid,
      balance,
      flags: [...kept, ...flags],
      note: args.note ?? undefined,
    });
  },
});

export const confirm = mutation({
  args: { entryId: v.id("entries") },
  handler: async (ctx, { entryId }) => {
    const userId = await requireUserId(ctx);
    const entry = await getOwnedEntry(ctx, userId, entryId);
    await confirmEntry(ctx, entry);
  },
});

export const discard = mutation({
  args: { entryId: v.id("entries") },
  handler: async (ctx, { entryId }) => {
    const userId = await requireUserId(ctx);
    const entry = await getOwnedEntry(ctx, userId, entryId);
    if (entry.status !== "draft") throw new ConvexError("Saved entries must be removed, not discarded.");
    await ctx.db.delete("entries", entry._id);
  },
});

export const remove = mutation({
  args: { entryId: v.id("entries") },
  handler: async (ctx, { entryId }) => {
    const userId = await requireUserId(ctx);
    const entry = await getOwnedEntry(ctx, userId, entryId);
    if (entry.status !== "confirmed") throw new ConvexError("Use discard for unsaved entries.");
    await applyEntry(ctx, entry, -1);
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
      .take(5);
    for (const r of receipts) await ctx.db.delete("receipts", r._id);
    await ctx.db.delete("entries", entry._id);
  },
});

export const drafts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("entries")
      .withIndex("by_userId_and_status_and_occurredOn", (q) =>
        q.eq("userId", userId).eq("status", "draft"),
      )
      .order("desc")
      .take(10);
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await requireUserId(ctx);
    const n = Math.max(1, Math.min(Math.floor(limit ?? 10), 50));
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_userId_and_status_and_occurredOn", (q) =>
        q.eq("userId", userId).eq("status", "confirmed"),
      )
      .order("desc")
      .take(n);
    return entries.map((e) => ({ ...e, customerName: e.customerName ?? null }));
  },
});

export const ledger = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("entries")
      .withIndex("by_userId_and_status_and_occurredOn", (q) =>
        q.eq("userId", userId).eq("status", "confirmed"),
      )
      .order("desc")
      .paginate(paginationOpts);
  },
});

export const byDateRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("entries")
      .withIndex("by_userId_and_status_and_occurredOn", (q) =>
        q.eq("userId", userId).eq("status", "confirmed").gte("occurredOn", from).lte("occurredOn", to),
      )
      .order("desc")
      .take(500);
  },
});

export const forCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const userId = await requireUserId(ctx);
    await getOwnedCustomer(ctx, userId, customerId);
    return await ctx.db
      .query("entries")
      .withIndex("by_customerId_and_status_and_occurredOn", (q) =>
        q.eq("customerId", customerId).eq("status", "confirmed"),
      )
      .order("desc")
      .take(50);
  },
});
