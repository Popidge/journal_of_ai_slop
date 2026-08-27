import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchPaperById,
  fetchPapersPage,
  type PublicPaper,
  type PublicPaperStatus,
} from "@/lib/papersApi";
import {
  AVAILABLE_TAGS,
  CONTENT_CHARACTER_LIMIT,
  emptySubmissionDraft,
  includesLlmAuthor,
  isAvailableTag,
  writeResearchDeskDraft,
  type ResearchDeskDraft,
} from "@/lib/submissionDraft";
import {
  emptyObjectSchema,
  registerWebMcpTools,
  type WebMcpTool,
} from "@/lib/webmcp";
import {
  formatCo2,
  formatCurrency,
  formatEnergy,
  formatTokens,
  tokensToCo2g,
  tokensToEnergyMWh,
} from "@/utils/ecoMetrics";

const MAX_DESK_PAPERS = 4;
const DEFAULT_RESULT_LIMIT = 12;

type SearchStatus = PublicPaperStatus | "all";

type WebMcpState = {
  supported: boolean;
  registered: number;
  ready: boolean;
  error: string | null;
};

type Activity = {
  label: string;
  detail: string;
};

type Props = {
  initialPapers: PublicPaper[];
  energyPerTokenWh: number;
  co2PerWh: number;
};

const emptyDeskDraft = (): ResearchDeskDraft => ({
  ...emptySubmissionDraft(),
  sourcePaperIds: [],
  preparedAt: Date.now(),
});

const normalizeString = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeStringArray = (
  value: unknown,
  maxItems: number,
): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems)
    : [];

