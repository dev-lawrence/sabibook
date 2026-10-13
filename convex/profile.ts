import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { seedDemo } from "./model/demo";
import { ensureProfile, getProfile, requireUserId } from "./model/ledger";
import { languageValidator } from "./schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const [profile, user] = await Promise.all([
      getProfile(ctx, userId),
      ctx.db.get("users", userId),
    ]);
    return {
      language: profile?.language ?? ("en" as const),
      businessName: profile?.businessName ?? null,
      owedToYou: profile?.owedToYou ?? 0,
      isAnonymous: user?.isAnonymous ?? false,
    };
  },
});

/** Call once after sign in. Safe to call repeatedly. */
export const ensure = mutation({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const userId = await requireUserId(ctx);
    if (!ISO_DATE.test(today)) throw new ConvexError("today must be an ISO date like 2026-10-13.");
    await ensureProfile(ctx, userId);
    const user = await ctx.db.get("users", userId);
    if (!user?.isAnonymous) return;
    const anyCustomer = await ctx.db
      .query("customers")
      .withIndex("by_userId_and_nameLower", (q) => q.eq("userId", userId))
      .first();
    if (!anyCustomer) await seedDemo(ctx, userId, today);
  },
});

export const update = mutation({
  args: { language: v.optional(languageValidator), businessName: v.optional(v.string()) },
  handler: async (ctx, { language, businessName }) => {
    const userId = await requireUserId(ctx);
    const profile = await ensureProfile(ctx, userId);
    const patch: { language?: typeof language; businessName?: string } = {};
    if (language !== undefined) patch.language = language;
    if (businessName !== undefined) patch.businessName = businessName.trim().slice(0, 80);
    await ctx.db.patch("profiles", profile._id, patch);
  },
});
