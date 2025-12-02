import privacyPolicyCopy from "../../PRIVACY.md?raw";
import MarkdownPage from "./MarkdownPage";

export default function PrivacyPolicyPage() {
  return (
    <MarkdownPage
      title="Privacy Policy"
      dek="How we respect your data while maintaining chaos under control."
      content={privacyPolicyCopy}
    />
  );
}
