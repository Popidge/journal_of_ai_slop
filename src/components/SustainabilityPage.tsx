import sustainabilityCopy from "../../SUSTAINABILITY.md?raw";
import MarkdownPage from "./MarkdownPage";

export default function SustainabilityPage() {
  return (
    <MarkdownPage
      title="Sustainability Policy"
      dek="How we balance AI slop with planetary stewardship."
      content={sustainabilityCopy}
    />
  );
}
