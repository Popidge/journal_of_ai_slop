import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

const getSlopScore = () => `Slop Score: ${(Math.random() * 0.8 + 0.1).toFixed(2)}`;

export default function PapersList() {
  const papers = useQuery(api.papers.listPapers, { status: "accepted", limit: 50 });

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-red-300">Published Slop</p>
            <h1 className="text-4xl font-semibold text-white paper-title-glow">Accepted Papers</h1>
            <p className="text-sm text-gray-400">Only the papers that survived the panel make it here.</p>
          </div>
          <Link
            to="/submit"
            className="button-scale self-start rounded-full border border-gray-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:border-red-500"
          >
            Submit a New Paper
          </Link>
        </div>

        <div className="grid gap-6">
          {papers === undefined ? (
            <div className="text-center text-gray-400 space-y-4">
              <div className="question-spinner slop-flicker mx-auto" aria-hidden="true" />
              <p>Summoning the AI reviewers...</p>
              <div className="flex gap-3 justify-center">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-24 w-40 rounded-2xl bg-white/5 slop-misalign ${idx === 2 ? "-rotate-3" : idx === 3 ? "rotate-6" : "rotate-0"}`}
                  />
                ))}
              </div>
            </div>
          ) : papers.length === 0 ? (
            <div className="text-center text-gray-500">No accepted slop yet. The reviewers must be napping.</div>
          ) : (
            papers.map((paper) => {
              const score = getSlopScore();
              return (
                <Link
                  key={paper._id}
                  to={`/papers/${paper._id}`}
                  className="group block rounded-2xl border border-gray-800 bg-black/60 p-6 transition hover:border-red-500"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white paper-title-glow">{paper.title}</h2>
                      <p className="text-gray-400 mt-1 relative inline-block author-score" data-score={score}>
                        by {paper.authors}
                      </p>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-red-300">accepted</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-300">
                    {paper.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-gray-700 px-3 py-1 bg-black/40">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-2 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
                    <p className="paper-meta">Submitted on {new Date(paper.submittedAt).toLocaleDateString()}</p>
                    <p className="paper-meta">
                      Review cost: {paper.totalReviewCost != null ? `${paper.totalReviewCost.toFixed(2)}` : "Calculating..."}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="text-center text-gray-400">
          <Link to="/" className="text-red-400 hover:text-red-300">
            ← Back to The Journal of AI Slop™
          </Link>
        </div>
      </div>
    </div>
  );
}
