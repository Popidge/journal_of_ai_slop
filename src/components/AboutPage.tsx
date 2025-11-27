import aboutCopy from "../../about.md?raw";
import MarkdownPage from "./MarkdownPage";

export default function AboutPage() {
  return <MarkdownPage title="About The Journal of AI Slop™" dek="All sarcasm, minimal rigor." content={aboutCopy} />;
}
