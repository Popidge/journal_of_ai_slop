"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { OPENROUTER_ENDPOINT } from "./openrouter";
import { sendPaperStatusNotification } from "./paperNotifications";
import { analyzeWithContentSafety } from "./moderation";
import {
  isPipelineSmokeTestMode,
  logPipelineSmokeTest,
} from "./pipelineSmokeTest";
import { deriveSlopId, localPaperLink } from "./slopIdUtils";
import { REVIEW_MAX_OUTPUT_TOKENS, REVIEW_MODELS } from "./reviewConfig";
import {
  buildPrompt,
  parseReview,
  deriveUsage,
  normalizeStoredReviewVotes,
  buildReviewVote,
  buildPublishingEditorRecord,
  runPublishingEditor,
  PUBLISHING_EDITOR_MODEL,
  ReviewVote,
} from "./reviewPrompts";

const MAX_REVIEW_COST = 0.2;

const pipelineStage = v.union(
  v.literal("moderation"),
  v.literal("peer_review"),
  v.literal("tally"),
  v.literal("publishing_editor"),
  v.literal("finalize"),
);

export const runStage = internalAction({
  args: {
    paperId: v.id("papers"),
    queueId: v.id("papersQueue"),
    stage: pipelineStage,
    notificationEmail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      switch (args.stage) {
        case "moderation":
          await ctx.runAction(internal.reviewPipeline.runModeration, {
            paperId: args.paperId,
            queueId: args.queueId,
          });
          break;
        case "peer_review":
          await ctx.runAction(internal.reviewPipeline.runPeerReview, {
            paperId: args.paperId,
            queueId: args.queueId,
          });
          break;
        case "tally":
          await ctx.runAction(internal.reviewPipeline.runTally, {
            paperId: args.paperId,
            queueId: args.queueId,
          });
          break;
        case "publishing_editor":
          await ctx.runAction(internal.reviewPipeline.runPublishingEditorStage, {
            paperId: args.paperId,
            queueId: args.queueId,
          });
          break;
        case "finalize":
          await ctx.runAction(internal.reviewPipeline.runFinalize, {
            paperId: args.paperId,
            queueId: args.queueId,
            notificationEmail: args.notificationEmail,
          });
          break;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : `Stage ${args.stage} failed`;
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason,
      });
    }
    return null;
  },
});

export const runModeration = internalAction({
  args: {
    paperId: v.id("papers"),
    queueId: v.id("papersQueue"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: args.paperId });
    if (!paper) {
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason: "Paper not found during moderation",
      });
      return null;
    }

    // Idempotency: if moderation already done, skip to next stage
    if (paper.moderation) {
      await ctx.runMutation(internal.papersQueue.advanceQueueStage, {
        queueId: args.queueId,
        stage: "peer_review",
      });
      await ctx.scheduler.runAfter(0, internal.reviewPipeline.runStage, {
        paperId: args.paperId,
        queueId: args.queueId,
        stage: "peer_review",
      });
      return null;
    }

    try {
      const moderationVerdict = await analyzeWithContentSafety(paper);
      console.info("[content-safety] verdict", {
        paperId: args.paperId,
        blocked: moderationVerdict.blocked,
        overallSeverity: moderationVerdict.overallSeverity,
        categories: moderationVerdict.categories,
        reason: moderationVerdict.reason,
        requestId: moderationVerdict.requestId,
      });

      if (moderationVerdict.blocked) {
        await ctx.runMutation(internal.papers.redactPaperContent, {
          paperId: args.paperId,
          moderation: {
            blocked: true,
            overallSeverity: moderationVerdict.overallSeverity,
            categories: moderationVerdict.categories,
            reason: moderationVerdict.reason,
            blockedAt: Date.now(),
            requestId: moderationVerdict.requestId,
          },
        });
        await ctx.runMutation(internal.papersQueue.rejectAndDropQueueItem, {
          queueId: args.queueId,
          paperId: args.paperId,
          reason: `Content moderation blocked: ${moderationVerdict.reason}`,
        });
        return null;
      }

      await ctx.runMutation(internal.papers.updatePaperStatus, {
        paperId: args.paperId,
        status: "under_review",
      });

      await ctx.runMutation(internal.papersQueue.advanceQueueStage, {
        queueId: args.queueId,
        stage: "peer_review",
      });
      await ctx.scheduler.runAfter(0, internal.reviewPipeline.runStage, {
        paperId: args.paperId,
        queueId: args.queueId,
        stage: "peer_review",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown moderation error";
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason,
      });
    }
    return null;
  },
});

