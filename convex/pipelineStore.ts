// Database side of the pipeline. Lives apart from pipeline.ts because that
// file runs in the Node runtime, which can only hold actions.
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { entryTypeValidator, itemValidator, flagValidator } from "./schema";
import { customerNames, findCustomerByName } from "./model/ledger";

export const loadContext = internalQuery({
  args: { voiceNoteId: v.id("voiceNotes") },
  handler: async (ctx, { voiceNoteId }) => {
    const note = await ctx.db.get("voiceNotes", voiceNoteId);
    if (!note) return null;
    return { note, customers: await customerNames(ctx, note.userId) };
  },
});

export const markExtracting = internalMutation({
  args: {
    voiceNoteId: v.id("voiceNotes"),
    transcript: v.string(),
    asrMs: v.number(),
    asrModel: v.string(),
  },
  handler: async (ctx, { voiceNoteId, ...fields }) => {
    await ctx.db.patch("voiceNotes", voiceNoteId, { ...fields, status: "extracting" });
  },
});

/** Writes the transcript, timings and the draft entry in one transaction. */
export const saveDraft = internalMutation({
  args: {
    voiceNoteId: v.id("voiceNotes"),
    transcript: v.string(),
    llmMs: v.number(),
    llmModel: v.string(),
    entry: v.object({
      type: entryTypeValidator,
      occurredOn: v.string(),
      customerName: v.union(v.string(), v.null()),
      items: v.array(itemValidator),
      total: v.union(v.number(), v.null()),
      paid: v.union(v.number(), v.null()),
      balance: v.union(v.number(), v.null()),
      note: v.union(v.string(), v.null()),
      flags: v.array(flagValidator),
    }),
  },
  handler: async (ctx, { voiceNoteId, transcript, llmMs, llmModel, entry }) => {
    const note = await ctx.db.get("voiceNotes", voiceNoteId);
    if (!note || note.entryId) return;
    const customer = entry.customerName
      ? await findCustomerByName(ctx, note.userId, entry.customerName)
      : null;
    const entryId = await ctx.db.insert("entries", {
      userId: note.userId,
      type: entry.type,
      occurredOn: entry.occurredOn,
      customerId: customer?._id,
      customerName: customer?.name ?? entry.customerName ?? undefined,
      items: entry.items,
      total: entry.total,
      paid: entry.paid,
      balance: entry.balance,
      currency: "NGN",
      voiceNoteId,
      status: "draft",
      flags: entry.flags,
      note: entry.note ?? undefined,
    });
    await ctx.db.patch("voiceNotes", voiceNoteId, {
      transcript,
      llmMs,
      llmModel,
      entryId,
      status: "ready",
    });
  },
});

export const fail = internalMutation({
  args: { voiceNoteId: v.id("voiceNotes"), error: v.string() },
  handler: async (ctx, { voiceNoteId, error }) => {
    await ctx.db.patch("voiceNotes", voiceNoteId, { status: "failed", error: error.slice(0, 500) });
  },
});
