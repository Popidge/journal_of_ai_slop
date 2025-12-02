import { useCallback, useEffect, useMemo, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useEcoMode } from "@/hooks/useEcoMode";
import { useEnvironmentalImpact } from "@/hooks/useEnvironmentalImpact";
import { formatTokens, formatCurrency, formatEnergy, formatCo2, tokensToEnergyMWh, tokensToCo2g } from "@/utils/ecoMetrics";

const PAGE_SIZE = 12;

const getSlopScore = () => `Slop Score: ${(Math.random() * 0.8 + 0.1).toFixed(2)}`;

type ReviewVote = {
  agentId: string;
  decision: "publish_now" | "publish_after_edits" | "reject";
  reasoning: string;
  cost: number;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
};

type ModerationSummary = {
  blocked: boolean;
  overallSeverity: number;
  categories: { category: string; severity: number }[];
  reason: string;
  blockedAt: number;
  requestId?: string;
};

type PublicPaper = {
  _id: string;
  _creationTime: number;
  title: string;
  authors: string;
  content: string;
  tags: string[];
  submittedAt: number;
  status: "pending" | "under_review" | "accepted" | "rejected";
  reviewVotes?: ReviewVote[];
  totalReviewCost?: number;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
  moderation?: ModerationSummary;
};

type SlopRecord = {
  slopId: string;
  paperId?: string;
  link: string;
  fromLocalJournal: boolean;
};

type PublicStatus = "accepted" | "rejected";
const statuses: Array<PublicStatus> = ["accepted", "rejected"];

const mapStatus = (status: string) => {
  if (status === "accepted") return "PUBLISH NOW";
  if (status === "rejected") return "REJECTED";
  return status.toUpperCase();
};

