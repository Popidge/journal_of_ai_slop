const ECO_MODE_STORAGE_KEY = "eco_mode_enabled";
const ECO_MODE_EVENT = "eco-mode-change";

const coerceBoolean = (value: string | null): boolean => {
  if (!value) return false;
  return value === "true" || value === "1" || value === "on";
};

export const readEcoMode = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return coerceBoolean(window.localStorage.getItem(ECO_MODE_STORAGE_KEY));
};

export const writeEcoMode = (enabled: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(ECO_MODE_STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent<boolean>(ECO_MODE_EVENT, { detail: enabled }),
  );
};

export const onEcoModeChange = (listener: (enabled: boolean) => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const customListener = (event: Event) => {
    const customEvent = event as CustomEvent<boolean>;
    listener(Boolean(customEvent.detail));
  };

  const storageListener = (event: StorageEvent) => {
    if (event.key === ECO_MODE_STORAGE_KEY) {
      listener(coerceBoolean(event.newValue));
    }
  };

  window.addEventListener(ECO_MODE_EVENT, customListener as EventListener);
  window.addEventListener("storage", storageListener);

  return () => {
    window.removeEventListener(ECO_MODE_EVENT, customListener as EventListener);
    window.removeEventListener("storage", storageListener);
  };
};

export const syncEcoModeClass = (enabled: boolean) => {
  if (typeof document === "undefined") {
    return;
  }
  document.body.classList.toggle("eco-mode-active", enabled);
};
