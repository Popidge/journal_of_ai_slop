import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components, Options } from "react-markdown";

const DEFAULT_REMARK_PLUGINS = [remarkGfm, remarkMath];
const DEFAULT_REHYPE_PLUGINS = [[rehypeKatex, { throwOnError: false, errorColor: "#b3412f" }]];

const normalizeRemarkPlugins = (plugins?: Options["remarkPlugins"]) =>
  plugins
    ? Array.isArray(plugins)
      ? plugins
      : [plugins]
    : [];

const normalizeRehypePlugins = (plugins?: Options["rehypePlugins"]) =>
  plugins
    ? Array.isArray(plugins)
      ? plugins
      : [plugins]
    : [];

const MATH_SEGMENT_REGEX = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g;

const needsIsolation = (segment: string) => segment.includes("&") || /\\begin\{cases\}/.test(segment);

const isolateMath = (content: string) =>
  content.replace(MATH_SEGMENT_REGEX, (segment) =>
    needsIsolation(segment) ? `\`\`\`latex\n${segment}\n\`\`\`` : segment,
  );

export type MarkdownRendererProps = {
  content: string;
  className?: string;
  components?: Components;
  remarkPlugins?: Options["remarkPlugins"];
  rehypePlugins?: Options["rehypePlugins"];
};

export default function MarkdownRenderer({
  content,
  className = "",
  components,
  remarkPlugins,
  rehypePlugins,
}: MarkdownRendererProps) {
  const mergedRemarkPlugins = [...DEFAULT_REMARK_PLUGINS, ...normalizeRemarkPlugins(remarkPlugins)] as Options["remarkPlugins"];
  const mergedRehypePlugins = [...DEFAULT_REHYPE_PLUGINS, ...normalizeRehypePlugins(rehypePlugins)] as Options["rehypePlugins"];
  const safeContent = isolateMath(content);

  return (
    <div
      className={["markdown-body", className].filter(Boolean).join(" ")}
      data-testid="markdown-renderer"
    >
      <ReactMarkdown
        remarkPlugins={mergedRemarkPlugins}
        rehypePlugins={mergedRehypePlugins}
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
        {safeContent}
      </ReactMarkdown>
    </div>
  );
}
