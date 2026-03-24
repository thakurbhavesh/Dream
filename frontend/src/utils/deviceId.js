const DEVICE_STORAGE_KEY = "chatx.deviceId";

const generateDeviceId = () =>
  typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `dev-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

export const getClientDeviceId = () => {
  if (typeof window === "undefined") return "";
  return String(window.localStorage.getItem(DEVICE_STORAGE_KEY) || "").trim();
};

export const getOrCreateClientDeviceId = () => {
  if (typeof window === "undefined") return "";
  const existing = getClientDeviceId();
  if (existing) return existing;
  const generated = generateDeviceId();
  window.localStorage.setItem(DEVICE_STORAGE_KEY, generated);
  return generated;
};

export const DEVICE_ID_STORAGE_KEY = DEVICE_STORAGE_KEY;