export const runSingleReview = internalAction({
  args: {
    paperId: v.id("papers"),
    model: v.union(
      v.literal(REVIEW_MODELS[0]),
      v.literal(REVIEW_MODELS[1]),
      v.literal(REVIEW_MODELS[2]),
      v.literal(REVIEW_MODELS[3]),
      v.literal(REVIEW_MODELS[4]),
    ),
  },
  returns: v.object({
    agentId: v.string(),
    decision: v.union(v.literal("publish_now"), v.literal("publish_after_edits"), v.literal("reject")),
    reasoning: v.string(),
    cost: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    cachedTokens: v.number(),
    totalTokens: v.number(),
  }),
  handler: async (ctx, args) => {
    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: args.paperId });
    if (!paper) {
      return buildReviewVote(args.model, "reject", "Paper not found for single review.", {
        cost: 0,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
      });
    }

    if (isPipelineSmokeTestMode()) {
      const modelIndex = REVIEW_MODELS.indexOf(args.model);
      const decision = modelIndex < 3
        ? "publish_now"
        : modelIndex === 3
          ? "publish_after_edits"
          : "reject";
      logPipelineSmokeTest("peer-review OpenRouter call mocked", {
        model: args.model,
        decision,
      });
      return buildReviewVote(
        args.model,
        decision,
        `Deterministic ${decision} vote from pipeline smoke-test mode.`,
        {
          cost: 0,
          promptTokens: 0,
          completionTokens: 0,
          cachedTokens: 0,
          totalTokens: 0,
        },
      );
    }

    const prompt = buildPrompt(paper, args.model);
    let usageData = {
      cost: 0,
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
    };

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          max_tokens: REVIEW_MAX_OUTPUT_TOKENS,
          messages: [{ role: "user", content: prompt }],
          usage: {
            include: true,
          },
        }),
      });

      const responseData = await response.json();
      usageData = deriveUsage(responseData);

      if (!response.ok) {
        console.error(`OpenRouter error for ${args.model}: ${response.status} ${response.statusText}`);
        return buildReviewVote(args.model, "reject", `API returned ${response.status}.`, usageData);
      }

      const content = responseData?.choices?.[0]?.message?.content ?? "";
      const parsed = parseReview(content);

      return buildReviewVote(args.model, parsed.decision, parsed.reasoning, usageData);
    } catch (error) {
      console.error(`Failed to review with ${args.model}:`, error);
      return buildReviewVote(args.model, "reject", "Review failed due to an unexpected error.", usageData);
    }
  },
});

export const runPeerReview = internalAction({
  args: {
    paperId: v.id("papers"),
    queueId: v.id("papersQueue"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: args.paperId });
    if (!paper) {
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason: "Paper not found during peer review",
      });
      return null;
    }

    // Idempotency: if all 5 votes already in, skip to tally
    if (paper.reviewVotes && paper.reviewVotes.length >= REVIEW_MODELS.length) {
      await ctx.runMutation(internal.papersQueue.advanceQueueStage, {
        queueId: args.queueId,
        stage: "tally",
      });
      await ctx.scheduler.runAfter(0, internal.reviewPipeline.runStage, {
        paperId: args.paperId,
        queueId: args.queueId,
        stage: "tally",
      });
      return null;
    }

    try {
      const selectedModels = [...REVIEW_MODELS];
      for (let index = selectedModels.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [selectedModels[index], selectedModels[swapIndex]] = [
          selectedModels[swapIndex],
          selectedModels[index],
        ];
      }

      const reviewPromises = selectedModels.map((model) =>
        ctx.runAction(internal.reviewPipeline.runSingleReview, {
          paperId: args.paperId,
          model,
        })
      );

      const reviewVotes: ReviewVote[] = await Promise.all(reviewPromises);
      const totalReviewCost = reviewVotes.reduce((sum, vote) => sum + vote.cost, 0);
      const totalTokens = reviewVotes.reduce((sum, vote) => sum + vote.totalTokens, 0);

      await ctx.runMutation(internal.papers.updatePaperStatus, {
        paperId: args.paperId,
        status: "under_review",
        reviewVotes,
        totalReviewCost,
        totalTokens,
      });

      await ctx.runMutation(internal.papersQueue.advanceQueueStage, {
        queueId: args.queueId,
        stage: "tally",
      });
      await ctx.scheduler.runAfter(0, internal.reviewPipeline.runStage, {
        paperId: args.paperId,
        queueId: args.queueId,
        stage: "tally",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown peer review error";
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason,
      });
    }
    return null;
  },
});

