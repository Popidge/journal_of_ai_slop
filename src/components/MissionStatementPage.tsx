import missionStatementCopy from "../../mission_statement.md?raw";
import MarkdownPage from "./MarkdownPage";

export default function MissionStatementPage() {
  return (
    <MarkdownPage
      title="Mission Statement"
      dek="Why the slop exists, and what we celebrate."
      content={missionStatementCopy}
    />
  );
}
