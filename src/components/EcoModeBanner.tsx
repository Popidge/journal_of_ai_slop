import { Link } from "react-router-dom";
import { useEcoMode } from "@/hooks/useEcoMode";

export default function EcoModeBanner() {
  const { ecoMode } = useEcoMode();
  if (!ecoMode) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[22px] border border-[color:var(--coffee-light)] bg-[color:var(--coffee-light)]/20 px-4 py-3 text-[0.65rem] text-[color:var(--ink-soft)] shadow-[0_10px_30px_rgba(35,24,21,0.1)] sm:text-[0.75rem]">
      <p>
        Now Browsing in Eco Mode — all monetary/token inference costs are replaced with Energy and CO₂ metrics.
        <Link to="/sustainability" className="ml-1 font-semibold text-[color:var(--accent-blue)] underline">
          Read our Sustainability Policy
        </Link>
      </p>
    </div>
  );
}
