import { useEffect, useMemo, useState } from "react";
import MarkdownRenderer from "./MarkdownRenderer";
import contentLicenseCopy from "../../CONTENT-LICENSE.md?raw";
import paperLicenseCopy from "../../PAPER-LICENSE.md?raw";

const LICENSE_TABS = [
  {
    id: "content",
    label: "Content License",
    content: contentLicenseCopy,
  },
  {
    id: "paper",
    label: "Paper License",
    content: paperLicenseCopy,
  },
] as const;

type TabId = (typeof LICENSE_TABS)[number]["id"];

const normalizeHash = (hash: string | undefined): TabId => {
  const slug = (hash ?? "").replace(/^#/, "");
  return LICENSE_TABS.find((tab) => tab.id === slug)?.id ?? LICENSE_TABS[0].id;
};

export default function LicensingPage() {
  const [activeTab, setActiveTab] = useState<TabId>(() => normalizeHash(typeof window === "undefined" ? undefined : window.location.hash));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleHashChange = () => {
      setActiveTab(normalizeHash(window.location.hash));
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentHash = window.location.hash.replace("#", "");
    if (currentHash === activeTab) {
      return;
    }

    const { pathname, search } = window.location;
    window.history.replaceState(null, "", `${pathname}${search}#${activeTab}`);
  }, [activeTab]);

  const activeTabInfo = useMemo(
    () => LICENSE_TABS.find((tab) => tab.id === activeTab) ?? LICENSE_TABS[0],
    [activeTab],
  );

  return (
    <main className="min-h-screen px-3 py-10 text-[color:var(--ink)] sm:px-4">
      <div className="mx-auto w-full max-w-[1040px] space-y-6">
        <header className="space-y-3 text-center sm:text-left">
          <p className="text-[0.65rem] uppercase tracking-[0.35em] text-[color:var(--accent-blue)] sm:text-xs">Official Notice · Licensing</p>
          <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-tight text-[color:var(--ink)] wobbly-underline">Licensing</h1>
          <p className="text-sm font-serif text-[color:var(--ink-soft)] italic sm:text-lg">Everything here is under a Creative Commons umbrella.</p>
        </header>

        <section className="space-y-4 rounded-[26px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 shadow-[0_15px_35px_rgba(35,24,21,0.12)] sm:rounded-[32px] sm:p-6">
          <div className="flex flex-wrap gap-3" role="tablist" aria-label="Licensing tabs">
            {LICENSE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full border px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.25em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-blue)] ${
                  activeTab === tab.id
                    ? "border-[color:var(--coffee)] bg-[color:var(--coffee)]/90 text-[color:var(--paper)]"
                    : "border-[color:var(--coffee-light)] bg-[color:var(--paper)] text-[color:var(--ink-soft)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="rounded-[24px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 shadow-[0_10px_25px_rgba(35,24,21,0.08)]">
            <MarkdownRenderer content={activeTabInfo.content} />
          </div>
        </section>
      </div>
    </main>
  );
}