export default function PapersList() {
  const convex = useConvex();
  const { ecoMode } = useEcoMode();
  const { energyPerTokenWh, co2PerWh, ready } = useEnvironmentalImpact();
  const [statusFilter, setStatusFilter] = useState<PublicStatus>("accepted");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCache, setPageCache] = useState<Map<number, PublicPaper[]>>(() => new Map());
  const [nextPageCursor, setNextPageCursor] = useState<string | null>(null);
  const [pendingPageIndex, setPendingPageIndex] = useState<number | null>(0);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hasEditorsCommentOnly, setHasEditorsCommentOnly] = useState(false);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    setPageIndex(0);
    setPageCache(new Map());
    setNextPageCursor(null);
    setPendingPageIndex(0);
  }, [statusFilter]);

  useEffect(() => {
    if (pendingPageIndex === null) return;
    const targetPageIndex = pendingPageIndex;
    const cursor = nextPageCursor ?? null;
    let cancelled = false;
    void (async () => {
      try {
        const page = await convex.query(api.papers.listPublicPapersPage, {
          paginationOpts: { numItems: PAGE_SIZE, cursor },
          status: statusFilter,
        });
        if (cancelled) return;
        if (page.papers.length === 0) {
          if (page.cursor === null) {
            setNextPageCursor(null);
            setPendingPageIndex(null);
          } else {
            setNextPageCursor(page.cursor);
          }
          return;
        }
        setPageCache((prev) => {
          const next = new Map(prev);
          next.set(targetPageIndex, page.papers);
          return next;
        });
        setNextPageCursor(page.cursor);
        setPageIndex(targetPageIndex);
        setPendingPageIndex(null);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load papers page", error);
        setPendingPageIndex(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingPageIndex, nextPageCursor, statusFilter, convex]);

  const currentPagePapers = useMemo(() => pageCache.get(pageIndex) ?? [], [pageCache, pageIndex]);
  const isPageLoading = pageCache.size === 0 && pendingPageIndex !== null;
  const hasNextCursor = nextPageCursor !== null;

  const handleNextPage = useCallback(() => {
    if (pendingPageIndex !== null || !hasNextCursor) return;
    const nextIndex = pageCache.size;
    setPendingPageIndex(nextIndex);
  }, [hasNextCursor, pageCache, pendingPageIndex]);

  const handlePrevPage = useCallback(() => {
    if (pageIndex === 0 || pendingPageIndex !== null) return;
    setPageIndex((prev) => Math.max(prev - 1, 0));
  }, [pageIndex, pendingPageIndex]);

  const paperIds = useMemo(() => currentPagePapers.map((paper) => paper._id as Id<"papers">), [currentPagePapers]);
  const slopRecords = useQuery(api.slopId.getByPaperIds, { paperIds });
  const slopByPaperId = useMemo(() => {
    const map = new Map<string, SlopRecord>();
    (slopRecords ?? []).forEach((identifier) => {
      if (identifier.paperId) {
        map.set(identifier.paperId, identifier);
      }
    });
    return map;
  }, [slopRecords]);

  const editorsComments = useQuery(api.editorsComments.getByPaperIds, { paperIds });
  const hasEditorComment = useMemo(() => {
    const map = new Map<string, boolean>();
    (editorsComments ?? []).forEach((comment) => {
      map.set(comment.paperId, true);
    });
    return map;
  }, [editorsComments]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    currentPagePapers.forEach((paper) => paper.tags.forEach((tag: string) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [currentPagePapers]);

  const parsedDateFrom = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : null;
  const parsedDateTo = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : null;
  const normalizedKeywordParts = keyword
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const filteredPapers = useMemo(() => {
    if (currentPagePapers.length === 0) return [];
    const tagsLower = selectedTags.map((tag) => tag.toLowerCase());
    return currentPagePapers.filter((paper) => {
      if (paper.moderation?.blocked) return false;
      if (selectedTags.length > 0) {
        const paperTags = paper.tags.map((tag: string) => tag.toLowerCase());
        const matchesAll = tagsLower.every((tag) => paperTags.includes(tag));
        if (!matchesAll) return false;
      }
      if (parsedDateFrom && paper.submittedAt < parsedDateFrom) {
        return false;
      }
      if (parsedDateTo && paper.submittedAt > parsedDateTo) {
        return false;
      }
      if (hasEditorsCommentOnly && !hasEditorComment.get(paper._id)) {
        return false;
      }
      if (normalizedKeywordParts.length > 0) {
        const haystack = `${paper.title} ${paper.authors} ${paper.content} ${paper.tags.join(" ")}`.toLowerCase();
        const missingTerm = normalizedKeywordParts.some((term) => !haystack.includes(term));
        if (missingTerm) return false;
      }
      return true;
    });
  }, [currentPagePapers, selectedTags, parsedDateFrom, parsedDateTo, hasEditorsCommentOnly, hasEditorComment, normalizedKeywordParts]);

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    setSelectedTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setTagInput("");
  }, [tagInput]);

  const removeTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((existing) => existing !== tag));
  }, []);

  const statusTitle = statusFilter === "accepted" ? "Accepted Papers" : "Rejected Papers";

  return (
    <div className="min-h-screen px-3 py-10 text-[color:var(--ink)] sm:px-4">
      <div className="mx-auto w-full max-w-[1040px] space-y-6">
        <header className="rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 text-center shadow-[0_20px_40px_rgba(35,24,21,0.12)] sm:rounded-[32px] sm:text-left">
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)] sm:text-xs sm:tracking-[0.5em]">Published Slop</p>
          <div className="mt-2 flex flex-col gap-2">
            <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold text-[color:var(--ink)] wobbly-underline">{statusTitle}</h1>
            <p className="text-sm text-[color:var(--ink-soft)]">Only submissions that survived the panel make it into the logbook.</p>
          </div>
          <Link
            to="/submit"
            className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[color:var(--coffee)] bg-[color:var(--coffee-light)] px-6 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--paper)] transition hover:-translate-y-0.5 sm:w-auto sm:text-xs sm:tracking-[0.3em]"
          >
            Submit to the Slop Pipeline
          </Link>
        </header>

        <section className="space-y-4 rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-4 text-sm text-[color:var(--ink-soft)] shadow-[0_15px_35px_rgba(35,24,21,0.12)] sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">Status Filter</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {statuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${
                      statusFilter === status
                        ? "border-[color:var(--accent-blue)] bg-[color:var(--accent-blue)]/10 text-[color:var(--accent-blue)]"
                        : "border-[color:var(--coffee)] text-[color:var(--coffee)]"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">Tags</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  list="papers-tags"
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addTag())}
                  placeholder="Add tag"
                  className="flex-1 rounded-full border border-[color:var(--coffee)] bg-[color:var(--paper)]/80 px-3 py-1 text-[0.75rem] text-[color:var(--ink)]"
                />
                <button
                  type="button"
                  onClick={addTag}
                  disabled={!tagInput.trim()}
                  className="rounded-full border border-[color:var(--coffee)] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--coffee)] disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              <datalist id="papers-tags">
                {availableTags.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="flex items-center gap-1 rounded-full border border-[color:var(--accent-blue)] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--accent-blue)]"
                  >
                    {tag}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">Submitted From</p>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-2 w-full rounded-full border border-[color:var(--coffee)] bg-[color:var(--paper)]/80 px-3 py-1 text-[0.75rem] text-[color:var(--ink)]"
              />
            </div>

            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">Submitted Until</p>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-2 w-full rounded-full border border-[color:var(--coffee)] bg-[color:var(--paper)]/80 px-3 py-1 text-[0.75rem] text-[color:var(--ink)]"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="editor-comments-filter"
                type="checkbox"
                checked={hasEditorsCommentOnly}
                onChange={(event) => setHasEditorsCommentOnly(event.target.checked)}
                className="h-4 w-4 rounded border-[color:var(--coffee)] bg-[color:var(--paper)] text-[color:var(--coffee)]"
              />
              <label htmlFor="editor-comments-filter" className="text-[0.7rem] uppercase tracking-[0.25em] text-[color:var(--ink-soft)]">
                Only show papers with editor comments
              </label>
            </div>

            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">Keyword search</p>
              <input
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Search title, authors, content, tags"
                className="mt-2 w-full rounded-full border border-[color:var(--coffee)] bg-[color:var(--paper)]/80 px-3 py-1 text-[0.75rem] text-[color:var(--ink)]"
              />
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {isPageLoading ? (
            <div className="flex flex-col items-center gap-3 rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/95 p-6 text-center shadow-[0_15px_35px_rgba(35,24,21,0.12)]">
              <div className="question-spinner" aria-hidden="true" />
              <p className="text-sm text-[color:var(--ink-soft)]">Summoning Review Panel…</p>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)]">Warming up the coffee rings.</p>
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/95 p-6 text-center text-sm text-[color:var(--ink-soft)] shadow-[0_15px_35px_rgba(35,24,21,0.12)]">
              No {statusFilter} slop matches the current filters. Try adjusting the keywords or dates.
            </div>
          ) : (
            filteredPapers.map((paper) => {
              const statusLabel = mapStatus(paper.status);
              const score = getSlopScore();
              const tokens =
                paper.totalTokens ??
                paper.reviewVotes?.reduce((sum: number, vote: ReviewVote | undefined) => sum + (vote?.totalTokens ?? 0), 0) ??
                0;
              const hasTokenData =
                paper.totalTokens != null || (paper.reviewVotes && paper.reviewVotes.length > 0);
              const energy = tokensToEnergyMWh(tokens, energyPerTokenWh);
              const co2 = tokensToCo2g(tokens, energyPerTokenWh, co2PerWh);
              const slopRecord = slopByPaperId.get(paper._id);
              const slopHref = slopRecord ? (slopRecord.fromLocalJournal ? `/${slopRecord.link}` : slopRecord.link) : null;
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
                    {paper.tags.map((tag: string) => (
                      <span key={tag} className="rounded-full border border-[color:var(--coffee)] bg-[color:var(--paper)]/80 px-3 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-col gap-2 text-[0.7rem] text-[color:var(--ink-soft)] sm:flex-row sm:items-center sm:justify-between">
                    <p>Submitted on {new Date(paper.submittedAt).toLocaleDateString()}</p>
                    {ecoMode ? (
                      <>
                        <p>Energy: {ready && hasTokenData ? formatEnergy(energy) : "Calculating energy..."}</p>
                        <p>CO₂: {ready && hasTokenData ? formatCo2(co2) : "Calculating impact..."}</p>
                      </>
                    ) : (
                      <>
                        <p>
                          Review cost: {paper.totalReviewCost != null ? formatCurrency(paper.totalReviewCost) : "Calculating..."}
                        </p>
                        <p>Tokens: {hasTokenData ? formatTokens(tokens) : "Calculating..."}</p>
                      </>
                    )}
                  </div>
                  {slopRecord && slopHref && (
                    <p className="mt-2 text-[0.65rem] text-[color:var(--coffee)]">
                      Slop ID:&nbsp;
                      <a href={slopHref} className="font-mono underline decoration-[color:var(--coffee)] text-[color:var(--accent-blue)]">
                        {slopRecord.slopId}
                      </a>
                    </p>
                  )}
                </Link>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 px-4 py-3 text-[0.75rem] text-[color:var(--ink-soft)] shadow-[0_15px_35px_rgba(35,24,21,0.12)] sm:px-6">
          <span>Page {pageIndex + 1}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={pageIndex === 0 || pendingPageIndex !== null}
              className="rounded-full border border-[color:var(--coffee)] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--coffee)] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={!hasNextCursor || pendingPageIndex !== null}
              className="rounded-full border border-[color:var(--coffee)] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--coffee)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="text-center text-[color:var(--ink-soft)]">
          <Link to="/" className="underline decoration-[color:var(--coffee)]">← Back to The Journal of AI Slop™</Link>
        </div>
      </div>
    </div>
  );
}
