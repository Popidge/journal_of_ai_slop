import contentPolicyCopy from "../../content-policy.md?raw";
import MarkdownPage from "./MarkdownPage";

export default function ContentPolicyPage() {
  return <MarkdownPage title="Content Policy" dek="The guardrails that keep our chaos mildly responsible." content={contentPolicyCopy} />;
}
