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
    <main className="min-h-screen px-4 py-5 text-[color:var(--ink)]">
      <section className="mx-auto w-full max-w-[1040px] space-y-4">
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] items-center">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-2 rounded-[16px] border border-[color:var(--coffee-light)] bg-[color:var(--coffee)] opacity-30" />
            <div className="relative w-[240px] overflow-hidden rounded-[14px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)] p-4 shadow-[0_20px_45px_rgba(35,24,21,0.2)]">
              <img src="/slopbot.png" alt="SLOPBOT mascot" className="w-full h-auto" />
            </div>
            <div className="sr-only">Retro robot mascot portrait</div>
          </div>

          <div className="space-y-2 rounded-[32px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 shadow-[0_10px_30px_rgba(35,24,21,0.12)]">
            <p className="text-xs uppercase tracking-[0.5em] text-[color:var(--accent-blue)]">Paper 01 · Issue XXXVII</p>
            <h1 className="text-4xl font-semibold leading-snug text-[color:var(--ink)] wobbly-underline">The Journal of AI Slop™</h1>
            <p className="text-lg font-serif text-[color:var(--ink-soft)] italic">All Sarcasm, No Rigour.</p>
            <p className="text-base text-[color:var(--ink-soft)]">
              A very serious journal for very unserious AI co-authored research. We dress like a faculty lounge newsletter and behave like a gremlin scribble on a staff room memo.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                to="/submit"
                data-quirk="true"
                className="button-scale inline-flex items-center justify-center rounded-full border border-[color:var(--coffee)] bg-[color:var(--coffee)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--paper)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_25px_rgba(35,24,21,0.3)]"
              >
                Submit to the Slop Pipeline
              </Link>
              <Link
                to="/papers"
                className="button-scale inline-flex items-center justify-center rounded-full border border-[color:var(--coffee-light)] bg-transparent px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--coffee)] transition-colors duration-200 hover:text-[color:var(--accent-blue)] hover:border-[color:var(--accent-blue)]"
              >
                Browse Published Nonsense
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 mx-auto w-full max-w-[1040px] space-y-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-semibold text-[color:var(--ink)]">Latest Published Slop</h2>
          <p className="text-sm uppercase tracking-[0.35em] text-[color:var(--ink-soft)]">Summoning Review Panel…</p>
        </div>

        <div className="space-y-4">
          {latestAccepted === undefined ? (
            <div className="flex flex-col items-center gap-4 rounded-[32px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)] p-5 shadow-[0_10px_30px_rgba(35,24,21,0.12)]">
              <div className="question-spinner" aria-hidden="true" />
              <p className="text-sm text-[color:var(--ink-soft)]">Summoning Review Panel…</p>
            </div>
          ) : latestAccepted.length === 0 ? (
            <div className="rounded-[32px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)] p-5 text-center text-sm text-[color:var(--ink-soft)] shadow-[0_10px_30px_rgba(35,24,21,0.12)]">
              No papers have survived the peer review circus yet.
            </div>
          ) : (
            latestAccepted.map((paper) => {
              const score = getSlopScore();
              return (
                <Link
                  key={paper._id}
                  to={`/papers/${paper._id}`}
                  className="group block rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)] p-5 shadow-[0_15px_35px_rgba(35,24,21,0.12)] transition hover:border-[color:var(--accent-blue)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xl font-semibold text-[color:var(--ink)] paper-title-glow wobbly-underline">{paper.title}</h3>
                    <span className="rounded-full border border-[color:var(--coffee)] px-3 py-1 text-[color:var(--coffee)] text-xs font-semibold uppercase tracking-[0.35em]">
                      {paper.status.replace("accepted", "PUBLISH NOW")}
                    </span>
                  </div>
                  <p className="text-sm italic text-[color:var(--ink-soft)] mt-2 relative inline-block author-score" data-score={score}>
                    by {paper.authors}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[color:var(--coffee)] text-xs">
                    {paper.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-[color:var(--coffee)] px-3 py-1 bg-[color:var(--paper)]/70">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-right text-[color:var(--ink-soft)] text-xs">
                    Submitted on {new Date(paper.submittedAt).toLocaleDateString()}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <footer className="mt-16 text-center text-sm text-[color:var(--ink-soft)]">
        ISSN: pending. Regret: ongoing. — Created by <Link to="https://github.com/popidge" target="_blank" className="underline">Jamie Taylor</Link>
      </footer>
    </main>
  );
}
