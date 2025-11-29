import MarkdownRenderer from "./MarkdownRenderer";

export type EditorsCommentBoxProps = {
  comment: string;
  createdAt?: number;
};

export default function EditorsCommentBox({ comment, createdAt }: EditorsCommentBoxProps) {
  const formattedDate = createdAt ? new Date(createdAt).toLocaleDateString() : null;

  return (
    <section
      className="relative rounded-[30px] border border-[color:var(--coffee-light)] bg-gradient-to-b from-[color:var(--paper)]/60 to-[color:var(--paper)]/80 p-5 shadow-[0_25px_45px_rgba(35,24,21,0.14)]"
      aria-label="Editor comment"
    >
      <div className="pointer-events-none absolute left-4 top-4 h-10 w-[3px] rounded-full bg-gradient-to-b from-[color:var(--accent-blue)] via-transparent to-transparent" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.65rem] uppercase tracking-[0.5em] text-[color:var(--ink-soft)]">Editor's Comment</p>
          {formattedDate && (
            <span className="text-[0.65rem] uppercase tracking-[0.35em] text-[color:var(--coffee)]">
              {formattedDate}
            </span>
          )}
        </div>
        <div className="rounded-[22px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-4 text-sm leading-relaxed">
          <MarkdownRenderer content={comment} className="prose text-[color:var(--ink)]" />
        </div>
      </div>
    </section>
  );
}
