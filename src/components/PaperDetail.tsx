import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useParams, Link } from "react-router-dom";
import { Id } from "../../convex/_generated/dataModel";

type ReviewDecision = "publish_now" | "publish_after_edits" | "reject";

const decisionLabel = (decision: ReviewDecision) => {
  if (decision === "publish_now") {
    return "Publish Now";
  }
  if (decision === "publish_after_edits") {
    return "Publish After Edits";
  }
  return "Reject";
};

const getSlopScore = () => `Slop Score: ${(Math.random() * 0.8 + 0.1).toFixed(2)}`;

export default function PaperDetail() {
  const { id } = useParams<{ id: string }>();
  const paper = useQuery(api.papers.getPaper, { id: id as Id<"papers"> });

  if (paper === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading paper...</div>;
  }

  if (paper === null) {
    return <div className="min-h-screen flex items-center justify-center text-red-500">Paper not found</div>;
  }

  const reviewers = paper.reviewVotes?.map((review) => review.agentId).join(", ") ?? "Awaiting reviewers";
  const humanizedCost = paper.totalReviewCost != null ? `${paper.totalReviewCost.toFixed(2)}` : "Calculating...";
  const score = getSlopScore();

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        <Link to="/papers" className="text-sm font-semibold text-red-400 hover:text-red-300">
          ← Back to Papers
        </Link>

        <div className="space-y-4 rounded-3xl border border-gray-800 bg-black/60 p-8">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-4xl font-semibold text-white paper-title-glow">{paper.title}</h1>
            <span className="text-xs font-semibold uppercase tracking-[0.4em] text-red-300">{paper.status}</span>
          </div>
          <p className="text-gray-300 italic relative inline-block author-score" data-score={score}>
            by {paper.authors}
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-gray-300">
            {paper.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-gray-700 px-3 py-1 bg-black/40">
                {tag}
              </span>
            ))}
          </div>
          <div className="space-y-1 rounded-2xl border border-red-900/50 bg-black/30 p-4 text-sm text-gray-300 paper-meta">
            <p>
              Reviewed by: <span className="text-white">{reviewers}</span>
            </p>
            <p>
              Review cost: <span className="text-white">{humanizedCost}</span>
            </p>
            <p>
              Submitted on <span className="text-white">{new Date(paper.submittedAt).toLocaleDateString()}</span>
            </p>
          </div>
          <article className="paper-abstract prose prose-invert text-sm font-serif leading-relaxed whitespace-pre-wrap bg-black/30 p-6 rounded-2xl border border-gray-800">
            {paper.content}
          </article>
        </div>

        <section className="space-y-6 rounded-3xl border border-gray-800 bg-black/60 p-8">
          <h2 className="text-2xl font-semibold text-white">Peer Reviews</h2>
          {paper.reviewVotes && paper.reviewVotes.length > 0 ? (
            <div className="space-y-4">
              {paper.reviewVotes.map((review, idx) => {
                const isReject = review.decision === "reject";
                return (
                  <article key={idx} className={`reviewer-card slop-flicker ${isReject ? "slop-pulse-error" : ""}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold uppercase tracking-[0.4em] text-red-400">Reviewer {idx + 1}</p>
                      <span
                        className={`text-xs font-semibold uppercase tracking-[0.3em] ${isReject ? "text-red-400" : "text-white"}`}
                      >
                        {decisionLabel(review.decision)}
                      </span>
                    </div>
                    <p className="mt-4 text-gray-300 italic">"{review.reasoning}"</p>
                    <p className="mt-3 text-xs text-gray-500 font-mono">
                      Model: <span className="text-white">{review.agentId}</span> • Cost: ${review.cost.toFixed(4)}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 italic">The panel is still composing its slop verdict.</p>
          )}
        </section>

        <footer className="text-center text-sm text-gray-400">
          Pinky-swear clause: <strong>✓ Enforced (honour system)</strong>.
        </footer>
      </div>
    </div>
  );
}
