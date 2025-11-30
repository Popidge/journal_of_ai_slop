import { useState } from "react";
import { Link } from "react-router-dom";
import logoCircle from "@/assets/media/ai_slop_logo_circle.png";
import { useEcoMode } from "@/hooks/useEcoMode";

const links = [
  { label: "Papers", to: "/papers" },
  { label: "Submit", to: "/submit" },
  { label: "About", to: "/about" },
  { label: "FAQ", to: "/faq" },
  { label: "Licensing", to: "/licensing#content" },
];

export default function NavigationBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { ecoMode, toggleEcoMode } = useEcoMode();

  return (
    <nav className="mb-6 flex flex-col gap-3 rounded-[28px] border border-[color:var(--coffee-light)] bg-[color:var(--paper)]/85 px-4 py-3 shadow-[0_10px_25px_rgba(35,24,21,0.15)] backdrop-blur-sm md:flex-row md:items-center md:gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3">
          <span className="relative h-11 w-11 overflow-hidden rounded-full border border-[color:var(--coffee)] bg-[color:var(--coffee-light)]/70 sm:h-12 sm:w-12">
            <img src={logoCircle} alt="AI Slop circular badge" className="h-full w-full object-cover" />
            <span className="absolute inset-1 rounded-full border border-[color:var(--coffee)] opacity-60" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[0.55rem] uppercase tracking-[0.2em] text-[color:var(--ink-soft)] sm:text-[0.65rem] sm:tracking-[0.35em]">The Journal of AI Slop™</p>
            <p className="text-[0.7rem] font-semibold text-[color:var(--ink)] sm:text-xs">All Sarcasm, No Rigour</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleEcoMode}
            aria-pressed={ecoMode}
            className={`flex items-center gap-2 rounded-full border px-2 py-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.25em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-blue)] ${
              ecoMode
                ? "border-[color:var(--coffee)] bg-[color:var(--coffee)]/90 text-[color:var(--paper)]"
                : "border-[color:var(--coffee-light)] bg-[color:var(--paper)]/80 text-[color:var(--ink)]"
            }`}
          >
            <span className="sr-only">Toggle Eco Mode</span>
            <span
              className={`relative h-6 w-12 rounded-full border transition ${
                ecoMode
                  ? "border-[color:var(--coffee)] bg-[color:var(--coffee-light)]/60"
                  : "border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90"
              }`}
            >
              <span
                className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-[color:var(--paper)] shadow transition ${ecoMode ? "translate-x-5" : "translate-x-0"}`}
              />
            </span>
            <span className={`${ecoMode ? "text-[color:var(--paper)]" : "text-[color:var(--ink)]"}`}>
              Eco mode {ecoMode ? "On" : "Off"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(prev => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--coffee-light)] bg-[color:var(--paper)] text-[color:var(--ink)] shadow-[0_4px_10px_rgba(35,24,21,0.12)] transition hover:-translate-y-0.5 md:hidden"
            aria-expanded={menuOpen}
            aria-controls="nav-links"
          >
            <span className="sr-only">Toggle navigation</span>
            <span
              className={`block h-0.5 w-6 origin-center transform rounded-full bg-[color:var(--ink)] transition ${menuOpen ? "translate-y-1 rotate-45" : "-translate-y-1"}`}
            />
            <span className={`mt-1 block h-0.5 w-6 rounded-full bg-[color:var(--ink)] transition ${menuOpen ? "opacity-0" : "opacity-100"}`} />
            <span
              className={`block h-0.5 w-6 origin-center transform rounded-full bg-[color:var(--ink)] transition ${menuOpen ? "-translate-y-1 -rotate-45" : "translate-y-1"}`}
            />
          </button>
        </div>
      </div>

      <div
        id="nav-links"
        className={`flex flex-col gap-4 border-t border-[color:var(--coffee-light)] pt-3 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-[color:var(--ink-soft)] md:ml-auto md:flex md:flex-row md:justify-end md:border-t-0 md:pt-0 md:text-[0.65rem] md:tracking-[0.35em] ${
          menuOpen ? "flex" : "hidden md:flex"
        }`}
      >
        {links.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="relative before:absolute before:-bottom-1 before:left-0 before:h-[2px] before:w-0 before:bg-[color:var(--accent-blue)] before:transition-all before:duration-200 hover:text-[color:var(--ink)] hover:before:w-full"
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
