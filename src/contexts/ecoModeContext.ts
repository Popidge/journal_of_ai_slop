import { createContext } from "react";

export type EcoModeContextValue = {
  ecoMode: boolean;
  toggleEcoMode: () => void;
};

export const EcoModeContext = createContext<EcoModeContextValue | null>(null);
