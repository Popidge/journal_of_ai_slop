import MarkdownRenderer from "./MarkdownRenderer";

interface MarkdownPageProps {
  title: string;
  dek?: string;
  content: string;
}

export default function MarkdownPage({ title, dek, content }: MarkdownPageProps) {
  return (
    <main className="min-h-screen px-3 py-10 text-[color:var(--ink)] sm:px-4">
      <div className="mx-auto w-full max-w-[1040px] space-y-6">
        <header className="space-y-3 text-center sm:text-left">
          <p className="text-[0.65rem] uppercase tracking-[0.35em] text-[color:var(--accent-blue)] sm:text-xs">Official Notice · Issue XXXVII</p>
          <h1 className="text-[clamp(2rem,5vw,3rem)] font-semibold leading-tight text-[color:var(--ink)] wobbly-underline">{title}</h1>
          {dek && <p className="text-base font-serif text-[color:var(--ink-soft)] italic sm:text-lg">{dek}</p>}
        </header>

        <section className="rounded-[26px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90 p-5 shadow-[0_15px_35px_rgba(35,24,21,0.12)] sm:rounded-[32px] sm:p-8">
          <MarkdownRenderer content={content} />
        </section>
      </div>
    </main>
  );
}
