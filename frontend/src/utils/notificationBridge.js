const getBrowserPlatform = () => {
  if (typeof navigator === "undefined") {
    return "unknown";
  }
  return navigator.userAgentData?.platform || navigator.platform || "web";
};

const hasElectronBridge = () =>
  typeof window !== "undefined" &&
  Boolean(window?.electron?.notificationBridge);

const isSecureNotificationContext = () => {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
};

export const fetchNotificationContext = async () => {
  if (hasElectronBridge()) {
    try {
      const [context, systemPreference] = await Promise.all([
        window.electron.notificationBridge.getContext(),
        window.electron.notificationBridge.getSystemPreference(),
      ]);
      const fallbackPlatform =
        typeof process !== "undefined" && process?.platform
          ? process.platform
          : "electron";
      return {
        runtime: "electron",
        platform: context?.platform || fallbackPlatform,
        appUserModelId: context?.appUserModelId ?? null,
        isWindows: Boolean(context?.isWindows),
        systemPreference: systemPreference || {
          supported: false,
          enabled: null,
        },
      };
    } catch (error) {
      console.warn("Failed to fetch notification context", error);
    }
  }

  return {
    runtime: "web",
    platform: getBrowserPlatform(),
    appUserModelId: null,
    isWindows: false,
    systemPreference: {
      supported: false,
      enabled: null,
    },
  };
};

export const setSystemPreference = async (enabled) => {
  if (!hasElectronBridge()) {
    return false;
  }
  try {
    return await window.electron.notificationBridge.setSystemPreference(
      enabled
    );
  } catch (error) {
    console.warn("Failed to persist system notification preference", error);
    return false;
  }
};

export const openSystemSettings = async () => {
  if (hasElectronBridge()) {
    try {
      await window.electron.notificationBridge.openSystemSettings();
      return true;
    } catch (error) {
      console.warn("Failed to open native notification settings", error);
    }
  }

  if (typeof window !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    let url = "https://support.google.com/chrome/answer/3220216"; // default for Chromium
    if (ua.includes("firefox")) {
      url =
        "https://support.mozilla.org/en-US/kb/push-notifications-firefox";
    } else if (ua.includes("edg")) {
      url =
        "https://support.microsoft.com/en-us/microsoft-edge/block-pop-ups-in-microsoft-edge-348c7c1e-6514-3bfd-3f6f-4a05e5ab0781";
    } else if (
      ua.includes("safari") &&
      !ua.includes("chrome") &&
      !ua.includes("crios")
    ) {
      url = "https://support.apple.com/guide/safari/sfri40734/mac";
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return true;
};

export const hasNativeBridge = () => hasElectronBridge();

export const ensureNotificationPermission = async () => {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return "default";
  }
};

export const showSystemNotification = ({
  title = "TeamChatX",
  body = "",
  icon = "/teamchatXElement.png",
  tag,
  requireInteraction = false,
  silent = false,
} = {}) => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  if (Notification.permission !== "granted") {
    // Fire-and-forget request; caller can retry on next event
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    return { ok: false, reason: "permission" };
  }
  if (!isSecureNotificationContext()) {
    return { ok: false, reason: "insecure_context" };
  }

  try {
    const options = { body, icon, silent };
    if (tag) options.tag = tag;
    if (requireInteraction) options.requireInteraction = true;
    const notification = new Notification(title, options);
    try {
      notification.onclick = () => {
        try { window.focus(); } catch {}
        try { notification.close(); } catch {}
      };
    } catch {}
    return { ok: true, notification };
  } catch (error) {
    console.warn("Failed to show notification", error);
    return { ok: false, reason: "failed", error };
  }
};
