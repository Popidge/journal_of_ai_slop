import { Helmet } from "react-helmet";
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";
import MarkdownRenderer from "./MarkdownRenderer";
import EditorsCommentBox from "./EditorsCommentBox";
import { useEcoMode } from "@/hooks/useEcoMode";
import { useEnvironmentalImpact } from "@/hooks/useEnvironmentalImpact";
import {
  formatCo2,
  formatEnergy,
  formatTokens,
  formatCurrency,
  tokensToCo2g,
  tokensToEnergyMWh,
} from "@/utils/ecoMetrics";
import { toPersonSchemaAuthors } from "@/utils/authors";

type ReviewDecision = "publish_now" | "publish_after_edits" | "reject";

const decisionLabel = (decision: ReviewDecision) => {
  if (decision === "publish_now") return "PUBLISH NOW";
  if (decision === "publish_after_edits") return "PUBLISH AFTER EDITS";
  return "REJECTED";
};

const verdictColor = (decision: ReviewDecision) => {
  if (decision === "publish_now") return "#1d6d55";
  if (decision === "publish_after_edits") return "#c47d22";
  return "#a72222";
};

const formatStatus = (status: string) => {
  if (status === "accepted") return "PUBLISHED";
  if (status === "rejected") return "REJECTED";
  if (status === "under_review") return "UNDER REVIEW";
  return status.toUpperCase();
};

const getSlopScore = () =>
  `Slop Score: ${(Math.random() * 0.8 + 0.1).toFixed(2)}`;

const isParseError = (reasoning: string) =>
  reasoning.toLowerCase().includes("parse") ||
  reasoning.toLowerCase().includes("unparsable");

