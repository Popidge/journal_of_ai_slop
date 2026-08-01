"use node";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

import { deriveSlopId, localPaperLink } from "./slopIdUtils";

export const regenerateSlopIds = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const paperIds = await ctx.runQuery(
      internal.slopId.listAcceptedPaperIdsMissingSlop,
      {},
    );

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
