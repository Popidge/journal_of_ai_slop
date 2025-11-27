import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="mt-10 text-center text-sm text-[color:var(--ink-soft)] sm:text-base">
      <p>
        ISSN: pending. Regret: ongoing. — Created by{" "}
        <a href="https://github.com/popidge" target="_blank" rel="noreferrer" className="underline">
          Jamie Taylor
        </a>
      </p>
      <p className="mt-2 text-[0.75rem] uppercase tracking-[0.25em]">
        <Link to="/content-policy" className="text-[color:var(--accent-blue)] underline">
          Content Policy
        </Link>
      </p>
    </footer>
  );
}
