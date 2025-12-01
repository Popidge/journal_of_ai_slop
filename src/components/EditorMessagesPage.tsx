import MarkdownPage from "./MarkdownPage";
import messagesCopy from "../../MESSAGES.md?raw";

export default function EditorMessagesPage() {
  return (
    <MarkdownPage
      title="Editor Messages"
      dek="Latest dispatches from the editorial desk."
      content={messagesCopy}
    />
  );
}