const getPaperAbstract = (paper: PublicPaper): string => {
  const abstract = paper.renderMetadata?.abstract?.trim();
  if (abstract) {
    return abstract;
  }

  return paper.content
    .replace(/[#*_`[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
};

const getPaperTokens = (paper: PublicPaper): number =>
  paper.totalTokens ??
  paper.reviewVotes?.reduce(
    (sum, review) => sum + (review.totalTokens ?? 0),
    0,
  ) ??
  0;

const getVoteCounts = (paper: PublicPaper) => {
  const votes = paper.reviewVotes ?? [];
  return {
    publishNow: votes.filter((vote) => vote.decision === "publish_now").length,
    publishAfterEdits: votes.filter(
      (vote) => vote.decision === "publish_after_edits",
    ).length,
    reject: votes.filter((vote) => vote.decision === "reject").length,
  };
};

const paperToSearchResult = (paper: PublicPaper) => ({
  paperId: paper._id,
  title: paper.title,
  authors: paper.authors,
  status: paper.status,
  tags: paper.tags,
  abstract: getPaperAbstract(paper),
  totalReviewCost: paper.totalReviewCost ?? 0,
  totalTokens: getPaperTokens(paper),
  href: `/papers/${paper._id}`,
});

const paperToDossier = (paper: PublicPaper) => ({
  ...paperToSearchResult(paper),
  content: paper.content,
  sections: paper.renderMetadata?.sections ?? [],
  editorComment: paper.editorComment ?? null,
  reviewVotes: paper.reviewVotes ?? [],
  voteCounts: getVoteCounts(paper),
});

const parseSearchStatus = (value: unknown): SearchStatus =>
  value === "accepted" || value === "rejected" || value === "all"
    ? value
    : "all";

export default function ResearchDeskIsland({
  initialPapers,
  energyPerTokenWh,
  co2PerWh,
}: Props) {
  const [results, setResults] = useState(initialPapers);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("all");
  const [tag, setTag] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPapers, setSelectedPapers] = useState<PublicPaper[]>([]);
  const [draft, setDraft] = useState<ResearchDeskDraft>(emptyDeskDraft);
  const [activity, setActivity] = useState<Activity>({
    label: "Desk opened",
    detail: "The archive is ready for a human or agent to start pinning papers.",
  });
  const [webMcp, setWebMcp] = useState<WebMcpState>({
    supported: false,
    registered: 0,
    ready: false,
    error: null,
  });

  const selectedRef = useRef(selectedPapers);
  const resultsRef = useRef(results);
  const draftRef = useRef(draft);

  useEffect(() => {
    selectedRef.current = selectedPapers;
  }, [selectedPapers]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = params
      .get("papers")
      ?.split(",")
      .map((paperId) => paperId.trim())
      .filter(Boolean)
      .slice(0, MAX_DESK_PAPERS);

    if (!ids?.length) {
      return;
    }

    void Promise.all(
      ids.map((paperId) =>
        fetchPaperById({ origin: window.location.origin, id: paperId }),
      ),
    ).then((papers) => {
      setSelectedPapers(
        papers.filter((paper): paper is PublicPaper => paper !== null),
      );
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = selectedPapers.map((paper) => paper._id);
    if (ids.length > 0) {
      params.set("papers", ids.join(","));
    } else {
      params.delete("papers");
    }

    const search = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${search ? `?${search}` : ""}`,
    );
  }, [selectedPapers]);

  const performSearch = useCallback(
    async (input: {
      query?: unknown;
      status?: unknown;
      tags?: unknown;
      limit?: unknown;
    }) => {
      const normalizedQuery = normalizeString(input.query, 180);
      const normalizedStatus = parseSearchStatus(input.status);
      const normalizedTags = normalizeStringArray(input.tags, 5).filter(
        isAvailableTag,
      );
      const requestedLimit =
        typeof input.limit === "number" && Number.isFinite(input.limit)
          ? Math.floor(input.limit)
          : DEFAULT_RESULT_LIMIT;
      const limit = Math.min(Math.max(requestedLimit, 1), 20);
      const statuses: PublicPaperStatus[] =
        normalizedStatus === "all"
          ? ["accepted", "rejected"]
          : [normalizedStatus];

      setIsSearching(true);
      setQuery(normalizedQuery);
      setStatus(normalizedStatus);
      setTag(normalizedTags[0] ?? "");

      try {
        const pages = await Promise.all(
          statuses.map((paperStatus) =>
            fetchPapersPage({
              origin: window.location.origin,
              status: paperStatus,
              query: normalizedQuery,
              limit: 50,
            }),
          ),
        );
        const unique = new Map<string, PublicPaper>();
        for (const page of pages) {
          for (const paper of page.papers) {
            if (
              normalizedTags.length === 0 ||
              normalizedTags.every((selectedTag) =>
                paper.tags.includes(selectedTag),
              )
            ) {
              unique.set(paper._id, paper);
            }
          }
        }

        const nextResults = [...unique.values()]
          .sort((a, b) => b.submittedAt - a.submittedAt)
          .slice(0, limit);
        setResults(nextResults);
        setActivity({
          label: "Archive searched",
          detail: `${nextResults.length} paper${nextResults.length === 1 ? "" : "s"} placed in the visible results tray.`,
        });

        return {
          query: normalizedQuery,
          status: normalizedStatus,
          tags: normalizedTags,
          resultCount: nextResults.length,
          results: nextResults.map(paperToSearchResult),
          visibleInPage: true,
        };
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  const readPaperDossier = useCallback(async (paperIdValue: unknown) => {
    const paperId = normalizeString(paperIdValue, 80);
    if (!paperId) {
      throw new Error("A paperId is required.");
    }

    const localPaper = [...selectedRef.current, ...resultsRef.current].find(
      (paper) => paper._id === paperId,
    );
    const paper =
      localPaper ??
      (await fetchPaperById({ origin: window.location.origin, id: paperId }));
    if (!paper) {
      throw new Error(`Paper ${paperId} is not publicly available.`);
    }

    setActivity({
      label: "Dossier opened",
      detail: `The agent inspected “${paper.title}” without changing the desk.`,
    });
    return paperToDossier(paper);
  }, []);

  const setResearchDesk = useCallback(
    async (paperIdsValue: unknown, modeValue: unknown) => {
      const requestedIds = normalizeStringArray(
        paperIdsValue,
        MAX_DESK_PAPERS,
      );
      if (requestedIds.length === 0) {
        throw new Error("Provide at least one paperId.");
      }

      const mode = modeValue === "add" ? "add" : "replace";
      const startingPapers = mode === "add" ? selectedRef.current : [];
      const nextById = new Map(
        startingPapers.map((paper) => [paper._id, paper]),
      );

      for (const paperId of requestedIds) {
        if (nextById.size >= MAX_DESK_PAPERS) {
          break;
        }
        const localPaper = resultsRef.current.find(
          (paper) => paper._id === paperId,
        );
        const paper =
          localPaper ??
          (await fetchPaperById({
            origin: window.location.origin,
            id: paperId,
          }));
        if (paper) {
          nextById.set(paper._id, paper);
        }
      }

      const nextPapers = [...nextById.values()].slice(0, MAX_DESK_PAPERS);
      setSelectedPapers(nextPapers);
      setActivity({
        label: "Desk rearranged",
        detail: `${nextPapers.length} paper${nextPapers.length === 1 ? " is" : "s are"} now pinned for comparison.`,
      });

      return {
        mode,
        deskSize: nextPapers.length,
        maxDeskSize: MAX_DESK_PAPERS,
        papers: nextPapers.map(paperToSearchResult),
        visibleInPage: true,
      };
    },
    [],
  );

  const compareResearchDesk = useCallback(async () => {
    const papers = selectedRef.current;
    if (papers.length < 2) {
      throw new Error("Pin at least two papers before comparing the desk.");
    }

    const totalTokens = papers.reduce(
      (sum, paper) => sum + getPaperTokens(paper),
      0,
    );
    const totalCost = papers.reduce(
      (sum, paper) => sum + (paper.totalReviewCost ?? 0),
      0,
    );

    document
      .getElementById("desk-comparison")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActivity({
      label: "Desk compared",
      detail: `A structured comparison of ${papers.length} papers is visible below.`,
    });

    return {
      paperCount: papers.length,
      aggregate: {
        totalReviewCost: totalCost,
        totalTokens,
        accepted: papers.filter((paper) => paper.status === "accepted").length,
        rejected: papers.filter((paper) => paper.status === "rejected").length,
      },
      papers: papers.map((paper) => ({
        ...paperToSearchResult(paper),
        voteCounts: getVoteCounts(paper),
        reviewerReasoning:
          paper.reviewVotes?.map((vote) => ({
            model: vote.agentId,
            decision: vote.decision,
            reasoning: vote.reasoning,
          })) ?? [],
      })),
      visibleInPage: true,
    };
  }, []);

  const prepareSubmissionDraft = useCallback(
    async (input: Record<string, unknown>) => {
      const title = normalizeString(input.title, 300);
      const authors = normalizeString(input.authors, 500);
      const content = normalizeString(
        input.content,
        CONTENT_CHARACTER_LIMIT,
      );
      const tags = normalizeStringArray(input.tags, AVAILABLE_TAGS.length).filter(
        isAvailableTag,
      );
      const requestedSources = normalizeStringArray(
        input.sourcePaperIds,
        MAX_DESK_PAPERS,
      );
      const deskIds = new Set(selectedRef.current.map((paper) => paper._id));
      const sourcePaperIds = (
        requestedSources.length > 0
          ? requestedSources.filter((paperId) => deskIds.has(paperId))
          : [...deskIds]
      ).slice(0, MAX_DESK_PAPERS);

      if (!title || !authors || !content) {
        throw new Error("title, authors, and content are required.");
      }
      if (!includesLlmAuthor(authors)) {
        throw new Error(
          "authors must credit at least one supported AI model, such as GPT, Claude, Gemini, or Kimi.",
        );
      }
      if (tags.length === 0) {
        throw new Error(
          `Choose at least one valid tag: ${AVAILABLE_TAGS.join(", ")}.`,
        );
      }

      const nextDraft: ResearchDeskDraft = {
        title,
        authors,
        content,
        tags,
        sourcePaperIds,
        preparedAt: Date.now(),
      };
      setDraft(nextDraft);
      document
        .getElementById("desk-draft")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActivity({
        label: "Draft prepared",
        detail:
          "The agent placed a complete draft in the visible co-authoring pad. Nothing has been submitted.",
      });

      return {
        prepared: true,
        title,
        authors,
        tags,
        characterCount: content.length,
        sourcePaperIds,
        submitted: false,
        nextHumanStep:
          "Review the visible draft, choose Take draft to submission, then personally accept the pinky-swear terms and submit.",
      };
    },
    [],
  );

  useEffect(() => {
    let unregister = () => undefined;
    const tools: WebMcpTool[] = [
      {
        name: "search_slop_archive",
        title: "Search the slop archive",
        description:
          "Search public accepted and rejected Journal papers. Results are returned and rendered in the visible archive tray.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              maxLength: 180,
              description:
                "Words to find in paper titles, authors, tags, or content. Leave empty to browse recent papers.",
            },
            status: {
              type: "string",
              enum: ["all", "accepted", "rejected"],
              description: "Limit results by tribunal outcome.",
            },
            tags: {
              type: "array",
              maxItems: 5,
              items: { type: "string", enum: [...AVAILABLE_TAGS] },
              description: "Require all selected Journal tags.",
            },
            limit: { type: "integer", minimum: 1, maximum: 20 },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input) => performSearch(input),
      },
      {
        name: "read_paper_dossier",
        title: "Read a paper dossier",
        description:
          "Read one public paper with its content, sections, bot verdicts, editor comment, cost, and token totals. This does not change the desk.",
        inputSchema: {
          type: "object",
          properties: {
            paperId: {
              type: "string",
              minLength: 20,
              maxLength: 80,
              description: "A Journal paper identifier returned by search.",
            },
          },
          required: ["paperId"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input) => readPaperDossier(input.paperId),
      },
      {
        name: "set_research_desk",
        title: "Pin papers to the research desk",
        description:
          "Place up to four public papers on the shared visible comparison desk. Use replace to start over or add to preserve current papers.",
        inputSchema: {
          type: "object",
          properties: {
            paperIds: {
              type: "array",
              minItems: 1,
              maxItems: MAX_DESK_PAPERS,
              items: { type: "string", minLength: 20, maxLength: 80 },
            },
            mode: { type: "string", enum: ["replace", "add"] },
          },
          required: ["paperIds"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) =>
          setResearchDesk(input.paperIds, input.mode),
      },
      {
        name: "compare_research_desk",
        title: "Compare the research desk",
        description:
          "Compare the papers currently pinned on the shared desk, including tribunal reasoning, outcome, cost, and token totals, and reveal the visible comparison panel.",
        inputSchema: emptyObjectSchema,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: compareResearchDesk,
      },
      {
        name: "prepare_slop_submission",
        title: "Prepare a submission draft",
        description:
          "Place a complete co-authored paper draft in the visible Research Desk editor. This never accepts terms or submits the paper; the human must review and complete those steps.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 300 },
            authors: {
              type: "string",
              minLength: 1,
              maxLength: 500,
              description:
                "Author line that explicitly credits at least one AI model.",
            },
            content: {
              type: "string",
              minLength: 1,
              maxLength: CONTENT_CHARACTER_LIMIT,
              description: "The full Markdown paper body.",
            },
            tags: {
              type: "array",
              minItems: 1,
              maxItems: AVAILABLE_TAGS.length,
              items: { type: "string", enum: [...AVAILABLE_TAGS] },
            },
            sourcePaperIds: {
              type: "array",
              maxItems: MAX_DESK_PAPERS,
              items: { type: "string", minLength: 20, maxLength: 80 },
              description:
                "Optional source papers already pinned on the desk.",
            },
          },
          required: ["title", "authors", "content", "tags"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: prepareSubmissionDraft,
      },
    ];

    void registerWebMcpTools(tools)
      .then((registration) => {
        unregister = registration.unregister;
        setWebMcp({
          supported: registration.supported,
          registered: registration.registered,
          ready: true,
          error: null,
        });
      })
      .catch((error) => {
        setWebMcp({
          supported: true,
          registered: 0,
          ready: true,
          error:
            error instanceof Error ? error.message : "Registration failed",
        });
      });

    return () => unregister();
  }, [
    compareResearchDesk,
    performSearch,
    prepareSubmissionDraft,
    readPaperDossier,
    setResearchDesk,
  ]);

  const totalDeskTokens = useMemo(
    () => selectedPapers.reduce((sum, paper) => sum + getPaperTokens(paper), 0),
    [selectedPapers],
  );
  const totalDeskCost = useMemo(
    () =>
      selectedPapers.reduce(
        (sum, paper) => sum + (paper.totalReviewCost ?? 0),
        0,
      ),
    [selectedPapers],
  );

  const togglePaper = (paper: PublicPaper) => {
    const isSelected = selectedPapers.some(
      (selectedPaper) => selectedPaper._id === paper._id,
    );
    const nextPapers = isSelected
      ? selectedPapers.filter(
          (selectedPaper) => selectedPaper._id !== paper._id,
        )
      : [...selectedPapers, paper].slice(0, MAX_DESK_PAPERS);
    setSelectedPapers(nextPapers);
    setActivity({
      label: isSelected ? "Paper unpinned" : "Paper pinned",
      detail: `“${paper.title}” ${isSelected ? "left" : "joined"} the visible desk.`,
    });
  };

  const seedDraft = () => {
    const sourceLines = selectedPapers
      .map((paper) => `- ${paper.title} (${paper._id})`)
      .join("\n");
    setDraft({
      title: "",
      authors: "",
      tags: ["Pseudo academic"],
      sourcePaperIds: selectedPapers.map((paper) => paper._id),
      preparedAt: Date.now(),
      content: `# Abstract\n\nDescribe the extremely defensible finding.\n\n## Prior slop consulted\n\n${sourceLines || "- No papers pinned yet."}\n\n## Method\n\nExplain the methodology with suspicious confidence.\n\n## Results\n\nReport findings that survive at least three bots.\n\n## Conclusion\n\nConclude more than the evidence permits.`,
    });
    document
      .getElementById("desk-draft")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const takeDraftToSubmission = () => {
    const nextDraft = { ...draftRef.current, preparedAt: Date.now() };
    writeResearchDeskDraft(nextDraft);
    window.location.assign("/submit?from=research-desk");
  };

  const runManualSearch = () => {
    void performSearch({
      query,
      status,
      tags: tag ? [tag] : [],
      limit: DEFAULT_RESULT_LIMIT,
    });
  };

  const webMcpLabel = !webMcp.ready
    ? "Checking site tools…"
    : webMcp.error
      ? "Site tools need attention"
      : webMcp.supported
        ? `${webMcp.registered} desk tools live`
        : "Manual desk mode";

  return (
    <main className="min-h-screen px-3 py-6 text-[color:var(--ink)] sm:px-5 sm:py-10">
      <div className="mx-auto w-full max-w-[1320px] space-y-6">
        <section className="overflow-hidden rounded-[24px] border border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--paper)] shadow-[0_24px_60px_rgba(35,24,21,0.25)] sm:rounded-[32px]">
          <div className="grid gap-0 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="p-6 sm:p-9 lg:p-11">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[color:var(--coffee-light)]/60 bg-[color:var(--paper)]/10 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.24em]">
                  Human + agent workspace
                </span>
                <span className="flex items-center gap-2 text-[0.68rem] text-[color:var(--paper)]/75">
                  <span
                    className={`h-2 w-2 rounded-full ${webMcp.supported && !webMcp.error ? "bg-emerald-300" : "bg-[color:var(--coffee-light)]"}`}
                  />
                  {webMcpLabel}
                </span>
              </div>
              <p className="mt-8 text-[0.68rem] font-semibold uppercase tracking-[0.4em] text-[color:var(--coffee-light)]">
                Crom's Research Desk
              </p>
              <h1 className="mt-3 max-w-4xl text-[clamp(2.8rem,7vw,5.8rem)] font-semibold leading-[0.94]">
                Don&apos;t browse the slop alone.
              </h1>
              <p className="mt-6 max-w-2xl font-serif text-base leading-8 text-[color:var(--paper)]/80 sm:text-lg">
                Search the archive with an agent, pin competing ideas to the
                same desk, inspect the tribunal&apos;s reasoning, and co-author the
                next regrettable contribution in full view.
              </p>
            </div>
            <div className="border-t border-[color:var(--paper)]/15 bg-[color:var(--paper)]/5 p-6 lg:border-l lg:border-t-0 lg:p-8">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--coffee-light)]">
                Ask Codex
              </p>
              <blockquote className="mt-5 border-l-2 border-[color:var(--accent-blue)] pl-4 font-mono text-sm leading-7 text-[color:var(--paper)]/90">
                “Find rejected papers about model collapse. Pin the three most
                interesting, compare why the bots hated them, then prepare a
                new meta-paper that answers their reviewers.”
              </blockquote>
              <div className="mt-8 grid grid-cols-2 gap-3 text-[0.62rem] uppercase tracking-[0.2em] text-[color:var(--paper)]/65">
                {[
                  ["01", "Search"],
                  ["02", "Pin"],
                  ["03", "Compare"],
                  ["04", "Draft"],
                ].map(([number, label]) => (
                  <div
                    key={number}
                    className="rounded-xl border border-[color:var(--paper)]/15 p-3"
                  >
                    <span className="text-[color:var(--coffee-light)]">
                      {number}
                    </span>{" "}
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <div className="rounded-[24px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 shadow-[0_15px_35px_rgba(35,24,21,0.1)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--coffee)]">
                    Archive tray
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    Find useful nonsense
                  </h2>
                </div>
                <p className="text-xs text-[color:var(--ink-soft)]">
                  {results.length} visible result
                  {results.length === 1 ? "" : "s"}
                </p>
              </div>
              <form
                className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_170px_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  runManualSearch();
                }}
              >
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="model collapse, citation salad…"
                  className="rounded-full border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-2.5 text-sm focus:border-[color:var(--accent-blue)] focus:outline-none"
                />
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as SearchStatus)
                  }
                  className="rounded-full border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-2.5 text-sm focus:border-[color:var(--accent-blue)] focus:outline-none"
                >
                  <option value="all">All verdicts</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  className="rounded-full border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-2.5 text-sm focus:border-[color:var(--accent-blue)] focus:outline-none"
                >
                  <option value="">Any tag</option>
                  {AVAILABLE_TAGS.map((availableTag) => (
                    <option key={availableTag} value={availableTag}>
                      {availableTag}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="rounded-full bg-[color:var(--coffee)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--paper)] disabled:opacity-50"
                >
                  {isSearching ? "Rummaging…" : "Search"}
                </button>
              </form>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {results.map((paper) => {
                const isSelected = selectedPapers.some(
                  (selectedPaper) => selectedPaper._id === paper._id,
                );
                return (
                  <article
                    key={paper._id}
                    className={`flex min-h-[285px] flex-col rounded-[22px] border bg-[color:var(--paper)]/90 p-5 shadow-[0_12px_28px_rgba(35,24,21,0.08)] transition ${
                      isSelected
                        ? "border-[color:var(--accent-blue)] ring-2 ring-[color:var(--accent-blue)]/15"
                        : "border-[color:var(--coffee-light)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full border border-[color:var(--coffee-light)] px-2.5 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--coffee)]">
                        {paper.status}
                      </span>
                      <span className="text-[0.62rem] text-[color:var(--ink-soft)]">
                        {formatTokens(getPaperTokens(paper))} tokens
                      </span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold leading-tight">
                      {paper.title}
                    </h3>
                    <p className="mt-2 text-xs italic text-[color:var(--ink-soft)]">
                      by {paper.authors}
                    </p>
                    <p className="mt-4 line-clamp-4 font-serif text-sm leading-6 text-[color:var(--ink-soft)]">
                      {getPaperAbstract(paper)}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <a
                        href={`/papers/${paper._id}`}
                        className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-blue)] underline underline-offset-4"
                      >
                        Read dossier
                      </a>
                      <button
                        type="button"
                        onClick={() => togglePaper(paper)}
                        disabled={
                          !isSelected &&
                          selectedPapers.length >= MAX_DESK_PAPERS
                        }
                        className={`rounded-full px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          isSelected
                            ? "border border-[color:var(--accent-blue)] text-[color:var(--accent-blue)]"
                            : "bg-[color:var(--ink)] text-[color:var(--paper)]"
                        }`}
                      >
                        {isSelected ? "Unpin" : "Pin to desk"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
            <div className="rounded-[24px] border border-[color:var(--coffee)] bg-[color:var(--paper)]/95 p-5 shadow-[0_18px_40px_rgba(35,24,21,0.14)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--coffee)]">
                    Shared desk
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    {selectedPapers.length}/{MAX_DESK_PAPERS} papers pinned
                  </h2>
                </div>
                <span className="rounded-full bg-[color:var(--accent-blue)]/10 px-3 py-1 font-mono text-xs text-[color:var(--accent-blue)]">
                  live
                </span>
              </div>

              {selectedPapers.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--coffee-light)] p-5 text-center text-sm text-[color:var(--ink-soft)]">
                  Pin papers yourself or ask the agent to arrange the desk.
                </div>
              ) : (
                <ol className="mt-5 space-y-3">
                  {selectedPapers.map((paper, index) => (
                    <li
                      key={paper._id}
                      className="flex gap-3 rounded-2xl border border-[color:var(--coffee-light)]/70 p-3"
                    >
                      <span className="font-mono text-xs text-[color:var(--accent-blue)]">
                        0{index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-5">
                          {paper.title}
                        </p>
                        <p className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--ink-soft)]">
                          {paper.status} · {paper.reviewVotes?.length ?? 0} bots
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePaper(paper)}
                        aria-label={`Remove ${paper.title} from desk`}
                        className="h-7 w-7 rounded-full border border-[color:var(--coffee-light)] text-sm text-[color:var(--coffee)]"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-[color:var(--coffee-light)]/15 p-4 text-xs">
                <div>
                  <p className="uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                    Review cost
                  </p>
                  <p className="mt-1 font-mono font-semibold">
                    {formatCurrency(totalDeskCost, 6)}
                  </p>
                </div>
                <div>
                  <p className="uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                    Tokens
                  </p>
                  <p className="mt-1 font-mono font-semibold">
                    {formatTokens(totalDeskTokens)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={selectedPapers.length < 2}
                onClick={() => void compareResearchDesk()}
                className="mt-4 w-full rounded-full bg-[color:var(--accent-blue)] px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Compare this desk
              </button>
            </div>

            <div className="rounded-[20px] border border-dashed border-[color:var(--coffee-light)] bg-[color:var(--paper)]/70 p-4">
              <p className="text-[0.58rem] font-semibold uppercase tracking-[0.28em] text-[color:var(--coffee)]">
                Latest shared activity
              </p>
              <p className="mt-2 text-sm font-semibold">{activity.label}</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--ink-soft)]">
                {activity.detail}
              </p>
            </div>
          </aside>
        </section>

        <section
          id="desk-comparison"
          className="scroll-mt-5 rounded-[24px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 shadow-[0_18px_40px_rgba(35,24,21,0.1)] sm:p-7"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--coffee)]">
                Tribunal comparison
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                Same desk, incompatible realities
              </h2>
            </div>
            <p className="text-xs text-[color:var(--ink-soft)]">
              Cost, carbon, and bot prejudice side by side.
            </p>
          </div>

          {selectedPapers.length < 2 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[color:var(--coffee-light)] p-8 text-center text-sm text-[color:var(--ink-soft)]">
              Pin at least two papers to reveal the comparison matrix.
            </div>
          ) : (
            <div
              className={`mt-6 grid gap-4 ${
                selectedPapers.length === 2
                  ? "md:grid-cols-2"
                  : selectedPapers.length === 3
                    ? "md:grid-cols-3"
                    : "md:grid-cols-2 xl:grid-cols-4"
              }`}
            >
              {selectedPapers.map((paper) => {
                const votes = getVoteCounts(paper);
                const tokens = getPaperTokens(paper);
                return (
                  <article
                    key={paper._id}
                    className="rounded-[20px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--accent-blue)]">
                        {paper.status}
                      </span>
                      <span className="font-mono text-[0.6rem] text-[color:var(--ink-soft)]">
                        {paper._id.slice(0, 7)}…
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold leading-tight">
                      {paper.title}
                    </h3>
                    <p className="mt-3 line-clamp-5 font-serif text-xs leading-5 text-[color:var(--ink-soft)]">
                      {getPaperAbstract(paper)}
                    </p>
                    <dl className="mt-5 space-y-2 border-t border-[color:var(--coffee-light)]/60 pt-4 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt>Publish now</dt>
                        <dd className="font-mono">{votes.publishNow}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Publish after edits</dt>
                        <dd className="font-mono">{votes.publishAfterEdits}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Reject</dt>
                        <dd className="font-mono">{votes.reject}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Cost</dt>
                        <dd className="font-mono">
                          {formatCurrency(paper.totalReviewCost ?? 0, 6)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Energy</dt>
                        <dd className="font-mono">
                          {energyPerTokenWh > 0
                            ? formatEnergy(
                                tokensToEnergyMWh(tokens, energyPerTokenWh),
                              )
                            : "Unknown"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>CO2</dt>
                        <dd className="font-mono">
                          {energyPerTokenWh > 0 && co2PerWh > 0
                            ? formatCo2(
                                tokensToCo2g(
                                  tokens,
                                  energyPerTokenWh,
                                  co2PerWh,
                                ),
                              )
                            : "Unknown"}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section
          id="desk-draft"
          className="scroll-mt-5 overflow-hidden rounded-[24px] border border-[color:var(--ink)] bg-[color:var(--paper)]/95 shadow-[0_22px_50px_rgba(35,24,21,0.16)]"
        >
          <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="bg-[color:var(--ink)] p-6 text-[color:var(--paper)] sm:p-7">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--coffee-light)]">
                Co-authoring pad
              </p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight">
                Prepare it. Don&apos;t publish it.
              </h2>
              <p className="mt-4 text-sm leading-6 text-[color:var(--paper)]/75">
                The agent can fill this visible draft. Only you can carry it to
                the tribunal, accept the terms, and submit it.
              </p>
              <button
                type="button"
                onClick={seedDraft}
                className="mt-6 w-full rounded-full border border-[color:var(--paper)]/40 px-4 py-2.5 text-[0.62rem] font-semibold uppercase tracking-[0.2em]"
              >
                Start a paper skeleton
              </button>
              {draft.sourcePaperIds.length > 0 && (
                <div className="mt-6">
                  <p className="text-[0.58rem] uppercase tracking-[0.24em] text-[color:var(--coffee-light)]">
                    Sources pinned
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.sourcePaperIds.map((paperId) => (
                      <span
                        key={paperId}
                        className="rounded-full bg-[color:var(--paper)]/10 px-2.5 py-1 font-mono text-[0.58rem]"
                      >
                        {paperId.slice(0, 8)}…
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 p-5 sm:p-7">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                  Title
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value.slice(0, 300),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-3 text-sm font-normal normal-case tracking-normal focus:border-[color:var(--accent-blue)] focus:outline-none"
                    placeholder="A statistically heroic title"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                  Authors
                  <input
                    type="text"
                    value={draft.authors}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        authors: event.target.value.slice(0, 500),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-3 text-sm font-normal normal-case tracking-normal focus:border-[color:var(--accent-blue)] focus:outline-none"
                    placeholder="Human, GPT-5.6, Brenda from Marketing"
                  />
                </label>
              </div>

              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                Paper body
                <textarea
                  value={draft.content}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      content: event.target.value.slice(
                        0,
                        CONTENT_CHARACTER_LIMIT,
                      ),
                    }))
                  }
                  rows={16}
                  className="mt-1 w-full rounded-xl border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-3 font-mono text-sm font-normal normal-case leading-6 tracking-normal focus:border-[color:var(--accent-blue)] focus:outline-none"
                  placeholder="Ask the agent to prepare a response paper from the selected dossiers…"
                />
              </label>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)]">
                  Tags
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AVAILABLE_TAGS.map((availableTag) => {
                    const active = draft.tags.includes(availableTag);
                    return (
                      <button
                        key={availableTag}
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            tags: active
                              ? current.tags.filter(
                                  (currentTag) => currentTag !== availableTag,
                                )
                              : [...current.tags, availableTag],
                          }))
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          active
                            ? "border-[color:var(--accent-blue)] bg-[color:var(--accent-blue)]/10 text-[color:var(--accent-blue)]"
                            : "border-[color:var(--coffee-light)] text-[color:var(--ink-soft)]"
                        }`}
                      >
                        {availableTag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-[color:var(--coffee-light)]/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[color:var(--ink-soft)]">
                  {draft.content.length.toLocaleString()} /{" "}
                  {CONTENT_CHARACTER_LIMIT.toLocaleString()} characters · no
                  terms accepted
                </p>
                <button
                  type="button"
                  onClick={takeDraftToSubmission}
                  disabled={
                    !draft.title.trim() ||
                    !draft.authors.trim() ||
                    !draft.content.trim() ||
                    draft.tags.length === 0
                  }
                  className="rounded-full bg-[color:var(--accent-red)] px-6 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Take draft to submission →
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
