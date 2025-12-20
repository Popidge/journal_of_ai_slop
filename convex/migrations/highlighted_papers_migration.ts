import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const highlightedPapersMigration = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let migratedCount = 0;
    const paperQuery = ctx.db.query("papers").order("asc");
    for await (const paper of paperQuery) {
      const existing = await ctx.db
        .query("highlightedPapers")
        .withIndex("by_paperId", (q) => q.eq("paperId", paper._id))
        .take(1);

      if (existing.length === 0) {
        await ctx.db.insert("highlightedPapers", {
          paperId: paper._id,
          dateHighlighted: undefined,
        });
        migratedCount += 1;
      }
    }

    console.info(`highlightedPapers migration inserted ${migratedCount} rows.`);
    return null;
  },
});
