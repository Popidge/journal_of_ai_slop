import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";

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

const getSlopScore = () => `Slop Score: ${(Math.random() * 0.8 + 0.1).toFixed(2)}`;

const isParseError = (reasoning: string) => reasoning.toLowerCase().includes("parse") || reasoning.toLowerCase().includes("unparsable");

export default function PaperDetail() {
  const { id } = useParams<{ id: string }>();
  const paper = useQuery(api.papers.getPaper, { id: id as Id<"papers"> });

  if (paper === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-[color:var(--ink-soft)]">Loading paper…</div>;
  }

  if (paper === null) {
    return <div className="min-h-screen flex items-center justify-center text-[color:var(--accent-red)]">Paper not found</div>;
  }

  const score = getSlopScore();

  return (
    <div className="min-h-screen px-4 py-10 text-[color:var(--ink)]">
      <div className="mx-auto w-full max-w-[1040px] space-y-8">
        <Link
          to="/papers"
          className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--ink-soft)] transition hover:text-[color:var(--accent-blue)]"
        >
          ← Back to The Journal of AI Slop™
        </Link>

        <article className="rounded-[32px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-8 shadow-[0_20px_40px_rgba(35,24,21,0.12)] space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--ink-soft)]">Research Note</p>
            <h1 className="text-4xl font-semibold text-[color:var(--ink)] leading-tight paper-title-glow wobbly-underline">{paper.title}</h1>
          </div>
          <div className="flex flex-wrap items-baseline gap-4">
            <p className="text-sm italic text-[color:var(--ink-soft)]">by {paper.authors}</p>
            <span className="rounded-full border border-[color:var(--coffee)] px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-[color:var(--coffee)]">
              {formatStatus(paper.status)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-[color:var(--coffee)] text-[0.65rem]">
            {paper.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-[color:var(--coffee)] px-3 py-1 bg-[color:var(--paper)]/80">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-[color:var(--ink-soft)]">
            <p>Submitted on {new Date(paper.submittedAt).toLocaleDateString()}</p>
            <p>
              Review cost:${paper.totalReviewCost != null ? `${paper.totalReviewCost.toFixed(6)}` : "Calculating..."}
            </p>
            <p>{score}</p>
          </div>
          <article className="rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/80 px-6 py-6 text-sm leading-relaxed text-[color:var(--ink-soft)] shadow-[0_15px_35px_rgba(35,24,21,0.08)] whitespace-pre-wrap">
            {paper.content}
          </article>
        </article>

        <section className="rounded-[32px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 shadow-[0_15px_35px_rgba(35,24,21,0.12)] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.45em] text-[color:var(--ink-soft)]">Peer Reviews (By Bots)</p>
              <h2 className="text-2xl font-semibold text-[color:var(--ink)]">Verdicts</h2>
            </div>
            <p className="text-[0.65rem] uppercase tracking-[0.4em] text-[color:var(--coffee)]">Certified Unrigor</p>
          </div>

          {paper.reviewVotes && paper.reviewVotes.length > 0 ? (
            <div className="space-y-4">
              {paper.reviewVotes.map((review, idx) => {
                const borderColor = verdictColor(review.decision);
                const verifiedParseError = isParseError(review.reasoning);
                return (
                  <div
                    key={idx}
                    className="relative flex flex-col gap-3 rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 shadow-[0_10px_25px_rgba(35,24,21,0.08)]"
                    style={{ borderLeftWidth: 6, borderLeftColor: borderColor }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.45em] text-[color:var(--ink-soft)]">Reviewer {idx + 1}</p>
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-[color:var(--ink)]">
                        {decisionLabel(review.decision)}
                      </span>
                    </div>
                    {verifiedParseError && (
                      <span className="self-start rounded-full bg-[color:var(--coffee-light)]/40 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.4em] text-[color:var(--ink)]">
                        Certified Unparsable
                      </span>
                    )}
                    <p className="text-sm italic text-[color:var(--ink-soft)]">“{review.reasoning}”</p>
                    <div className="flex flex-wrap justify-between gap-3 text-[0.65rem] font-mono text-[color:var(--ink-soft)]">
                      <span>Model: {review.agentId}</span>
                      <span>Cost: ${review.cost.toFixed(6)}</span>
                      <span>Parse Status: {verifiedParseError ? "Certified Unparsable" : "Certified"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm italic text-[color:var(--ink-soft)]">The panel is still composing its slop verdict.</p>
          )}
        </section>
      </div>
    </div>
  );
}
