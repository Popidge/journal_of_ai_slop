import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const getSlopScore = () => `Slop Score: ${(Math.random() * 0.8 + 0.1).toFixed(2)}`;

export default function LandingPage() {
  const latestAccepted = useQuery(api.papers.listPapers, {
    status: "accepted",
    limit: 5,
  });

  return (
    <main className="min-h-screen flex flex-col text-white px-4 py-12">
      <section className="mx-auto text-center max-w-4xl space-y-6">
        <p className="text-sm uppercase tracking-[0.4em] text-red-400">
          Peer review, but make it absurd
        </p>
        <h1 className="text-5xl md:text-6xl font-semibold text-red-400 leading-tight">The Journal of AI Slop™</h1>
        <p className="text-xl text-gray-300">
          Where the Peer Reviewers are Also the Peers Being Reviewed, the satire is impossibly good, and the papers
          somehow survive the LLM gauntlet.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/submit"
            data-quirk="true"
            className="button-scale px-10 py-4 rounded-full bg-gradient-to-r from-red-600 via-red-500 to-pink-600 text-lg font-bold shadow-[0_10px_60px_rgba(239,68,68,0.35)]"
          >
            Submit Your Slop
          </Link>
          <Link
            to="/papers"
            className="button-scale px-10 py-4 rounded-full border border-gray-700 text-lg font-semibold text-white hover:border-red-500 transition"
          >
            Read the Published Slop
          </Link>
        </div>
      </section>

      <section className="mt-16 mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-semibold text-white">Latest Published Slop</h2>
          <p className="text-sm text-gray-400">Freshly honored by a panel of five completely random LLM reviewers.</p>
        </div>

        <div className="space-y-4">
          {latestAccepted === undefined ? (
            <div className="flex flex-col items-center gap-4 text-gray-400">
              <div className="question-spinner slop-flicker" aria-hidden="true" />
              <p>Summoning the latest slop...</p>
              <div className="flex gap-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-24 w-40 rounded-2xl bg-white/5 slop-misalign ${idx === 2 ? "rotate-3" : "rotate-0"}`}
                  />
                ))}
              </div>
            </div>
          ) : latestAccepted.length === 0 ? (
            <p className="text-gray-500">No papers have survived the peer review circus yet.</p>
          ) : (
            latestAccepted.map((paper) => {
              const score = getSlopScore();
              return (
                <Link
                  key={paper._id}
                  to={`/papers/${paper._id}`}
                  className="group block rounded-2xl border border-red-900/60 bg-black/60 p-6 transition hover:border-red-500"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-2xl font-semibold text-white paper-title-glow">{paper.title}</h3>
                    <span className="text-xs font-semibold uppercase tracking-[0.4em] text-red-300">accepted</span>
                  </div>
                  <p className="text-gray-400 mt-2 relative inline-block author-score" data-score={score}>
                    by {paper.authors}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-300">
                    {paper.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-gray-700 px-3 py-1 bg-black/40">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-right text-xs text-gray-500">
                    Submitted on {new Date(paper.submittedAt).toLocaleDateString()}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <footer className="mt-12 text-center text-sm text-gray-400">
        Pinky-swear clause: <strong>✓ Enforced (honour system)</strong>. Crom is watching the red gradient.
        <div className="sr-only">
          <p>If you're reading this, you're too deep. Submit a paper about it.</p>
        </div>
      </footer>
    </main>
  );
}
