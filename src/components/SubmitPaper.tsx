import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Link } from "react-router-dom";

const AVAILABLE_TAGS = [
  "Actually Academic",
  "Pseudo academic",
  "Nonsense",
  "Pure Slop",
  "🤷♂️"
] as const;

const LLM_SIGNIFIERS = ["GPT-4", "Claude", "Gemini", "Grok", "LLaMA", "Bard", "Kimi"] as const;

export default function SubmitPaper() {
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    content: "",
    tags: [] as string[],
    pinkySwear: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedPaperId, setSubmittedPaperId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      const paperId = await submitPaper({
        title: formData.title,
        authors: formData.authors,
        content: formData.content,
        tags: formData.tags,
      });

      setSubmittedPaperId(paperId);
      setFormData({
        title: "",
        authors: "",
        content: "",
        tags: [],
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
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-2xl w-full bg-black/50 backdrop-blur-lg rounded-lg border border-red-500/30 p-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-red-400 mb-6">Submission Received!</h1>

            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 mb-4">
              <p className="text-lg text-red-300 mb-2">Paper ID:</p>
              <p className="text-xl font-mono text-white">{submittedPaperId}</p>
            </div>

            <p className="text-green-300 mb-6">Crom is pleased. Your slop has been escalated to the tribunal.</p>
            <p className="text-gray-300 mb-8">
              Your submission is under review by our panel of distinguished AI peers. The review process is automated
              and completely unbiased (probably).
            </p>

            <div className="space-y-4">
              <Link
                to="/papers"
                className="button-scale block w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg"
              >
                View Published Papers
              </Link>

              <Link
                to="/"
                className="button-scale block w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg"
              >
                Back to Home
              </Link>

              <button
                onClick={() => setSubmittedPaperId(null)}
                className="button-scale block w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg"
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
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <Link
            to="/"
            className="inline-block text-red-400 hover:text-red-300 mb-6 transition-colors"
          >
            ← Back to The Journal of AI Slop™
          </Link>

          <h1 className="text-5xl font-bold text-red-400 mb-4">Submit Your Slop</h1>
          <p className="text-xl text-gray-300">Where groundbreaking research meets questionable methodology</p>
        </div>

        <div className="bg-black/50 backdrop-blur-lg rounded-lg border border-red-500/30 p-8">
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
              <p className="text-red-300">Crom is disappointed. {error}</p>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-red-300 mb-2">
                Paper Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                placeholder="A Revolutionary Study on..."
              />
            </div>

            <div>
              <label htmlFor="authors" className="block text-sm font-medium text-red-300 mb-2">
                Authors * (include at least one LLM)
              </label>
              <input
                type="text"
                id="authors"
                name="authors"
                value={formData.authors}
                onChange={handleInputChange}
                required
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
                placeholder="Jamie Taylor, GPT-4, Claude-3.5, Brenda from Marketing"
              />
              <p className="text-sm text-gray-400 mt-2">
                Must include at least one AI model (GPT-4, Claude, Gemini, etc.)
              </p>
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-red-300 mb-2">
                Full Paper Content *
              </label>
              <textarea
                id="content"
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                required
                rows={12}
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors font-mono text-sm"
                placeholder="Abstract: This paper presents a groundbreaking discovery..."
              />
              <p className="text-sm text-gray-400 mt-2">
                Full paper text. First 2000 characters will be reviewed (the rest is just padding anyway).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-red-300 mb-4">
                Tags * (at least one)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {AVAILABLE_TAGS.map(tag => (
                  <label
                    key={tag}
                    className="relative flex items-center justify-center bg-black/50 border border-gray-700 rounded-lg px-4 py-3 cursor-pointer hover:border-red-500 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.tags.includes(tag)}
                      onChange={() => handleTagToggle(tag)}
                      className="sr-only"
                    />
                    <span className={`
                      ${formData.tags.includes(tag)
                        ? 'text-red-400 border-red-500'
                        : 'text-gray-400 border-gray-700'
                      } border rounded px-2 py-1 text-sm font-medium
                    `}>
                      {tag}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.pinkySwear}
                  onChange={handlePinkySwearChange}
                  className="mt-1 w-4 h-4 text-red-600 bg-gray-800 border-gray-600 rounded focus:ring-red-500 focus:ring-2"
                />
                <span className="text-sm text-gray-300">
                  <span className="font-medium text-red-300">Pinky-Swear Acknowledgment:</span> I agree not to publish this elsewhere.
                  This is <strong>morally binding and completely unenforceable</strong>. Crom is watching.
                  🤚
                </span>
              </label>
            </div>

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isSubmitting}
                className="button-scale bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-8 rounded-lg transition-colors text-lg"
              >
                {isSubmitting ? "Summoning the reviewers..." : "Submit for Review"}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 bg-black/30 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Review Process</h3>
          <ul className="space-y-2 text-gray-300">
            <li>• Your paper will be reviewed by 5 randomly selected AI models</li>
            <li>• Review decisions are: Publish Now, Publish After Edits, or Reject</li>
            <li>• "Publish After Edits" is treated as "Reject" for MVP (sorry)</li>
            <li>• Maximum review cost per paper: $0.20 (we're not made of money)</li>
            <li>• Review process is completely automated and unbiased (definitely)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
