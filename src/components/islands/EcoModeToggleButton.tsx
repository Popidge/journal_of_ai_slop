import { useEcoModeState } from "@/hooks/useEcoModeState";

export default function EcoModeToggleButton() {
  const { ecoMode, toggleEcoMode } = useEcoModeState();

  return (
    <button
      type="button"
      onClick={toggleEcoMode}
      aria-pressed={ecoMode}
      className={`ml-auto flex items-center gap-2 rounded-full border px-2 py-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.25em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--accent-blue)] md:ml-0 ${
        ecoMode
          ? "border-[color:var(--coffee)] bg-[color:var(--coffee)]/90 text-[color:var(--paper)]"
          : "border-[color:var(--coffee-light)] bg-[color:var(--paper)]/80 text-[color:var(--ink)]"
      }`}
    >
      <span
        className={`relative h-6 w-12 rounded-full border transition ${
          ecoMode
            ? "border-[color:var(--coffee)] bg-[color:var(--coffee-light)]/60"
            : "border-[color:var(--coffee-light)] bg-[color:var(--paper)]/90"
        }`}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-[color:var(--paper)] shadow transition ${
            ecoMode ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
      <span>{ecoMode ? "Eco on" : "Eco off"}</span>
    </button>
  );
}
