import secureStorage from "../../../utils/secureStorage";
import { SETTINGS_STORAGE_KEYS } from "./storageKeys";

// Safely parse JSON from secure storage without crashing the UI.
export const parseJsonValue = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Failed to parse settings value", error);
    return fallback;
  }
};

// Persist structured data using secure storage for a consistent API.
export const persistJsonValue = (key, value) =>
  secureStorage.setItem(key, JSON.stringify(value ?? null));

// Build a lightweight description of the current browser/device session.
export const detectDeviceMeta = () => {
  if (typeof navigator === "undefined") {
    return {
      id: "unknown",
      name: "Unknown Device",
      platform: "N/A",
      location: "Unknown",
      lastActive: new Date().toISOString(),
    };
  }

  const ua = navigator.userAgent;
  const platform = navigator.platform || "unknown";

  const browserMatch =
    ua.match(/(firefox|msie|chrome|safari|edge(?=\/))\/?\s*(\d+)/i) || [];
  const browser =
    browserMatch.length > 0
      ? `${browserMatch[1]} ${browserMatch[2] ?? ""}`
      : "Browser";

  return {
    id: `${platform}-${browser}`.toLowerCase(),
    name: "Your Device",
    platform: `${platform} · ${browser}`,
    location: "This device",
    lastActive: new Date().toISOString(),
  };
};

// Merge or insert the current device into the stored session list.
export const upsertCurrentDevice = async ({ updateLastLogin = false } = {}) => {
  const existingRaw = await secureStorage.getItem(SETTINGS_STORAGE_KEYS.devices);
  const existing = parseJsonValue(existingRaw, []);
  const device = detectDeviceMeta();

  const next = [
    device,
    ...existing.filter((item) => item.id !== device.id),
  ].slice(0, 6);

  await persistJsonValue(SETTINGS_STORAGE_KEYS.devices, next);
  if (updateLastLogin) {
    await secureStorage.setItem(SETTINGS_STORAGE_KEYS.lastLogin, device.lastActive);
  }
};

// Convert an uploaded file into a data URL so it can be previewed immediately.
export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