export const runTally = internalAction({
  args: {
    paperId: v.id("papers"),
    queueId: v.id("papersQueue"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: args.paperId });
    if (!paper) {
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason: "Paper not found during tally",
      });
      return null;
    }

    // Idempotency: if status is already accepted/rejected, skip to next stage
    if (paper.status === "accepted" || paper.status === "rejected") {
      const nextStage = paper.status === "accepted" ? "publishing_editor" : "finalize";
      await ctx.runMutation(internal.papersQueue.advanceQueueStage, {
        queueId: args.queueId,
        stage: nextStage,
      });
      await ctx.scheduler.runAfter(0, internal.reviewPipeline.runStage, {
        paperId: args.paperId,
        queueId: args.queueId,
        stage: nextStage,
      });
      return null;
    }

    const reviewVotes = normalizeStoredReviewVotes(paper.reviewVotes ?? []);
    const totalReviewCost = reviewVotes.reduce((sum, vote) => sum + vote.cost, 0);
    const totalTokens = reviewVotes.reduce((sum, vote) => sum + vote.totalTokens, 0);

    if (totalReviewCost > MAX_REVIEW_COST) {
      console.warn(
        `Review for ${paper.title} exceeded budget: ${totalReviewCost.toFixed(2)} (limit ${MAX_REVIEW_COST.toFixed(2)})`,
      );
    }

    const publishNowVotes = reviewVotes.filter((vote) => vote.decision === "publish_now").length;
    const finalStatus = publishNowVotes >= Math.ceil(REVIEW_MODELS.length * 0.6) ? "accepted" : "rejected";

    await ctx.runMutation(internal.papers.updatePaperStatus, {
      paperId: args.paperId,
      status: finalStatus,
      reviewVotes,
      totalReviewCost,
      totalTokens,
    });

    const nextStage = finalStatus === "accepted" ? "publishing_editor" : "finalize";
    await ctx.runMutation(internal.papersQueue.advanceQueueStage, {
      queueId: args.queueId,
      stage: nextStage,
    });
    await ctx.scheduler.runAfter(0, internal.reviewPipeline.runStage, {
      paperId: args.paperId,
      queueId: args.queueId,
      stage: nextStage,
    });

    return null;
  },
});

export const runPublishingEditorStage = internalAction({
  args: {
    paperId: v.id("papers"),
    queueId: v.id("papersQueue"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: args.paperId });
    if (!paper) {
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason: "Paper not found during publishing editor",
      });
      return null;
    }

    // Idempotency: if publishing editor already ran, skip to finalize
    if (paper.publishingEditor) {
      await ctx.runMutation(internal.papersQueue.advanceQueueStage, {
        queueId: args.queueId,
        stage: "finalize",
      });
      await ctx.scheduler.runAfter(0, internal.reviewPipeline.runStage, {
        paperId: args.paperId,
        queueId: args.queueId,
        stage: "finalize",
      });
      return null;
    }

    try {
      const editorRun = await runPublishingEditor(paper);
      const totalReviewCost = (paper.totalReviewCost ?? 0) + editorRun.usage.cost;
      const totalTokens = (paper.totalTokens ?? 0) + editorRun.usage.totalTokens;
      const reviewVotes = normalizeStoredReviewVotes(paper.reviewVotes ?? []);

      let statusPatch: {
        paperId: Id<"papers">;
        status: "accepted";
        reviewVotes: ReviewVote[];
        totalReviewCost: number;
        totalTokens: number;
        renderContent?: string;
        renderMetadata?: { abstract?: string; sections: Array<{ title: string; anchor: string; level: number; source: "explicit" | "inferred" }> };
        publishingEditor?: {
          status: "completed" | "failed_fallback_original";
          model: string;
          editedAt: number;
          attempts: number;
          reason?: string;
          cost: number;
          promptTokens?: number;
          completionTokens?: number;
          cachedTokens?: number;
          totalTokens?: number;
        };
      };

      if (editorRun.result.ok) {
        statusPatch = {
          paperId: args.paperId,
          status: "accepted",
          reviewVotes,
          totalReviewCost,
          totalTokens,
          renderContent: editorRun.result.renderContent,
          renderMetadata: editorRun.result.renderMetadata,
          publishingEditor: buildPublishingEditorRecord(
            "completed",
            PUBLISHING_EDITOR_MODEL,
            Date.now(),
            editorRun.attempts,
            editorRun.usage,
            editorRun.result.reason,
          ),
        };
      } else {
        statusPatch = {
          paperId: args.paperId,
          status: "accepted",
          reviewVotes,
          totalReviewCost,
          totalTokens,
          publishingEditor: buildPublishingEditorRecord(
            "failed_fallback_original",
            PUBLISHING_EDITOR_MODEL,
            Date.now(),
            editorRun.attempts,
            editorRun.usage,
            editorRun.result.reason,
          ),
        };
      }

      await ctx.runMutation(internal.papers.updatePaperStatus, statusPatch);

      await ctx.runMutation(internal.papersQueue.advanceQueueStage, {
        queueId: args.queueId,
        stage: "finalize",
      });
      await ctx.scheduler.runAfter(0, internal.reviewPipeline.runStage, {
        paperId: args.paperId,
        queueId: args.queueId,
        stage: "finalize",
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown publishing editor error";
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason,
      });
    }
    return null;
  },
});

