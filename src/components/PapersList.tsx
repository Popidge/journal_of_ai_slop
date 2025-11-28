import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

const getSlopScore = () => `Slop Score: ${(Math.random() * 0.8 + 0.1).toFixed(2)}`;

const mapStatus = (status: string) => {
  if (status === "accepted") return "PUBLISH NOW";
  if (status === "rejected") return "REJECTED";
  return status.toUpperCase();
};

export default function PapersList() {
  const papers = useQuery(api.papers.listPapers, { status: "accepted", limit: 50 });

  return (
    <div className="min-h-screen px-3 py-10 text-[color:var(--ink)] sm:px-4">
      <div className="mx-auto w-full max-w-[1040px] space-y-8">
        <header className="rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 text-center shadow-[0_20px_40px_rgba(35,24,21,0.12)] sm:rounded-[32px] sm:text-left">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)] sm:text-xs sm:tracking-[0.5em]">Published Slop</p>
          <div className="mt-2 flex flex-col gap-2">
            <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold text-[color:var(--ink)] wobbly-underline">Accepted Papers</h1>
            <p className="text-sm text-[color:var(--ink-soft)]">Only submissions that survived the panel make it into the logbook.</p>
          </div>
          <Link
            to="/submit"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[color:var(--coffee)] bg-[color:var(--coffee-light)] px-6 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--paper)] transition hover:-translate-y-0.5 sm:w-auto sm:text-xs sm:tracking-[0.3em]"
          >
            Submit to the Slop Pipeline
          </Link>
        </header>

        <div className="space-y-4">
          {papers === undefined ? (
            <div className="flex flex-col items-center gap-3 rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/95 p-6 text-center shadow-[0_15px_35px_rgba(35,24,21,0.12)]">
              <div className="question-spinner" aria-hidden="true" />
              <p className="text-sm text-[color:var(--ink-soft)]">Summoning Review Panel…</p>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">Warming up the coffee rings.</p>
            </div>
          ) : papers.length === 0 ? (
            <div className="rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/95 p-6 text-center text-sm text-[color:var(--ink-soft)] shadow-[0_15px_35px_rgba(35,24,21,0.12)]">
              No accepted slop yet. The reviewers must be napping.
            </div>
          ) : (
            papers.map((paper) => {
              const statusLabel = mapStatus(paper.status);
              const score = getSlopScore();
              return (
                <Link
                  key={paper._id}
                  to={`/papers/${paper._id}`}
                  className="group block rounded-[24px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-4 shadow-[0_15px_35px_rgba(35,24,21,0.12)] transition hover:border-[color:var(--accent-blue)] sm:rounded-[28px] sm:p-6"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-[color:var(--ink)] paper-title-glow wobbly-underline sm:text-2xl">{paper.title}</h2>
                      <p className="relative mt-1 block text-sm italic text-[color:var(--ink-soft)] author-score" data-score={score}>
                        by {paper.authors}
                      </p>
                    </div>
                    <span className="self-start rounded-full border border-[color:var(--coffee)] px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--coffee)] sm:self-auto sm:text-[0.6rem] sm:tracking-[0.35em]">
                      {statusLabel}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[0.6rem] text-[color:var(--coffee)] sm:text-[0.65rem]">
                    {paper.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-[color:var(--coffee)] bg-[color:var(--paper)]/80 px-3 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-2 text-[0.7rem] text-[color:var(--ink-soft)] sm:flex-row sm:items-center sm:justify-between">
                    <p>Submitted on {new Date(paper.submittedAt).toLocaleDateString()}</p>
                    <p>
                      Review cost: {paper.totalReviewCost != null ? `${paper.totalReviewCost.toFixed(4)}` : "Calculating..."}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        <div className="text-center text-[color:var(--ink-soft)]">
          <Link to="/" className="underline decoration-[color:var(--coffee)]">← Back to The Journal of AI Slop™</Link>
        </div>
      </div>
    </div>
  );
}
