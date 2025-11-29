import { query } from "./_generated/server";
import { v } from "convex/values";

const editorsCommentProjection = v.object({
  _id: v.id("editorsComments"),
  _creationTime: v.number(),
  paperId: v.id("papers"),
  editorComment: v.string(),
});

export const getByPaperId = query({
  args: { paperId: v.id("papers") },
  returns: v.union(editorsCommentProjection, v.null()),
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("editorsComments")
      .withIndex("by_paperId", (q) => q.eq("paperId", args.paperId))
      .order("desc")
      .take(1);
    return matches[0] ?? null;
  },
});
