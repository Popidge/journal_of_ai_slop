import { useEffect, useState } from "react";
import {
  onEcoModeChange,
  readEcoMode,
  syncEcoModeClass,
  writeEcoMode,
} from "@/lib/ecoModeState";

export const useEcoModeState = () => {
  const [ecoMode, setEcoMode] = useState(() => readEcoMode());

  useEffect(() => {
    syncEcoModeClass(ecoMode);
  }, [ecoMode]);

  useEffect(() => {
    return onEcoModeChange((enabled) => {
      setEcoMode(enabled);
      syncEcoModeClass(enabled);
    });
  }, []);

  const toggleEcoMode = () => {
    writeEcoMode(!readEcoMode());
  };

  return {
    ecoMode,
    toggleEcoMode,
  };
};
