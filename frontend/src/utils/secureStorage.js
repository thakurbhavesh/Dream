import { encryptString, decryptString } from "./secureCipher";

// Secure storage wrapper that keeps sensitive values encrypted before they hit
// localStorage/sessionStorage. We deliberately avoid encodeURIComponent here,
// as URL encoding would not protect the payload (only change its shape).

const SECURE_EVENT = "secure-storage:changed";

const resolveStorageArea = (type = "local") => {
  if (typeof window === "undefined") return null;
  if (type === "session") return window.sessionStorage;
  return window.localStorage;
};

const emitChange = (key, storage = "local") => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SECURE_EVENT, { detail: { key, storage } }));
};

export const secureStorage = {
  async setItem(key, value, options = {}) {
    if (typeof window === "undefined") return;
    const storageType = options.storage ?? "local";
    const storageArea = resolveStorageArea(storageType);
    if (!storageArea) return;
    const payload = await encryptString(String(value ?? ""));
    storageArea.setItem(key, payload);
    emitChange(key, storageType);
  },

  async getItem(key, options = {}) {
    if (typeof window === "undefined") return null;
    const storageType = options.storage ?? "local";
    const storageArea = resolveStorageArea(storageType);
    if (!storageArea) return null;
    const payload = storageArea.getItem(key);
    if (!payload) return null;
    const result = await decryptString(payload);
    return result ?? null;
  },

  removeItem(key, options = {}) {
    if (typeof window === "undefined") return;
    const storageType = options.storage ?? "local";
    const storageArea = resolveStorageArea(storageType);
    if (!storageArea) return;
    storageArea.removeItem(key);
    emitChange(key, storageType);
  },

  async multiSet(pairs = {}, options = {}) {
    if (typeof window === "undefined") return;
    const storageType = options.storage ?? "local";
    const entries = Object.entries(pairs);
    for (const [key, value] of entries) {
      // eslint-disable-next-line no-await-in-loop
      await secureStorage.setItem(key, value, { storage: storageType });
    }
  },

  subscribe(key, callback, options = {}) {
    if (typeof window === "undefined") return () => {};
    const storageType = options.storage ?? "local";
    const storageArea = resolveStorageArea(storageType);
    if (!storageArea) return () => {};

    const handler = async (event) => {
      if (event?.detail?.key && event.detail.key !== key) return;
      if (event?.detail?.storage && event.detail.storage !== storageType) return;
      const value = await secureStorage.getItem(key, { storage: storageType });
      callback(value);
    };

    const storageHandler = async (event) => {
      if (event.storageArea !== storageArea) return;
      if (event.key && event.key !== key) return;
      const value = await secureStorage.getItem(key, { storage: storageType });
      callback(value);
    };

    window.addEventListener(SECURE_EVENT, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(SECURE_EVENT, handler);
      window.removeEventListener("storage", storageHandler);
    };
  },
};

export default secureStorage;
