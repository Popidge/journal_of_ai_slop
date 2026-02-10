import { useEcoModeState } from "@/hooks/useEcoModeState";

export default function EcoModeOverlayIsland() {
  const { ecoMode } = useEcoModeState();

  if (!ecoMode) {
    return null;
  }

  return (
    <div className="eco-mode-overlay pointer-events-none" aria-hidden="true" />
  );
}
