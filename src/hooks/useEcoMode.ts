import { useContext } from "react";
import { EcoModeContext } from "@/contexts/ecoModeContext";

export function useEcoMode() {
  const context = useContext(EcoModeContext);
  if (!context) {
    throw new Error("useEcoMode must be used within an EcoModeProvider");
  }
  return context;
}
