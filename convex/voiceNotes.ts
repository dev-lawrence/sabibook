import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireUserId, getLanguage } from "./model/ledger";
import { createVoiceNote, getOwnedVoiceNote } from "./model/voiceNotes";

const isoDate = v.string();

/** Step one of recording: create the note and hand back an upload URL. */
export const begin = mutation({
  args: { spokenOn: isoDate },
  handler: async (ctx, { spokenOn }) => {
    const userId = await requireUserId(ctx);
    const language = await getLanguage(ctx, userId);
    const voiceNoteId = await createVoiceNote(ctx, {
      userId,
      source: "voice",
      language,
      spokenOn,
      status: "uploading",
    });
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { voiceNoteId, uploadUrl };
  },
});

/** Step two: the audio is in storage, start transcribing. */
export const attachAudio = mutation({
  args: {
    voiceNoteId: v.id("voiceNotes"),
    storageId: v.id("_storage"),
    durationMs: v.number(),
  },
  handler: async (ctx, { voiceNoteId, storageId, durationMs }) => {
    const userId = await requireUserId(ctx);
    const note = await getOwnedVoiceNote(ctx, userId, voiceNoteId);
    if (note.status !== "uploading") return;
    await ctx.db.patch("voiceNotes", note._id, { storageId, durationMs, status: "transcribing" });
    await ctx.scheduler.runAfter(0, internal.pipeline.processNote, { voiceNoteId });
  },
});

/** The "type it instead" path. Skips ASR, same extraction. */
export const submitText = mutation({
  args: { text: v.string(), spokenOn: isoDate },
  handler: async (ctx, { text, spokenOn }) => {
    const userId = await requireUserId(ctx);
    const transcript = text.trim().slice(0, 1000);
    if (!transcript) throw new Error("Type what happened first.");
    const language = await getLanguage(ctx, userId);
    const voiceNoteId = await createVoiceNote(ctx, {
      userId,
      source: "text",
      language,
      spokenOn,
      status: "extracting",
      transcript,
    });
    await ctx.scheduler.runAfter(0, internal.pipeline.processNote, { voiceNoteId });
    return voiceNoteId;
  },
});

export const retry = mutation({
  args: { voiceNoteId: v.id("voiceNotes") },
  handler: async (ctx, { voiceNoteId }) => {
    const userId = await requireUserId(ctx);
    const note = await getOwnedVoiceNote(ctx, userId, voiceNoteId);
    if (note.status !== "failed") return;
    const status = note.transcript ? "extracting" : "transcribing";
    await ctx.db.patch("voiceNotes", note._id, { status, error: undefined });
    await ctx.scheduler.runAfter(0, internal.pipeline.processNote, { voiceNoteId });
  },
});

export const get = query({
  args: { voiceNoteId: v.id("voiceNotes") },
  handler: async (ctx, { voiceNoteId }) => {
    const userId = await requireUserId(ctx);
    const note = await getOwnedVoiceNote(ctx, userId, voiceNoteId);
    const { storageId: _s, userId: _u, ...rest } = note;
    return rest;
  },
});

/** Public, anonymous latency numbers for the How it works page. */
export const recentLatency = query({
  args: {},
  handler: async (ctx) => {
    const notes = await ctx.db
      .query("voiceNotes")
      .withIndex("by_status", (q) => q.eq("status", "ready"))
      .order("desc")
      .take(50);
    return notes.map((n) => ({
      source: n.source,
      language: n.language,
      durationMs: n.durationMs ?? null,
      asrMs: n.asrMs ?? null,
      llmMs: n.llmMs ?? null,
      asrModel: n.asrModel ?? null,
      llmModel: n.llmModel ?? null,
      at: n._creationTime,
    }));
  },
});
