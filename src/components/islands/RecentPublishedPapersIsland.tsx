import { useEffect, useState } from "react";
import type { PublicPaper } from "@/lib/papersApi";

type PapersResponse = {
  papers: PublicPaper[];
  cursor: string | null;
};

const RECENT_PAPERS_LIMIT = 3;
const REFRESH_INTERVAL_MS = 60000;

const loadRecentPapers = async (): Promise<PublicPaper[]> => {
  const url = new URL("/api/papers", window.location.origin);
  url.searchParams.set("status", "accepted");
  url.searchParams.set("limit", `${RECENT_PAPERS_LIMIT}`);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load recent papers (${response.status})`);
  }

  const body = (await response.json()) as PapersResponse;
  return Array.isArray(body.papers) ? body.papers : [];
};

export default function RecentPublishedPapersIsland() {
  const [papers, setPapers] = useState<PublicPaper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const refreshPapers = async () => {
      try {
        const nextPapers = await loadRecentPapers();
        if (!isActive) {
          return;
        }

        setPapers(nextPapers);
        setError(null);
      } catch (err) {
        if (!isActive) {
          return;
        }

        if (papers.length === 0) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load recent papers right now.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void refreshPapers();
    const intervalId = window.setInterval(() => {
      void refreshPapers();
    }, REFRESH_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [papers.length]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3" aria-live="polite">
        {Array.from({ length: RECENT_PAPERS_LIMIT }).map((_, index) => (
          <div
            key={index}
            className="min-h-[210px] animate-pulse rounded-[8px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)] p-5 shadow-[0_10px_24px_rgba(35,24,21,0.08)]"
          >
            <div className="h-5 w-4/5 rounded bg-[color:var(--coffee-light)]/50" />
            <div className="mt-3 h-3 w-3/5 rounded bg-[color:var(--coffee-light)]/35" />
            <div className="mt-6 h-3 w-2/5 rounded bg-[color:var(--coffee-light)]/35" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-[color:var(--ink-soft)]">
        Unable to load recent papers right now. Please try again shortly.
      </p>
    );
  }

  if (papers.length === 0) {
    return (
      <p className="text-sm text-[color:var(--ink-soft)]">
        No accepted papers yet. The tribunal is still arguing.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3" aria-live="polite">
      {papers.map((paper) => (
        <a
          key={paper._id}
          href={`/papers/${paper._id}`}
          className="group flex min-h-[230px] flex-col rounded-[8px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/80 p-5 shadow-[0_10px_24px_rgba(35,24,21,0.08)] transition hover:-translate-y-0.5 hover:border-[color:var(--accent-blue)] hover:shadow-[0_16px_30px_rgba(35,24,21,0.12)]"
        >
          <p className="mb-4 text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-[color:var(--accent-blue)]">
            Paper
          </p>
          <h3 className="text-lg font-semibold leading-snug text-[color:var(--ink)]">
            {paper.title}
          </h3>
          <p className="mt-3 text-xs italic leading-relaxed text-[color:var(--ink-soft)]">
            {paper.authors}
          </p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[0.68rem] text-[color:var(--ink-soft)]">
            <span>{new Date(paper.submittedAt).toLocaleDateString("en-GB")}</span>
            <span className="font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-blue)]">Read abstract -&gt;</span>
          </div>
        </a>
      ))}
    </div>
  );
}
