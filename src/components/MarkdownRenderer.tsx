import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

export type MarkdownRendererProps = {
  content: string;
  className?: string;
  components?: Components;
};

export default function MarkdownRenderer({ content, className = "", components }: MarkdownRendererProps) {
  return (
    <div className={["markdown-body", className].filter(Boolean).join(" ")}
      data-testid="markdown-renderer"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a
              {...props}
              target={props.href?.startsWith("/") ? undefined : "_blank"}
              rel={props.href?.startsWith("/") ? undefined : "noreferrer noopener"}
            />
          ),
          ...components,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
