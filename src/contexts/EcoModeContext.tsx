import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type EcoModeContextValue = {
  ecoMode: boolean;
  toggleEcoMode: () => void;
};

const EcoModeContext = createContext<EcoModeContextValue | null>(null);

export function EcoModeProvider({ children }: { children: ReactNode }) {
  const [ecoMode, setEcoMode] = useState(false);
  const toggleEcoMode = useCallback(() => {
    setEcoMode((prev) => !prev);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.toggle("eco-mode-active", ecoMode);
    }
  }, [ecoMode]);

  const value = useMemo(() => ({ ecoMode, toggleEcoMode }), [ecoMode, toggleEcoMode]);
  return <EcoModeContext.Provider value={value}>{children}</EcoModeContext.Provider>;
}

export function useEcoMode() {
  const context = useContext(EcoModeContext);
  if (!context) {
    throw new Error("useEcoMode must be used within an EcoModeProvider");
  }
  return context;
}