export const runFinalize = internalAction({
  args: {
    paperId: v.id("papers"),
    queueId: v.id("papersQueue"),
    notificationEmail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const paper = await ctx.runQuery(internal.papers.internalGetPaper, { id: args.paperId });
    if (!paper) {
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason: "Paper not found during finalize",
      });
      return null;
    }

    const queuedNotificationEmail = await ctx.runQuery(
      internal.papersQueue.getQueueNotificationEmail,
      { queueId: args.queueId },
    );

    try {
      if (paper.status === "accepted") {
        // Slop ID (idempotent)
        const existingSlopId = await ctx.runQuery(api.slopId.getByPaperId, {
          paperId: args.paperId,
        });
        if (!existingSlopId) {
          const slopId = deriveSlopId(paper._id);
          await ctx.runMutation(internal.slopId.upsertSlopId, {
            paperId: args.paperId,
            slopId,
            link: localPaperLink(args.paperId),
            fromLocalJournal: true,
          });
        }

        // Sitemap (always regenerate)
        await ctx.runAction(internal.sitemapAction.regenerateSitemap, {});

        // Highlighted paper record (idempotent)
        await ctx.runMutation(internal.slopbotTweets.ensureHighlightedPaperRecord, {
          paperId: args.paperId,
        });

        // Tweet (idempotent via publishedEvents inside tweetPublishedPaper)
        await ctx.runAction(internal.slopbotPublishedTweet.tweetPublishedPaper, {
          paperId: args.paperId,
        });
      }

      // Email notification (idempotent via reserve after success)
      const notificationEmail = (
        args.notificationEmail ?? queuedNotificationEmail ?? undefined
      )?.trim();
      if (notificationEmail && (paper.status === "accepted" || paper.status === "rejected")) {
        const reviewVotes = normalizeStoredReviewVotes(paper.reviewVotes ?? []);
        const reviewSummary = reviewVotes
          .map((vote) => `${vote.agentId}: ${vote.reasoning}`)
          .slice(0, 3)
          .join(" · ");

        await sendPaperStatusNotification({
          to: notificationEmail,
          paperId: args.paperId,
          paperTitle: paper.title,
          status: paper.status,
          reviewSummary: reviewSummary || undefined,
        });
        await ctx.runMutation(internal.papers.reserveStatusNotification, {
          paperId: args.paperId,
          status: paper.status,
          recipient: notificationEmail,
        });
      }

      await ctx.runMutation(internal.papersQueue.completeQueueItem, {
        queueId: args.queueId,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown finalize error";
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: args.queueId,
        reason,
      });
    }
    return null;
  },
});

export const processNextQueuedReview = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const queueItem = await ctx.runMutation(internal.papersQueue.acquireNextPaperForReview, {});
    if (!queueItem) {
      console.info("Council cron ticked but queue is empty.");
      return null;
    }

    try {
      await ctx.runAction(internal.reviewPipeline.runStage, {
        paperId: queueItem.paperId,
        queueId: queueItem.queueId,
        stage: queueItem.stage,
        notificationEmail: queueItem.notificationEmail ?? undefined,
      });
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : "Unknown failure";
      console.error("Queued review stage failed", { queueItem, failureReason });
      await ctx.runMutation(internal.papersQueue.releaseQueueItemAfterFailure, {
        queueId: queueItem.queueId,
        reason: `Review pipeline stage failed and will retry: ${failureReason || "unknown failure"}`,
      });
    }

    return null;
  },
});
