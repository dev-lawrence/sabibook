import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const languageValidator = v.union(
  v.literal("en"),
  v.literal("pcm"),
  v.literal("yo"),
  v.literal("ha"),
  v.literal("ig"),
);

export const voiceNoteStatusValidator = v.union(
  v.literal("uploading"),
  v.literal("transcribing"),
  v.literal("extracting"),
  v.literal("ready"),
  v.literal("failed"),
);

export const entryTypeValidator = v.union(
  v.literal("sale"),
  v.literal("expense"),
  v.literal("payment_received"),
  v.literal("stock_purchase"),
);

export const itemValidator = v.object({
  name: v.string(),
  qty: v.union(v.number(), v.null()),
  amount: v.union(v.number(), v.null()),
});

export const flagValidator = v.object({
  field: v.string(),
  code: v.string(),
  message: v.string(),
});

export default defineSchema({
  ...authTables,

  // One row per user. Holds settings plus denormalized running totals so the
  // home screen never has to scan the ledger.
  profiles: defineTable({
    userId: v.id("users"),
    language: languageValidator,
    businessName: v.optional(v.string()),
    owedToYou: v.number(),
  }).index("by_userId", ["userId"]),

  voiceNotes: defineTable({
    userId: v.id("users"),
    source: v.union(v.literal("voice"), v.literal("text")),
    storageId: v.optional(v.id("_storage")),
    language: languageValidator,
    // The trader's local calendar date when they spoke, used to resolve
    // "today" and "yesterday" without trusting server time.
    spokenOn: v.string(),
    status: voiceNoteStatusValidator,
    transcript: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    asrMs: v.optional(v.number()),
    llmMs: v.optional(v.number()),
    asrModel: v.optional(v.string()),
    llmModel: v.optional(v.string()),
    error: v.optional(v.string()),
    entryId: v.optional(v.id("entries")),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  entries: defineTable({
    userId: v.id("users"),
    type: entryTypeValidator,
    occurredOn: v.string(),
    customerId: v.optional(v.id("customers")),
    // What the model heard, kept even when it matches no saved customer.
    customerName: v.optional(v.string()),
    items: v.array(itemValidator),
    total: v.union(v.number(), v.null()),
    paid: v.union(v.number(), v.null()),
    balance: v.union(v.number(), v.null()),
    currency: v.literal("NGN"),
    voiceNoteId: v.optional(v.id("voiceNotes")),
    status: v.union(v.literal("draft"), v.literal("confirmed")),
    flags: v.array(flagValidator),
    note: v.optional(v.string()),
  })
    .index("by_userId_and_status_and_occurredOn", [
      "userId",
      "status",
      "occurredOn",
    ])
    .index("by_customerId_and_status_and_occurredOn", [
      "customerId",
      "status",
      "occurredOn",
    ]),

  customers: defineTable({
    userId: v.id("users"),
    name: v.string(),
    nameLower: v.string(),
    phone: v.optional(v.string()),
    balance: v.number(),
  })
    .index("by_userId_and_nameLower", ["userId", "nameLower"])
    .index("by_userId_and_balance", ["userId", "balance"]),

  // Denormalized per-day totals for the home screen and the week view.
  dailyTotals: defineTable({
    userId: v.id("users"),
    date: v.string(),
    sales: v.number(),
    cashIn: v.number(),
    expenses: v.number(),
    stock: v.number(),
    count: v.number(),
  }).index("by_userId_and_date", ["userId", "date"]),

  receipts: defineTable({
    token: v.string(),
    entryId: v.id("entries"),
    userId: v.id("users"),
  })
    .index("by_token", ["token"])
    .index("by_entryId", ["entryId"]),
});
