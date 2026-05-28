import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const patchReviewedAtForExistingPapers = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let migratedCount = 0;

    for await (const paper of ctx.db.query("papers").order("asc")) {
      const isReviewed = paper.status === "accepted" || paper.status === "rejected";
      const hasTokens = typeof paper.totalTokens === "number" && paper.totalTokens > 0;
      if (!isReviewed || !hasTokens || paper.moderation?.blocked || paper.reviewedAt !== undefined) {
        continue;
      }

      await ctx.db.patch("papers", paper._id, {
        reviewedAt: paper.submittedAt,
      });
      migratedCount += 1;
    }

    console.info(`carbon ledger migration patched ${migratedCount} reviewed papers.`);
    return migratedCount;
  },
});

export const carbonLedgerMigration = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const migrationApi = internal as any;
    await ctx.runMutation(migrationApi["migrations/carbon_ledger_migration"].patchReviewedAtForExistingPapers, {});
    await ctx.runAction(internal.carbonLedger.rebuildLedgerSnapshot, {});
    return null;
  },
});
