// @ts-nocheck

import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const DEFAULT_ENERGY_PER_TOKEN_WH = 0.0005;
const DEFAULT_CO2_PER_WH = 0.5;
const DEFAULT_IMPACT_LABEL = "default";

export const ecoModeMigration = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let migratedCount = 0;
    const paperQuery = ctx.db.query("papers").order("asc");
    for await (const paper of paperQuery) {
      const reviewVotes = paper.reviewVotes ?? [];
      const totalTokens = reviewVotes.reduce((sum, vote) => sum + (vote?.totalTokens ?? 0), 0);
      await ctx.db.patch(paper._id, { totalTokens });
      migratedCount += 1;
    }

    await ctx.runMutation(internal.environmentalImpact.internalUpsertImpactValues, {
      label: DEFAULT_IMPACT_LABEL,
      energyPerTokenWh: DEFAULT_ENERGY_PER_TOKEN_WH,
      co2PerWh: DEFAULT_CO2_PER_WH,
    });

    console.info(`Eco-mode migration patched ${migratedCount} papers and seeded impact defaults.`);
    return null;
  },
});
