import { Link } from "react-router-dom";

const links = [
  { label: "Papers", to: "/papers" },
  { label: "Submit", to: "/submit" },
  { label: "About", to: "/" },
  { label: "FAQ", to: "/" },
];

export default function NavigationBar() {
  return (
    <nav className="mb-6 flex items-center justify-between rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/80 px-4 py-3 shadow-[0_10px_25px_rgba(35,24,21,0.15)] backdrop-blur-sm">
      <Link to="/" className="flex items-center gap-3">
        <span className="relative h-12 w-12 overflow-hidden rounded-full border border-[color:var(--coffee)] bg-[color:var(--coffee-light)]/70">
          <img src="/ai_slop_logo_circle.png" alt="AI Slop circular badge" className="h-full w-full object-cover" />
          <span className="absolute inset-1 rounded-full border border-[color:var(--coffee)] opacity-60" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.4em] text-[color:var(--ink-soft)]">The Journal of AI Slop™</p>
          <p className="text-xs font-semibold text-[color:var(--ink)]">All Sarcasm, No Rigour</p>
        </div>
      </Link>
      <div className="flex items-center gap-6 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[color:var(--ink-soft)]">
        {links.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="relative before:absolute before:-bottom-1 before:left-0 before:h-[2px] before:w-0 before:bg-[color:var(--accent-blue)] before:transition-all before:duration-200 hover:text-[color:var(--ink)] hover:before:w-full"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
