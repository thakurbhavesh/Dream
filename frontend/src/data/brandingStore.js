import { appBrandingAssets } from "./CommonData";

const MASCOT_STORAGE_KEY = "teamchatx.branding.mascot";

const listeners = new Set();

let currentMascot = appBrandingAssets.mascot;

const readStoredMascot = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(MASCOT_STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to read mascot from storage:", error);
    return null;
  }
};

const persistMascot = (value) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (value) {
      window.localStorage.setItem(MASCOT_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(MASCOT_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Failed to persist mascot selection:", error);
  }
};

if (typeof window !== "undefined") {
  const storedMascot = readStoredMascot();
  if (storedMascot) {
    currentMascot = storedMascot;
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== MASCOT_STORAGE_KEY) {
      return;
    }
    currentMascot = event.newValue || appBrandingAssets.mascot;
    listeners.forEach((listener) => listener(currentMascot));
  });
}

export const getMascotAsset = () => currentMascot;

export const updateMascotAsset = (value) => {
  currentMascot = value || appBrandingAssets.mascot;
  persistMascot(value);
  listeners.forEach((listener) => listener(currentMascot));
};

export const resetMascotAsset = () => {
  updateMascotAsset(null);
};

export const subscribeToMascot = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
