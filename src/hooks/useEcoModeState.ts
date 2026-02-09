import { useEffect, useState } from "react";
import {
  onEcoModeChange,
  readEcoMode,
  syncEcoModeClass,
  writeEcoMode,
} from "@/lib/ecoModeState";

export const useEcoModeState = () => {
  const [ecoMode, setEcoMode] = useState(false);

  useEffect(() => {
    const initial = readEcoMode();
    setEcoMode(initial);
    syncEcoModeClass(initial);

    return onEcoModeChange((enabled) => {
      setEcoMode(enabled);
      syncEcoModeClass(enabled);
    });
  }, []);

  const toggleEcoMode = () => {
    writeEcoMode(!ecoMode);
  };

  return {
    ecoMode,
    toggleEcoMode,
  };
};
