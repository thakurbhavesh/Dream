const isNumeric = (value) =>
  typeof value === "number" && !Number.isNaN(value);

const normalizeDeviceType = (value) => {
  if (isNumeric(value)) {
    if (value >= 400) return "tablet";
    if (value >= 300) return "mobile";
    return "desktop";
  }
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "web" || normalized === "browser") return "web";
  if (normalized === "desktop") return "desktop";
  if (normalized === "mobile") return "mobile";
  if (normalized === "tablet") return "tablet";
  return normalized;
};

const normalizeOs = (value) => String(value || "").trim().toLowerCase();

const isIosOs = (value) =>
  value.includes("ios") ||
  value.includes("ipad") ||
  value.includes("iphone") ||
  value.includes("ipados");

const isAndroidOs = (value) => value.includes("android");

const resolveIndicatorFromValue = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (isIosOs(normalized)) {
    return { key: "ios", label: "iOS" };
  }
  if (isAndroidOs(normalized)) {
    return { key: "android", label: "Android" };
  }
  if (normalized.includes("mobile") || normalized.includes("tablet")) {
    return { key: "android", label: "Android" };
  }
  if (
    normalized.includes("desktop") ||
    normalized.includes("windows") ||
    normalized.includes("macos") ||
    normalized.includes("mac os") ||
    normalized.includes("linux") ||
    normalized.includes("ubuntu")
  ) {
    return { key: "desktop", label: "Desktop" };
  }
  if (normalized.includes("browser") || normalized.includes("web")) {
    return { key: "browser", label: "Browser" };
  }
  return { key: "browser", label: "Browser" };
};

const resolveIndicatorFromEntry = (entry) => {
  if (!entry) return null;
  if (typeof entry === "string" || typeof entry === "number") {
    return resolveIndicatorFromValue(entry);
  }
  if (typeof entry === "object") {
    return resolveDeviceIndicator(entry);
  }
  return null;
};

const dedupeIndicators = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
};

const readTimestamp = (value) => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

export const detectDeviceLabel = () => {
  if (typeof navigator === "undefined") return "Desktop";
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) return "Mobile";
  if (/Electron/i.test(ua)) return "Desktop";
  return "Browser";
};

const isDesktopOs = (value) =>
  value.includes("windows") ||
  value.includes("macos") ||
  value.includes("mac os") ||
  value.includes("linux") ||
  value.includes("ubuntu") ||
  value.includes("debian") ||
  value.includes("fedora");

export const resolveDeviceIndicator = (thread = {}) => {
  const deviceType = normalizeDeviceType(
    thread?.device_type ??
      thread?.deviceType ??
      thread?.use_device ??
      thread?.useDevice
  );
  const os = normalizeOs(
    thread?.operating_system ?? thread?.operatingSystem ?? thread?.os_name ?? thread?.os
  );

  if (isIosOs(os)) {
    return { key: "ios", label: "iOS" };
  }

  if (isAndroidOs(os)) {
    return { key: "android", label: "Android" };
  }

  if (isDesktopOs(os)) {
    return { key: "desktop", label: "Desktop" };
  }

  if (deviceType === "mobile" || deviceType === "tablet") {
    return { key: "android", label: "Android" };
  }

  if (deviceType === "desktop") {
    return { key: "desktop", label: "Desktop" };
  }

  if (deviceType === "web") {
    return { key: "browser", label: "Browser" };
  }

  return { key: "browser", label: "Browser" };
};

export const resolveDeviceIndicators = (thread = {}) => {
  const list =
    thread?.activeDevices ??
    thread?.active_devices ??
    thread?.devices ??
    thread?.deviceSessions ??
    thread?.device_sessions ??
    [];
  if (!Array.isArray(list) || list.length === 0) {
    return [resolveDeviceIndicator(thread)];
  }
  const indicators = dedupeIndicators(
    list.map(resolveIndicatorFromEntry).filter(Boolean)
  );
  return indicators.length ? indicators : [resolveDeviceIndicator(thread)];
};

export const resolveLatestDeviceIndicator = (thread = {}) => {
  const list =
    thread?.activeDevices ??
    thread?.active_devices ??
    thread?.devices ??
    thread?.deviceSessions ??
    thread?.device_sessions ??
    [];
  if (!Array.isArray(list) || list.length === 0) {
    return resolveDeviceIndicator(thread);
  }
  const sorted = [...list].sort((a, b) => {
    const aTime = readTimestamp(
      a?.lastActive ?? a?.last_seen ?? a?.updatedAt ?? a?.updated_at
    );
    const bTime = readTimestamp(
      b?.lastActive ?? b?.last_seen ?? b?.updatedAt ?? b?.updated_at
    );
    return bTime - aTime;
  });
  const indicator = resolveIndicatorFromEntry(sorted[0]);
  return indicator || resolveDeviceIndicator(thread);
};