export default function PaperDetail() {
  const { id } = useParams<{ id: string }>();
  const paper = useQuery(api.papers.getPaper, { id: id as Id<"papers"> });
  const slopRecord = useQuery(api.slopId.getByPaperId, {
    paperId: id as Id<"papers">,
  });
  const slopHref = slopRecord
    ? slopRecord.fromLocalJournal
      ? `/${slopRecord.link}`
      : slopRecord.link
    : null;
  const editorComment = useQuery(api.editorsComments.getByPaperId, {
    paperId: id as Id<"papers">,
  });
  const detailRef = useRef<HTMLDivElement>(null);

  const { ecoMode } = useEcoMode();
  const { energyPerTokenWh, co2PerWh, ready } = useEnvironmentalImpact();

  useEffect(() => {
    if (paper) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [paper]);

  if (paper === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[color:var(--ink-soft)]">
        Loading paper…
      </div>
    );
  }

  const computedTotalTokens =
    paper?.totalTokens ??
    paper?.reviewVotes?.reduce(
      (sum, vote) => sum + (vote?.totalTokens ?? 0),
      0,
    ) ??
    0;
  const hasTokenData =
    paper?.totalTokens != null ||
    (paper?.reviewVotes && paper.reviewVotes.length > 0);
  const totalEnergy = tokensToEnergyMWh(computedTotalTokens, energyPerTokenWh);
  const totalCo2 = tokensToCo2g(
    computedTotalTokens,
    energyPerTokenWh,
    co2PerWh,
  );

  if (paper === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[color:var(--accent-red)]">
        Paper not found
      </div>
    );
  }

  const score = getSlopScore();

  return (
    <div
      ref={detailRef}
      className="min-h-screen px-3 py-10 text-[color:var(--ink)] sm:px-4"
    >
      <Helmet>
        <title>{paper.title} | The Journal of AI Slop™</title>
        <meta name="description" content={paper.content.slice(0, 200)} />
        <meta name="keywords" content={paper.tags.join(", ")} />
        <meta name="author" content={paper.authors} />
        <meta property="og:title" content={paper.title} />
        <meta property="og:description" content={paper.content.slice(0, 200)} />
        <meta property="og:type" content="article" />
        <meta
          property="og:url"
          content={`https://journalofaislop.com/papers/${paper._id}`}
        />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ScholarlyArticle",
            headline: paper.title,
            author: toPersonSchemaAuthors(paper.authors),
            datePublished: new Date(paper.submittedAt).toISOString(),
            keywords: paper.tags,
            description: paper.content.slice(0, 200),
            identifier: paper._id,
          })}
        </script>
      </Helmet>
      <div className="mx-auto w-full max-w-[1040px] space-y-8">
        <Link
          to="/papers"
          className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--ink-soft)] transition hover:text-[color:var(--accent-blue)] sm:text-xs sm:tracking-[0.35em]"
        >
          ← Back to The Journal of AI Slop™
        </Link>

        <article className="space-y-6 rounded-[26px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 shadow-[0_20px_40px_rgba(35,24,21,0.12)] sm:rounded-[32px] sm:p-8">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)] sm:text-xs sm:tracking-[0.4em]">
              Research Note
            </p>
            <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-tight text-[color:var(--ink)] paper-title-glow wobbly-underline">
              {paper.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-baseline gap-3 text-center text-sm text-[color:var(--ink-soft)] sm:flex-row sm:text-left">
            <p className="italic">by {paper.authors}</p>
            <span className="mx-auto rounded-full border border-[color:var(--coffee)] px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--coffee)] sm:mx-0 sm:text-[0.6rem] sm:tracking-[0.4em]">
              {formatStatus(paper.status)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-[0.6rem] text-[color:var(--coffee)] sm:text-[0.65rem]">
            {paper.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[color:var(--coffee)] bg-[color:var(--paper)]/80 px-3 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
          {slopRecord && slopHref && (
            <p className="text-[0.7rem] text-[color:var(--coffee)]">
              Slop ID:{" "}
              <a
                href={slopHref}
                className="font-mono underline decoration-[color:var(--coffee)] text-[color:var(--accent-blue)]"
              >
                {slopRecord.slopId}
              </a>
            </p>
          )}
          <div className="flex flex-col gap-2 text-[0.7rem] text-[color:var(--ink-soft)] sm:flex-row sm:flex-wrap sm:gap-6">
            <p>
              Submitted on {new Date(paper.submittedAt).toLocaleDateString()}
            </p>
            <div className="flex flex-col gap-1">
              {ecoMode ? (
                <>
                  <p>
                    Energy consumption:{" "}
                    {ready && hasTokenData
                      ? formatEnergy(totalEnergy)
                      : "Calculating energy..."}
                  </p>
                  <p>
                    CO₂ output:{" "}
                    {ready && hasTokenData
                      ? formatCo2(totalCo2)
                      : "Calculating impact..."}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Review cost:{" "}
                    {paper.totalReviewCost != null
                      ? formatCurrency(paper.totalReviewCost)
                      : "Calculating..."}
                  </p>
                  <p>
                    Tokens:{" "}
                    {hasTokenData
                      ? formatTokens(computedTotalTokens)
                      : "Calculating..."}
                  </p>
                </>
              )}
            </div>
            <p>{score}</p>
          </div>
          <div className="watermarked-paper rounded-[24px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/80 px-4 py-5 text-[color:var(--ink-soft)] shadow-[0_15px_35px_rgba(35,24,21,0.08)] sm:px-6">
            <MarkdownRenderer
              content={paper.content}
              className="text-sm leading-relaxed"
            />
            <p className="mt-4 text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">
              Licensed under{" "}
              <Link
                to="/licensing#paper"
                className="text-[color:var(--accent-blue)] underline"
              >
                CC BY-NC-SA 4.0
              </Link>
            </p>
          </div>
        </article>

        {editorComment && (
          <EditorsCommentBox
            comment={editorComment.editorComment}
            createdAt={editorComment._creationTime}
          />
        )}

        <section className="space-y-6 rounded-[26px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-4 shadow-[0_15px_35px_rgba(35,24,21,0.12)] sm:rounded-[32px] sm:p-5">
          <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)] sm:text-xs sm:tracking-[0.45em]">
                Peer Reviews (By Bots)
              </p>
              <h2 className="text-[clamp(1.5rem,4vw,2.25rem)] font-semibold text-[color:var(--ink)]">
                Verdicts
              </h2>
            </div>
            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-[color:var(--coffee)] sm:text-[0.65rem] sm:tracking-[0.4em]">
              Certified Unrigor
            </p>
          </div>

          {paper.reviewVotes && paper.reviewVotes.length > 0 ? (
            <div className="space-y-4">
              {paper.reviewVotes.map((review, idx) => {
                const borderColor = verdictColor(review.decision);
                const verifiedParseError = isParseError(review.reasoning);
                const reviewTokens = review.totalTokens ?? 0;
                const reviewEnergy = tokensToEnergyMWh(
                  reviewTokens,
                  energyPerTokenWh,
                );
                const reviewCo2 = tokensToCo2g(
                  reviewTokens,
                  energyPerTokenWh,
                  co2PerWh,
                );
                return (
                  <div
                    key={idx}
                    className="relative flex flex-col gap-3 rounded-[24px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-4 shadow-[0_10px_25px_rgba(35,24,21,0.08)] sm:rounded-[28px] sm:p-5"
                    style={{ borderLeftWidth: 6, borderLeftColor: borderColor }}
                  >
                    <div className="flex flex-col gap-1 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--ink-soft)] sm:text-xs sm:tracking-[0.45em]">
                        Reviewer {idx + 1}
                      </p>
                      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--ink)] sm:text-[0.65rem] sm:tracking-[0.4em]">
                        {decisionLabel(review.decision)}
                      </span>
                    </div>
                    {verifiedParseError && (
                      <span className="self-start rounded-full bg-[color:var(--coffee-light)]/40 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--ink)] sm:text-[0.6rem] sm:tracking-[0.4em]">
                        Certified Unparsable
                      </span>
                    )}
                    <p className="text-sm italic text-[color:var(--ink-soft)]">
                      “{review.reasoning}”
                    </p>
                    <div className="flex flex-wrap justify-between gap-3 text-[0.6rem] font-mono text-[color:var(--ink-soft)] sm:text-[0.65rem]">
                      <span>Model: {review.agentId}</span>
                      {ecoMode ? (
                        <>
                          <span>
                            Energy:{" "}
                            {ready
                              ? formatEnergy(reviewEnergy)
                              : "Calculating energy..."}
                          </span>
                          <span>
                            CO₂:{" "}
                            {ready
                              ? formatCo2(reviewCo2)
                              : "Calculating impact..."}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>Cost: ${review.cost.toFixed(6)}</span>
                          <span>Tokens: {formatTokens(reviewTokens)}</span>
                        </>
                      )}
                      <span>
                        Parse Status:{" "}
                        {verifiedParseError
                          ? "Certified Unparsable"
                          : "Certified"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm italic text-[color:var(--ink-soft)]">
              The panel is still composing its slop verdict.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
