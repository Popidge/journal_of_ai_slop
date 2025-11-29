import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { EcoModeContext } from "@/contexts/ecoModeContext";

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
