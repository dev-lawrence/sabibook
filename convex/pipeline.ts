"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { asrConfigFromEnv, transcribe } from "./model/asr";
import { extractEntry } from "./model/extraction";
import { LANGUAGES } from "./model/languages";
import { llmConfigFromEnv } from "./model/llm";

/** Audio (or typed text) in, draft ledger entry out. */
export const processNote = internalAction({
  args: { voiceNoteId: v.id("voiceNotes") },
  handler: async (ctx, { voiceNoteId }) => {
    const context = await ctx.runQuery(internal.pipelineStore.loadContext, { voiceNoteId });
    if (!context) return;
    const { note, customers } = context;

    try {
      let transcript = note.transcript;

      if (!transcript) {
        if (!note.storageId) throw new Error("No audio was uploaded.");
        const audio = await ctx.storage.get(note.storageId);
        if (!audio) throw new Error("The recording could not be found.");
        const asr = asrConfigFromEnv(note.language);
        // Whisper's prompt nudges spelling toward names the trader already uses.
        const prompt = customers.length
          ? `Naira. Customers: ${customers.slice(0, 40).join(", ")}.`
          : "Naira.";
        const heard = await transcribe(asr, audio, {
          language: LANGUAGES[note.language].asrCode,
          prompt,
        });
        transcript = heard.text;
        if (!transcript) throw new Error("I could not hear anything. Try again a little closer.");
        await ctx.runMutation(internal.pipelineStore.markExtracting, {
          voiceNoteId,
          transcript,
          asrMs: heard.ms,
          asrModel: asr.model,
        });
      }

      const llm = llmConfigFromEnv();
      const { entry, ms } = await extractEntry(llm, {
        transcript,
        customers,
        language: note.language,
        today: note.spokenOn,
      });
      await ctx.runMutation(internal.pipelineStore.saveDraft, {
        voiceNoteId,
        transcript,
        llmMs: ms,
        llmModel: llm.model,
        entry,
      });
    } catch (err) {
      await ctx.runMutation(internal.pipelineStore.fail, {
        voiceNoteId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
});
