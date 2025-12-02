import { query } from "./_generated/server";
import { v } from "convex/values";

const editorsCommentProjection = v.object({
  _id: v.id("editorsComments"),
  _creationTime: v.number(),
  paperId: v.id("papers"),
  editorComment: v.string(),
});

const fetchLatestCommentByPaperId = async (ctx: any, paperId: string) => {
  const matches = await ctx.db
    .query("editorsComments")
    .withIndex("by_paperId", (q: any) => q.eq("paperId", paperId))
    .order("desc")
    .take(1);
  return matches[0] ?? null;
};

export const getByPaperId = query({
  args: { paperId: v.id("papers") },
  returns: v.union(editorsCommentProjection, v.null()),
  handler: async (ctx, args) => {
    return await fetchLatestCommentByPaperId(ctx, args.paperId);
  },
});

export const getByPaperIds = query({
  args: {
    paperIds: v.array(v.id("papers")),
  },
  returns: v.array(editorsCommentProjection),
  handler: async (ctx, args) => {
    const results = [];
    for (const paperId of args.paperIds) {
      const comment = await fetchLatestCommentByPaperId(ctx, paperId);
      if (comment) {
        results.push(comment);
      }
    }
    return results;
  },
});
