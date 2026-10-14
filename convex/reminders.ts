import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { chat, llmConfigFromEnv } from "./model/llm";
import { buildReminderMessages, cleanReminder } from "./model/reminders";

export const context = internalQuery({
  args: { customerId: v.id("customers"), userId: v.id("users") },
  handler: async (ctx, { customerId, userId }) => {
    const customer = await ctx.db.get("customers", customerId);
    if (!customer || customer.userId !== userId) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    // The index also holds drafts, so look at a few extra and keep confirmed.
    const entries = await ctx.db
      .query("entries")
      .withIndex("by_customerId_and_status_and_occurredOn", (q) =>
        q.eq("customerId", customerId).eq("status", "confirmed"),
      )
      .order("desc")
      .take(3);
    const recent = entries.map((e) => ({
        occurredOn: e.occurredOn,
        items: e.items.map((i) => i.name),
        balance: e.balance,
      }));
    return {
      customerName: customer.name,
      balance: customer.balance,
      phone: customer.phone ?? null,
      language: profile?.language ?? ("en" as const),
      businessName: profile?.businessName ?? null,
      recent,
    };
  },
});

export const draft = action({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }): Promise<{ message: string; phone: string | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Please sign in first.");
    const info = await ctx.runQuery(internal.reminders.context, { customerId, userId });
    if (!info) throw new ConvexError("Customer not found.");
    if (info.balance <= 0) throw new ConvexError("This customer does not owe you anything.");
    const { content } = await chat(llmConfigFromEnv(), buildReminderMessages(info), {
      maxTokens: 300,
    });
    const message = cleanReminder(content);
    // An empty reply would leave the editor blank, so fail and let the trader retry.
    if (!message) throw new ConvexError("We could not write the message just now. Please try again.");
    return { message, phone: info.phone };
  },
});
