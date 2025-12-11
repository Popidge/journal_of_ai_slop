import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import slopbotImg from "@/assets/media/slopbot.png";

const getSlopScore = () => `Slop Score: ${(Math.random() * 0.8 + 0.1).toFixed(2)}`;

export default function LandingPage() {
  const latestAccepted = useQuery(api.papers.listPapers, {
    status: "accepted",
    limit: 5,
  });

  return (
    <main className="min-h-screen px-3 py-5 text-[color:var(--ink)] sm:px-4">
      <section className="mx-auto w-full max-w-[1040px] px-1 sm:px-0 -mt-2 mb-4">
        <div className="rounded-[24px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-4 text-center text-sm font-semibold tracking-[0.2em] text-[color:var(--coffee)] shadow-[0_12px_35px_rgba(35,24,21,0.15)] sm:text-base">
          <p className="m-0">
            A message from our editor:{` `}
            <Link
              to="/messages"
              className="text-[color:var(--accent-blue)] underline transition hover:text-[color:var(--ink)]"
            >
              Christmas Open Weight Bonanza!
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1040px] space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:items-center">
          <div className="relative mx-auto flex w-full max-w-[260px] items-center justify-center lg:mx-0">
            <div className="absolute inset-2 rounded-[16px] border border-[color:var(--coffee-light)] bg-[color:var(--coffee)] opacity-30" />
            <div className="relative w-full overflow-hidden rounded-[14px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)] p-4 shadow-[0_20px_45px_rgba(35,24,21,0.2)]">
              <img src={slopbotImg} alt="SLOPBOT mascot" className="h-auto w-full" />
            </div>
            <div className="sr-only">Retro robot mascot portrait</div>
          </div>

          <div className="space-y-3 rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-4 text-center shadow-[0_10px_30px_rgba(35,24,21,0.12)] sm:p-5 lg:rounded-[32px] lg:text-left">
            <p className="text-[0.65rem] uppercase tracking-[0.35em] text-[color:var(--accent-blue)] sm:text-xs">Paper 01 · Issue XXXVII</p>
            <h1 className="text-[clamp(2.1rem,6vw,3rem)] font-semibold leading-snug text-[color:var(--ink)] wobbly-underline">
              The Journal of AI Slop™
            </h1>
            <p className="text-base font-serif text-[color:var(--ink-soft)] italic sm:text-lg">All Sarcasm, No Rigour.</p>
            <p className="text-sm text-[color:var(--ink-soft)] sm:text-base">
              A very serious journal for very (un)serious AI co-authored research. We dress like a faculty lounge newsletter and behave like a gremlin scribble on a staff room memo.
            </p>
            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link
                to="/submit"
                data-quirk="true"
                className="button-scale inline-flex w-full items-center justify-center rounded-full border border-[color:var(--coffee)] bg-[color:var(--coffee)] px-6 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--paper)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_25px_rgba(35,24,21,0.3)] sm:w-auto sm:text-sm"
              >
                Submit to the Slop Pipeline
              </Link>
              <Link
                to="/papers"
                className="button-scale inline-flex w-full items-center justify-center rounded-full border border-[color:var(--coffee-light)] bg-transparent px-6 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[color:var(--coffee)] transition-colors duration-200 hover:border-[color:var(--accent-blue)] hover:text-[color:var(--accent-blue)] sm:w-auto sm:text-sm"
              >
                Browse Published Nonsense
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 mx-auto w-full max-w-[1040px] space-y-3">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <h2 className="text-[clamp(1.8rem,5vw,2.5rem)] font-semibold text-[color:var(--ink)]">Latest Published Slop</h2>
          <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[color:var(--ink-soft)] sm:text-sm sm:tracking-[0.35em]">Summoning Review Panel…</p>
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
                  className="group block rounded-[24px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)] p-4 shadow-[0_15px_35px_rgba(35,24,21,0.12)] transition hover:border-[color:var(--accent-blue)] sm:p-5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-semibold text-[color:var(--ink)] paper-title-glow wobbly-underline sm:text-xl">{paper.title}</h3>
                    <span className="self-start rounded-full border border-[color:var(--coffee)] px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--coffee)] sm:self-auto sm:text-xs sm:tracking-[0.35em]">
                      {paper.status.replace("accepted", "PUBLISH NOW")}
                    </span>
                  </div>
                  <p className="relative mt-2 block text-sm italic text-[color:var(--ink-soft)] author-score" data-score={score}>
                    by {paper.authors}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[0.6rem] text-[color:var(--coffee)] sm:text-xs">
                    {paper.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-[color:var(--coffee)] bg-[color:var(--paper)]/70 px-3 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-right text-[0.65rem] text-[color:var(--ink-soft)] sm:text-xs">
                    Submitted on {new Date(paper.submittedAt).toLocaleDateString()}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </section>

    </main>
  );
}
