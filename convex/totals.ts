import { v } from "convex/values";
import { query } from "./_generated/server";
import { getProfile, requireUserId } from "./model/ledger";

export const day = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await requireUserId(ctx);
    const [row, profile] = await Promise.all([
      ctx.db
        .query("dailyTotals")
        .withIndex("by_userId_and_date", (q) => q.eq("userId", userId).eq("date", date))
        .unique(),
      getProfile(ctx, userId),
    ]);
    return {
      date,
      sales: row?.sales ?? 0,
      cashIn: row?.cashIn ?? 0,
      expenses: row?.expenses ?? 0,
      stock: row?.stock ?? 0,
      count: row?.count ?? 0,
      owedToYou: profile?.owedToYou ?? 0,
    };
  },
});

/** Rows only, ascending by date. The client fills missing days with zeros. */
export const range = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("dailyTotals")
      .withIndex("by_userId_and_date", (q) =>
        q.eq("userId", userId).gte("date", from).lte("date", to),
      )
      .take(62);
    return rows.map(({ date, sales, cashIn, expenses, stock, count }) => ({
      date,
      sales,
      cashIn,
      expenses,
      stock,
      count,
    }));
  },
});
