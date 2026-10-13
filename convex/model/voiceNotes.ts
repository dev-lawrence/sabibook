import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function createVoiceNote(
  ctx: MutationCtx,
  fields: Pick<Doc<"voiceNotes">, "userId" | "source" | "language" | "spokenOn" | "status"> &
    Partial<Pick<Doc<"voiceNotes">, "transcript">>,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.spokenOn)) {
    throw new ConvexError("spokenOn must be an ISO date like 2026-10-13.");
  }
  return await ctx.db.insert("voiceNotes", fields);
}

export async function getOwnedVoiceNote(
  ctx: QueryCtx,
  userId: Id<"users">,
  voiceNoteId: Id<"voiceNotes">,
) {
  const note = await ctx.db.get("voiceNotes", voiceNoteId);
  if (!note || note.userId !== userId) throw new ConvexError("Voice note not found.");
  return note;
}
