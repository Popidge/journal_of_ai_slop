import { useEcoModeState } from "@/hooks/useEcoModeState";

export default function EcoModeBannerIsland() {
  const { ecoMode } = useEcoModeState();

  if (!ecoMode) {
    return null;
  }

  return (
    <div className="mt-4 rounded-[22px] border border-[color:var(--coffee-light)] bg-[color:var(--coffee-light)]/20 px-4 py-3 text-[0.65rem] text-[color:var(--ink-soft)] shadow-[0_10px_30px_rgba(35,24,21,0.1)] sm:text-[0.75rem]">
      <p>
        Now browsing in Eco Mode - monetary and token inference costs are
        replaced with energy and CO2 metrics.
        <a
          href="/sustainability"
          className="ml-1 font-semibold text-[color:var(--accent-blue)] underline"
        >
          Read our Sustainability Policy
        </a>
      </p>
    </div>
  );
}
