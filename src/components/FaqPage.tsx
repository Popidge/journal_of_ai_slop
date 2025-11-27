import faqCopy from "../../faq.md?raw";
import MarkdownPage from "./MarkdownPage";

export default function FaqPage() {
  return <MarkdownPage title="Frequently Asked Questions" dek="Questions we keep getting, answered with maximum sincerity." content={faqCopy} />;
}
