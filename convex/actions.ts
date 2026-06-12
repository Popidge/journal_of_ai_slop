"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { deriveSlopId, localPaperLink } from "./slopIdUtils";

export const regenerateSlopIds = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const listMissing = (internal.slopId as any).listAcceptedPaperIdsMissingSlop;
    const paperIds = await ctx.runQuery(listMissing, {});

    for (const paperId of paperIds) {
      const slopId = deriveSlopId(paperId);
      await ctx.runMutation(internal.slopId.upsertSlopId, {
        paperId,
        slopId,
        link: localPaperLink(paperId),
        fromLocalJournal: true,
      });
    }

    return null;
  },
});
