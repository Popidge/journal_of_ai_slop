import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";
import { useRateLimit } from "../hooks/useRateLimit";

const AVAILABLE_TAGS = [
  "Actually Academic",
  "Pseudo academic",
  "Nonsense",
  "Pure Slop",
  "🤷♂️",
] as const;

const LLM_SIGNIFIERS = ["GPT", "Claude", "Gemini", "Grok", "LLaMA", "Bard", "Kimi", "Minimax", "Phi", "Qwen"] as const;

const SUBMISSION_LIMIT = 3;
const RATE_WINDOW_MS = 3600000;

export default function SubmitPaper() {
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    content: "",
    tags: [] as string[],
    notificationEmail: "",
    pinkySwear: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedPaperId, setSubmittedPaperId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rateLimit = useRateLimit(SUBMISSION_LIMIT, RATE_WINDOW_MS);
  const patiencePercent = Math.max(0, Math.min(100, (rateLimit.remaining / SUBMISSION_LIMIT) * 100));
  const minutesUntilReset = Math.max(1, Math.ceil(rateLimit.timeUntilReset / 60000));

  const submitPaper = useMutation(api.papers.submitPaper);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handlePinkySwearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, pinkySwear: e.target.checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (rateLimit.isLimited) {
      alert(
        `Crom says: "You've submitted enough slop for now. Contemplate your choices for ${minutesUntilReset} minutes, then try again."`
      );
      return;
    }
    setIsSubmitting(true);

    try {
      if (!formData.title.trim()) {
        throw new Error("Title is required");
      }
      if (!formData.authors.trim()) {
        throw new Error("Authors are required");
      }
      const includesLLM = LLM_SIGNIFIERS.some((model) =>
        formData.authors.toLowerCase().includes(model.toLowerCase()),
      );
      if (!includesLLM) {
        throw new Error("Authors must mention at least one AI model such as GPT-4, Claude, or Gemini.");
      }
      if (!formData.content.trim()) {
        throw new Error("Content is required");
      }
      if (formData.tags.length === 0) {
        throw new Error("At least one tag is required");
      }
      if (!formData.pinkySwear) {
        throw new Error("You must agree to the pinky-swear clause");
      }

      const notificationEmail = formData.notificationEmail.trim();
      if (notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
        throw new Error("Notification email must be a valid email address.");
      }

      const paperId = await submitPaper({
        title: formData.title,
        authors: formData.authors,
        content: formData.content,
        tags: formData.tags,
        notificationEmail: notificationEmail || undefined,
      });

      rateLimit.recordSubmission();
      setSubmittedPaperId(paperId);
      setFormData({
        title: "",
        authors: "",
        content: "",
        tags: [],
        notificationEmail: "",
        pinkySwear: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Even the form thinks your slop is too slop");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedPaperId) {
    return (
      <div className="min-h-screen px-3 py-10 text-[color:var(--ink)] sm:px-4">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <div className="space-y-6 rounded-[26px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 text-center shadow-[0_20px_40px_rgba(35,24,21,0.12)] sm:rounded-[32px] sm:p-6">
            <div className="space-y-3">
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[color:var(--ink-soft)] sm:text-xs sm:tracking-[0.4em]">Submission Complete</p>
              <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold text-[color:var(--ink)]">Submission Received!</h1>
              <p className="text-sm text-[color:var(--ink-soft)]">Crom is pleased. Your slop is now in the tribunal’s orbit.</p>
            </div>
            <div className="rounded-[24px] border border-[color:var(--coffee)] bg-[color:var(--coffee-light)]/30 p-5">
              <p className="text-[0.65rem] uppercase tracking-[0.35em] text-[color:var(--ink)]">Paper ID</p>
              <p className="mt-2 text-xl font-mono text-[color:var(--ink)] break-words">{submittedPaperId}</p>
            </div>
            <div className="space-y-3 text-sm text-[color:var(--ink-soft)]">
              <p>Review cost is being tallied while the bots bicker in the margins.</p>
              <p>The review process is automated, unbiased, and probably lurking somewhere in your devlogs.</p>
            </div>
            <div className="space-y-3">
              <Link
                to="/papers"
                className="button-scale block w-full rounded-full border border-[color:var(--coffee)] bg-[color:var(--coffee)]/90 px-6 py-3 text-[0.8rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--paper)] transition hover:-translate-y-0.5 sm:text-sm"
              >
                View Published Papers
              </Link>
              <Link
                to="/"
                className="button-scale block w-full rounded-full border border-[color:var(--coffee-light)] bg-transparent px-6 py-3 text-[0.8rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--coffee)] transition hover:border-[color:var(--accent-blue)] hover:text-[color:var(--accent-blue)] sm:text-sm"
              >
                Back to Home
              </Link>
              <button
                onClick={() => setSubmittedPaperId(null)}
                className="button-scale block w-full rounded-full border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-6 py-3 text-[0.8rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--ink)] transition hover:-translate-y-0.5 sm:text-sm"
              >
                Submit Another Paper
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-3 py-10 text-[color:var(--ink)] sm:px-4">
      <div className="mx-auto w-full max-w-[960px] space-y-10">
        <div className="space-y-3 text-center sm:text-left">
          <Link
            to="/"
            className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[color:var(--ink-soft)] transition hover:text-[color:var(--accent-blue)] sm:text-xs sm:tracking-[0.35em]"
          >
            ← Back to The Journal of AI Slop™
          </Link>
          <h1 className="text-[clamp(2.2rem,6vw,3.2rem)] font-semibold text-[color:var(--ink)] wobbly-underline">Submit Your Slop</h1>
          <p className="text-sm text-[color:var(--ink-soft)]">Where groundbreaking research meets questionable methodology.</p>
        </div>

        <div className="space-y-8 rounded-[26px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/95 p-5 shadow-[0_20px_45px_rgba(35,24,21,0.12)] sm:rounded-[32px] sm:p-6">
          {error && (
            <div className="rounded-[24px] border border-[color:var(--accent-red)] bg-[color:var(--accent-red)]/10 p-4">
              <p className="text-sm text-[color:var(--accent-red)]">Crom is disappointed. {error}</p>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
            <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center sm:gap-4">
              <label htmlFor="title" className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)] sm:text-sm sm:text-right">
                Paper Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full rounded-lg border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] transition focus:border-[color:var(--coffee)] focus:outline-none"
                placeholder="A Revolutionary Study on..."
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center sm:gap-4">
              <label htmlFor="authors" className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)] sm:text-sm sm:text-right">
                Authors * (include at least one LLM)
              </label>
              <input
                type="text"
                id="authors"
                name="authors"
                value={formData.authors}
                onChange={handleInputChange}
                required
                className="w-full rounded-lg border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] transition focus:border-[color:var(--coffee)] focus:outline-none"
                placeholder="Jamie Taylor, GPT-4, Claude-3.5, Brenda from Marketing"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-4">
              <label htmlFor="content" className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)] sm:text-sm">
                Full Paper Content *
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                required
                rows={12}
                className="w-full rounded-lg border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] font-mono transition focus:border-[color:var(--coffee)] focus:outline-none"
                placeholder="Abstract: This paper presents a groundbreaking discovery..."
              />
              <p className="mt-2 text-[0.65rem] text-[color:var(--ink-soft)] sm:col-span-2">
                Supports Markdown and KaTeX-friendly LaTeX: inline math with <code>$…$</code> and display math with <code>$…$</code>. Complex TeX macros may not render.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[color:var(--ink-soft)] sm:text-xs sm:tracking-[0.4em]">Tags * (at least one)</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {AVAILABLE_TAGS.map(tag => (
                  <label
                    key={tag}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition ${formData.tags.includes(tag)
                      ? "border-[color:var(--coffee)] bg-[color:var(--coffee)]/10 text-[color:var(--coffee)]"
                      : "border-[color:var(--coffee-light)] bg-[color:var(--paper)] text-[color:var(--ink-soft)]"
                    }`}
                  >
                    <span>{tag}</span>
                    <input
                      type="checkbox"
                      checked={formData.tags.includes(tag)}
                      onChange={() => handleTagToggle(tag)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-center sm:gap-4">
              <label htmlFor="notificationEmail" className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--ink-soft)] sm:text-sm sm:text-right">
                Email (Optional)
              </label>
              <div className="space-y-1">
                <input
                  type="email"
                  id="notificationEmail"
                  name="notificationEmail"
                  value={formData.notificationEmail}
                  onChange={handleInputChange}
                  placeholder="you@email.com"
                  className="w-full rounded-lg border border-[color:var(--coffee-light)] bg-[color:var(--paper)] px-4 py-3 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] transition focus:border-[color:var(--coffee)] focus:outline-none"
                />
                <p className="text-[0.65rem] text-[color:var(--ink-soft)]">
                  Optional. We'll let you know when your slop is published or formally rejected. Once informed, your email will be removed from our database. <Link to="/privacy" className="underline text-[color:var(--accent-blue)]">Privacy Policy</Link>.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/80 p-4 text-[0.9rem] text-[color:var(--ink-soft)] sm:text-sm">
              <label className="text-left text-[0.75rem] font-medium uppercase tracking-[0.15em] sm:text-sm sm:tracking-[0.2em]">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.pinkySwear}
                    onChange={handlePinkySwearChange}
                    className="mt-1 h-4 w-4 rounded border border-[color:var(--coffee-light)] bg-[color:var(--paper)] text-[color:var(--coffee)] focus:ring-[color:var(--coffee)]"
                  />
                  <div>
                    <p className="text-[0.65rem] font-semibold tracking-[0.25em] text-[color:var(--ink-soft)]">I confirm that:</p>
                    <ul className="mt-2 space-y-2 text-[0.9rem] font-normal tracking-[0.1em] text-[color:var(--ink-soft)]">
                      <li>• This paper is co-authored by an LLM (credited), but I otherwise have the right to license and distribute it;</li>
                      <li>
                        • I license it under <a href="/licensing#paper" className="underline text-[color:var(--accent-blue)]">CC BY-NC-SA 4.0</a>;
                      </li>
                      <li>• I will not sell it commercially;</li>
                      <li>• I will not attempt to submit it for publication to any other journal (this is only morally binding, not legally)</li>
                    </ul>
                  </div>
                </div>
              </label>
            </div>

            <div className="space-y-3 text-center text-[0.65rem] uppercase tracking-[0.25em] text-[color:var(--ink-soft)] sm:text-xs sm:tracking-[0.35em]">
              <p>By submitting, you affirm that this work is 50% slop by volume, minimum. Crom is watching.</p>
              <button
                type="submit"
                disabled={isSubmitting || rateLimit.isLimited}
                className={`button-scale w-full rounded-full bg-[color:var(--coffee)] px-6 py-4 text-[0.9rem] font-semibold text-[color:var(--paper)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-gray-400 sm:text-sm ${rateLimit.isLimited ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isSubmitting ? "Summoning the reviewers..." : "Submit to the Slop Pipeline"}
              </button>
            </div>

            {rateLimit.count > 0 && (
              <div className="mt-4 rounded-lg border border-[color:var(--coffee-light)] bg-[color:var(--coffee-light)]/40 p-3">
                <p className="text-sm text-[color:var(--ink)]">
                  ⚠️ Crom's Patience Meter: {rateLimit.remaining}/{SUBMISSION_LIMIT} submissions this hour
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[color:var(--coffee)]/30">
                  <div
                    className="h-full bg-[color:var(--coffee)] transition-all"
                    style={{ width: `${patiencePercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[color:var(--ink-soft)]">
                  {rateLimit.isLimited
                    ? `Try again in ${minutesUntilReset} minutes while Crom contemplates your slop.`
                    : `${rateLimit.remaining} submissions remain before Crom meters the slow-down.`}
                </p>
              </div>
            )}
          </form>
        </div>

        <div className="space-y-3 rounded-[24px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 text-sm text-[color:var(--ink-soft)] shadow-[0_15px_35px_rgba(35,24,21,0.1)] sm:rounded-[28px] sm:p-6">
          <div className="flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <h3 className="text-lg font-semibold text-[color:var(--ink)]">Review Process</h3>
            <span className="text-[0.6rem] uppercase tracking-[0.3em] text-[color:var(--coffee)]">Slop Audit</span>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-left text-[0.95rem] sm:text-sm">
            <li>Your paper will be reviewed by five randomly summoned AI sentinels.</li>
            <li>Decisions are published as: Publish Now, Publish After Edits, or Reject.</li>
            <li>"Publish After Edits" is currently treated as "Reject" (MVP reality).</li>
            <li>Maximum review cost: $0.20. We are paper-poor.</li>
            <li>Review process is fully automated, unbiased, and salted with snark.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
