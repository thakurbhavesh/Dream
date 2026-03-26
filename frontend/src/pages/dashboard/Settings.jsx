import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import useSecureStorageValue from "../../hooks/useSecureStorageValue";
import secureStorage from "../../utils/secureStorage";
import CustomScrollbars from "../../components/Scrollbar";
import {
  LOCK_STATE_KEY,
  PIN_HASH_KEY,
  PIN_SALT_KEY,
} from "../../hooks/useChatLock";
import ProfileTab from "./settings/tabs/ProfileTab";
import ChangePasswordTab from "./settings/tabs/ChangePasswordTab";
import ActivityTab from "./settings/tabs/ActivityTab";
import WallpapersTab from "./settings/tabs/WallpapersTab";
import NotificationTab from "./settings/tabs/NotificationTab";
import { SETTINGS_STORAGE_KEYS } from "./settings/storageKeys";
import { DEFAULT_PERMISSIONS } from "./settings/permissionsConfig";
import {
  parseJsonValue,
  persistJsonValue,
  fileToDataUrl,
  upsertCurrentDevice,
} from "./settings/utils";
import {
  DEFAULT_PROFILE,
  WALLPAPER_PRESETS,
  DEFAULT_WALLPAPER_SELECTION,
  normalizeProfilePayload,
} from "./settings/defaults";
import {
  fetchNotificationContext,
  setSystemPreference as persistSystemPreference,
  openSystemSettings,
  hasNativeBridge,
  showSystemNotification,
} from "../../utils/notificationBridge";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import authStore from "../../utils/auth";
import { fetchWithAuth } from "../../utils/authApi";
import { getClientDeviceId } from "../../utils/deviceId";
import useDND from "../../hooks/useDND";

// Keep the sidebar items declarative so adding a tab only requires updating this array.
const TAB_ITEMS = [
  { id: "profile", label: "Profile" },
  { id: "password", label: "Change Password" },
  { id: "activity", label: "Devices & Sessions" },
  { id: "wallpapers", label: "Wallpapers" },
  { id: "notifications", label: "Notifications & Privacy" },
];

const NOTIFICATION_SOUNDS = [
  { value: "sound1.mp3", label: "Sound 1" },
  { value: "sound2.mp3", label: "Sound 2" },
  { value: "sound3.mp3", label: "Sound 3" },
  { value: "sound4.mp3", label: "Sound 4" },
  { value: "sound5.mp3", label: "Sound 5" },
  { value: "sound6.mp3", label: "Sound 6" },
  { value: "sound7.mp3", label: "Sound 7" },
  { value: "sound8.mp3", label: "Sound 8" },
];

const DEFAULT_NOTIFICATION_SOUND = NOTIFICATION_SOUNDS[0].value;

const SOUND_BASE_PATH = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const resolveSoundAsset = (fileName = "") => {
  if (!fileName) return null;
  if (fileName.startsWith("/")) {
    return `${SOUND_BASE_PATH}${fileName}`;
  }
  return `${SOUND_BASE_PATH}/sounds/${fileName}`;
};

const toReadableDeviceLabel = ({
  deviceName = "",
  fallback = "Device",
  isCurrentDevice = false,
}) => {
  const raw = String(deviceName || "").trim();
  if (!raw) return fallback;
  if (raw.toLowerCase().startsWith("client:")) {
    if (isCurrentDevice) return "My Device";
    return "Other Device";
  }
  return raw;
};

const extractClientDeviceIdFromName = (deviceName = "") => {
  const raw = String(deviceName || "").trim();
  if (!raw.toLowerCase().startsWith("client:")) return "";
  return raw.slice("client:".length).trim();
};

const ipLocationCache = new Map();
let cachedPublicIp = "";

const normalizeIpAddress = (ipAddress = "") => {
  const raw = String(ipAddress || "").trim();
  if (!raw) return "";
  if (raw.startsWith("::ffff:")) {
    return raw.replace("::ffff:", "");
  }
  return raw;
};

const isPrivateOrLocalIp = (ipAddress = "") => {
  const ip = normalizeIpAddress(ipAddress);
  if (!ip) return true;
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") return true;
  const ipv4Parts = ip.split(".").map((part) => Number(part));
  const hasIpv4 =
    ipv4Parts.length === 4 && ipv4Parts.every((part) => Number.isInteger(part));
  if (
    (hasIpv4 && ipv4Parts[0] === 10) ||
    (hasIpv4 && ipv4Parts[0] === 192 && ipv4Parts[1] === 168) ||
    (hasIpv4 &&
      ipv4Parts[0] === 172 &&
      ipv4Parts[1] >= 16 &&
      ipv4Parts[1] <= 31) ||
    (hasIpv4 && ipv4Parts[0] === 169 && ipv4Parts[1] === 254)
  ) {
    return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  return false;
};

const fetchIpLocation = async (ipAddress = "") => {
  const ip = normalizeIpAddress(ipAddress);
  if (!ip || isPrivateOrLocalIp(ip)) return "";
  if (ipLocationCache.has(ip)) {
    return ipLocationCache.get(ip) || "";
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);
    if (!response.ok) {
      ipLocationCache.set(ip, "");
      return "";
    }
    const payload = await response.json().catch(() => ({}));
    const resolved = [payload?.city, payload?.country_name]
      .filter(Boolean)
      .join(", ");
    ipLocationCache.set(ip, resolved || "");
    return resolved || "";
  } catch {
    ipLocationCache.set(ip, "");
    return "";
  }
};

const resolvePublicIp = async () => {
  if (cachedPublicIp) return cachedPublicIp;
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3000);
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);
    if (!response.ok) return "";
    const payload = await response.json().catch(() => ({}));
    const ip = normalizeIpAddress(payload?.ip || "");
    if (!ip) return "";
    cachedPublicIp = ip;
    return ip;
  } catch {
    return "";
  }
};

const parseUserAgentLabel = (userAgent = "") => {
  const ua = String(userAgent || "");
  if (!ua) return "";

  const edgeMatch = ua.match(/EdgA?\/(\d+)/i);
  const operaMatch = ua.match(/OPR\/(\d+)/i);
  const firefoxMatch = ua.match(/Firefox\/(\d+)/i);
  const safariMatch = ua.match(/Version\/(\d+).+Safari/i);
  const chromeMatch = ua.match(/Chrome\/(\d+)/i);

  let browser = "";
  if (edgeMatch) browser = `Edge ${edgeMatch[1] || ""}`.trim();
  else if (operaMatch) browser = `Opera ${operaMatch[1] || ""}`.trim();
  else if (firefoxMatch) browser = `Firefox ${firefoxMatch[1] || ""}`.trim();
  else if (safariMatch) browser = `Safari ${safariMatch[1] || ""}`.trim();
  else if (chromeMatch) browser = `Chrome ${chromeMatch[1] || ""}`.trim();

  const platformMatch = ua.match(/\(([^)]+)\)/);
  const platformToken = platformMatch?.[1]
    ? platformMatch[1].split(";")[0].trim()
    : "";

  let platform = platformToken;
  if (/windows nt/i.test(platformToken)) platform = "Windows";
  else if (/macintosh|mac os x/i.test(platformToken)) platform = "macOS";
  else if (/android/i.test(platformToken)) platform = "Android";
  else if (/iphone|ipad|ipod|ios/i.test(platformToken)) platform = "iOS";
  else if (/linux/i.test(platformToken)) platform = "Linux";

  return [platform, browser].filter(Boolean).join(" - ");
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const mergeOsAndUaLabel = (osName = "", uaLabel = "", fallback = "") => {
  const os = String(osName || "").trim();
  const ua = String(uaLabel || "").trim();
  const fb = String(fallback || "").trim();

  if (!os && !ua) return fb || "device";
  if (!os) return ua || fb || "device";
  if (!ua) return os;

  const osRegex = new RegExp(`^${escapeRegex(os)}\\s*[-:|]\\s*`, "i");
  const uaWithoutOs = ua.replace(osRegex, "").trim();
  if (!uaWithoutOs || uaWithoutOs.toLowerCase() === os.toLowerCase()) {
    return os;
  }
  return `${os} - ${uaWithoutOs}`;
};

const mapMeDeviceToUi = async (device = {}) => {
  const currentClientDeviceId = getClientDeviceId();
  const mappedClientDeviceId = extractClientDeviceIdFromName(device?.device_name);
  const backendLocation = [device?.city, device?.country].filter(Boolean).join(", ");
  const ipAddress = normalizeIpAddress(device?.ip_address || "");
  const publicIp =
    !ipAddress || isPrivateOrLocalIp(ipAddress) ? await resolvePublicIp() : "";
  const resolvedIp = ipAddress && !isPrivateOrLocalIp(ipAddress) ? ipAddress : publicIp;
  const location =
    backendLocation ||
    (await fetchIpLocation(resolvedIp)) ||
    (resolvedIp ? `IP: ${resolvedIp}` : "Local network");
  const uaLabel = parseUserAgentLabel(device?.user_agent || "");
  const osLabel = String(device?.os_name || "").trim();
  const hostLabel = String(device?.hostname || "").trim();
  const fallbackPlatform = String(device?.device_type || "device");
  const platformLabel = mergeOsAndUaLabel(osLabel, uaLabel, fallbackPlatform);
  return {
    id: String(device?.device_id || ""),
    name: toReadableDeviceLabel({
      deviceName: device?.device_name,
      fallback: "Your Device",
      isCurrentDevice:
        Boolean(currentClientDeviceId) &&
        Boolean(mappedClientDeviceId) &&
        String(mappedClientDeviceId) === String(currentClientDeviceId),
    }),
    clientDeviceId: mappedClientDeviceId || "",
    isCurrentDevice:
      Boolean(currentClientDeviceId) &&
      Boolean(mappedClientDeviceId) &&
      String(mappedClientDeviceId) === String(currentClientDeviceId),
    platform: platformLabel,
    location: location || "Unknown location",
    hostname: hostLabel || "",
    loginAt: device?.created_at || device?.last_active_at || "",
    lastActive: device?.last_active_at || "",
    status: String(device?.status || ""),
    isTrusted: Boolean(device?.is_trusted),
    usage: device?.__usage || {
      messages: { count: 0, sizeMB: 0 },
      media: { count: 0, sizeMB: 0 },
      files: { count: 0, sizeMB: 0 },
      totalSizeMB: 0,
    },
  };
};

const formatTimelineDateTime = (value) => {
  if (!value) return "Unknown time";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
};

const hexFromBuffer = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const buildHashPayload = (pin, saltHex) => `${pin}:${saltHex}`;

// Hashing helper used for the chat lock PIN workflow.
const hashPinWithSalt = async (pin, saltHex = "") => {
  const payload = buildHashPayload(pin, saltHex);
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return btoa(payload);
  }

  const encoder = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(payload)
  );

  return hexFromBuffer(hashBuffer);
};

const generateSaltHex = () => {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    return Math.random().toString(16).slice(2, 34).padEnd(32, "0");
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return hexFromBuffer(bytes.buffer);
};

// Broadcast lock state changes so the top bar button stays in sync.
const emitLockStateChange = (locked, hasPin) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("chat-lock:state-changed", {
      detail: { locked, hasPin },
    })
  );
};

const Settings = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const passwordLogoutTimerRef = useRef(null);
  const [activeTab, setActiveTab] = useState("profile");
  const { isDND, toggleDND, dndState, setDNDSchedule } = useDND();
  const storedPermissionsRaw = useSecureStorageValue(
    SETTINGS_STORAGE_KEYS.permissions,
    JSON.stringify(DEFAULT_PERMISSIONS)
  );
  const parsedPermissions = useMemo(() => {
    const stored = parseJsonValue(storedPermissionsRaw, null);
    if (!Array.isArray(stored)) {
      return DEFAULT_PERMISSIONS;
    }
    return DEFAULT_PERMISSIONS.map((perm) => {
      const existing = stored.find((item) => item.id === perm.id);
      return existing ? { ...perm, ...existing } : perm;
    });
  }, [storedPermissionsRaw]);
  const [permissions, setPermissions] = useState(parsedPermissions);
  const [deviceCapabilities, setDeviceCapabilities] = useState({
    microphone: null,
    camera: null,
  });
  const [notificationInfo, setNotificationInfo] = useState(() => ({
    runtime: hasNativeBridge() ? "electron" : "web",
    platform:
      typeof navigator !== "undefined"
        ? navigator.userAgentData?.platform || navigator.platform || "web"
        : "web",
    permission:
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported",
    systemPreference: {
      supported: false,
      enabled: null,
    },
  }));
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [remoteProfilePatch, setRemoteProfilePatch] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [remoteDevices, setRemoteDevices] = useState(null);
  const [remoteLastLogin, setRemoteLastLogin] = useState("");

  const storedProfileRaw = useSecureStorageValue(
    SETTINGS_STORAGE_KEYS.profile,
    ""
  );
  const profile = useMemo(() => {
    const localProfile = parseJsonValue(storedProfileRaw, {});
    const merged = remoteProfilePatch
      ? { ...localProfile, ...remoteProfilePatch }
      : localProfile;
    return normalizeProfilePayload(merged);
  }, [storedProfileRaw, remoteProfilePatch]);

  const devicesRaw = useSecureStorageValue(SETTINGS_STORAGE_KEYS.devices, "[]");
  const devices = useMemo(
    () => (Array.isArray(remoteDevices) ? remoteDevices : parseJsonValue(devicesRaw, [])),
    [devicesRaw, remoteDevices]
  );
  const otherDeviceTimeline = useMemo(
    () =>
      (devices || [])
        .filter((device) => !device?.isCurrentDevice)
        .filter((device) => String(device?.status || "").toLowerCase() !== "logged_out")
        .sort(
          (a, b) =>
            new Date(b?.loginAt || b?.lastActive || 0).getTime() -
            new Date(a?.loginAt || a?.lastActive || 0).getTime()
        )
        .map((device, index) => ({
          id: String(device?.id || index + 1),
          title: `${device?.name || "Device"} • ${device?.platform || "Unknown platform"}${
            device?.location ? ` • ${device.location}` : ""
          }`,
          timeLabel: formatTimelineDateTime(device?.loginAt || device?.lastActive || ""),
          ip: "",
          status: "",
        })),
    [devices]
  );

  const wallpaperRaw = useSecureStorageValue(
    SETTINGS_STORAGE_KEYS.wallpaper,
    JSON.stringify(DEFAULT_WALLPAPER_SELECTION)
  );
  const wallpaperSelection = useMemo(
    () => parseJsonValue(wallpaperRaw, DEFAULT_WALLPAPER_SELECTION),
    [wallpaperRaw]
  );

  const notificationSoundRaw = useSecureStorageValue(
    SETTINGS_STORAGE_KEYS.notificationSound,
    DEFAULT_NOTIFICATION_SOUND
  );
  const [notificationSound, setNotificationSound] = useState(
    notificationSoundRaw || DEFAULT_NOTIFICATION_SOUND
  );

  // Track whether a PIN already exists to decide which inputs to render.
  const lastLogin = useSecureStorageValue(SETTINGS_STORAGE_KEYS.lastLogin, "");
  const displayedLastLogin = remoteLastLogin || lastLogin;
  const [hasChatPin, setHasChatPin] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.localStorage.getItem(PIN_HASH_KEY));
  });

  // Keep the local `hasChatPin` flag synced with updates coming from other tabs/windows.
  useEffect(() => {
    upsertCurrentDevice().catch((error) =>
      console.warn("Failed to refresh device info", error)
    );
  }, []);

  useEffect(() => {
    let disposed = false;

    const hydrateFromMe = async () => {
      try {
        const { response, payload: result } = await fetchWithAuth(`${API_BASE_URL}/auth/me`, {
          method: "GET",
        });
        if (!response.ok || result?.status === "error" || disposed) return;

        const data = result?.data || {};
        const meUser = data?.user || {};
        const meOrg = data?.organization || {};
        const meMember = data?.organization_member || {};
        const meRole = data?.user_role || {};
        const apiUsage = data?.usage || null;
        const meDevices = (Array.isArray(data?.user_devices) ? data.user_devices : [])
          .map((d) => ({ ...d, __usage: apiUsage }));

        const sessionLastUsed = Array.isArray(data?.user_sessions)
          ? data.user_sessions
              .map((item) => item?.last_used_at || item?.created_at || "")
              .filter(Boolean)
              .sort()
              .at(-1) || ""
          : "";
        const deviceLastActive = meDevices
          .map((item) => item?.last_active_at || "")
          .filter(Boolean)
          .sort()
          .at(-1) || "";
        const resolvedLastLogin =
          meUser?.last_login_at || sessionLastUsed || deviceLastActive || "";

        const profilePatch = {
          id: meUser?.user_id || "",
          user_id: meUser?.user_id || "",
          name: meUser?.name || "",
          displayName: meUser?.name || "",
          fullName: meUser?.name || "",
          username: meUser?.name || "",
          email: meUser?.email || "",
          mobile: meUser?.mobile || "",
          avatar: meUser?.profile_url || "",
          role: meRole?.role_name || meRole?.role_key || "",
          designation: meMember?.designation_name || meRole?.role_name || "",
          department: meMember?.department_name || "",
          location: meMember?.location_name || "",
          company: meOrg?.name || "",
          organizationId: meOrg?.organization_id || "",
          organization_id: meOrg?.organization_id || "",
          organizationLabel: meOrg?.name || "",
          timezone: meUser?.timezone || "UTC",
        };

        // Set global timezone for time formatting
        const { setUserTimezone } = await import("../../utils/timezone.js");
        setUserTimezone(meUser?.timezone || "UTC");

        const mappedDevices = await Promise.all(meDevices.map(mapMeDeviceToUi));
        setRemoteProfilePatch(profilePatch);
        setRemoteDevices(mappedDevices);
        setRemoteLastLogin(resolvedLastLogin);

        await persistJsonValue(SETTINGS_STORAGE_KEYS.profile, profilePatch);
        await persistJsonValue(SETTINGS_STORAGE_KEYS.devices, mappedDevices);
        if (resolvedLastLogin) {
          await secureStorage.setItem(SETTINGS_STORAGE_KEYS.lastLogin, resolvedLastLogin);
        }
      } catch (error) {
        console.warn("Failed to hydrate settings from /auth/me", error);
      }
    };

    hydrateFromMe();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    setPermissions(parsedPermissions);
  }, [parsedPermissions]);

  useEffect(() => {
    return () => {
      if (passwordLogoutTimerRef.current) {
        window.clearTimeout(passwordLogoutTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = window.electron?.ipcRenderer;
    if (!bridge?.send) return;
    try {
      bridge.send("permissions:update", permissions);
    } catch (error) {
      console.warn("Failed to sync permissions with native shell", error);
    }
  }, [permissions]);

  useEffect(() => {
    setNotificationSound(notificationSoundRaw || DEFAULT_NOTIFICATION_SOUND);
  }, [notificationSoundRaw]);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      return;
    }
    let cancelled = false;
    const detectDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setDeviceCapabilities({
          microphone: devices.some((device) => device.kind === "audioinput"),
          camera: devices.some((device) => device.kind === "videoinput"),
        });
      } catch (error) {
        console.warn("Failed to enumerate media devices", error);
      }
    };
    detectDevices();
    const handleDeviceChange = () => detectDevices();
    if (navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
      return () => {
        cancelled = true;
        navigator.mediaDevices.removeEventListener(
          "devicechange",
          handleDeviceChange
        );
      };
    }
    const previousHandler = navigator.mediaDevices.ondevicechange;
    navigator.mediaDevices.ondevicechange = handleDeviceChange;
    return () => {
      cancelled = true;
      navigator.mediaDevices.ondevicechange = previousHandler || null;
    };
  }, []);

  useEffect(() => {
    const syncPinPresence = (event) => {
      if (event?.type === "chat-lock:state-changed" && event.detail) {
        setHasChatPin(Boolean(event.detail.hasPin));
        return;
      }
      if (typeof window === "undefined") return;
      setHasChatPin(Boolean(window.localStorage.getItem(PIN_HASH_KEY)));
    };

    syncPinPresence();

    if (typeof window === "undefined") return undefined;

    window.addEventListener("storage", syncPinPresence);
    window.addEventListener("chat-lock:state-changed", syncPinPresence);

    return () => {
      window.removeEventListener("storage", syncPinPresence);
      window.removeEventListener("chat-lock:state-changed", syncPinPresence);
    };
  }, []);

 

  const showToast = useCallback((message, severity = "success") => {
    setToast({ open: true, message, severity });
  }, []);

  const persistPermissions = useCallback(async (nextPermissions) => {
    await persistJsonValue(SETTINGS_STORAGE_KEYS.permissions, nextPermissions);
  }, []);

  const setNotificationPermissionFlag = useCallback(
    (enabled) => {
      setPermissions((prev) => {
        const next = prev.map((perm) =>
          perm.id === "notifications" ? { ...perm, enabled } : perm
        );
        persistPermissions(next);
        return next;
      });
    },
    [persistPermissions]
  );

  const readBrowserNotificationPermission = useCallback(async () => {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({
          name: "notifications",
        });
        return status.state;
      } catch (error) {
        console.warn("Unable to query notification permission", error);
      }
    }
    if (typeof Notification !== "undefined") {
      return Notification.permission;
    }
    return "unsupported";
  }, []);

  const refreshNotificationInfo = useCallback(async () => {
    try {
      const context = await fetchNotificationContext();
      const permission = await readBrowserNotificationPermission();
      setNotificationInfo({
        runtime: context.runtime,
        platform: context.platform,
        permission,
        systemPreference: context.systemPreference,
      });
    } catch (error) {
      console.warn("Failed to refresh notification info", error);
    }
  }, [readBrowserNotificationPermission]);

  useEffect(() => {
    refreshNotificationInfo();
  }, [refreshNotificationInfo]);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.permissions?.query
    ) {
      return undefined;
    }

    let disposed = false;
    const setup = async () => {
      try {
        const status = await navigator.permissions.query({
          name: "notifications",
        });
        if (disposed) return;
        const handleChange = () => refreshNotificationInfo();
        status.addEventListener("change", handleChange);
        return () => status.removeEventListener("change", handleChange);
      } catch (error) {
        console.warn("Failed to subscribe to notification permission", error);
        return undefined;
      }
    };

    let cleanup;
    setup().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [refreshNotificationInfo]);

  const requestMediaPermission = useCallback(async (kind) => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return false;
    }
    const constraints =
      kind === "microphone" ? { audio: true } : { video: true };
    try {
      await navigator.mediaDevices.getUserMedia(constraints);
      return true;
    } catch (error) {
      console.warn(`Failed to request ${kind} permission`, error);
      return false;
    }
  }, []);

  const persistProfile = useCallback(
    async (patch = {}) => {
      const nextProfile = normalizeProfilePayload({ ...profile, ...patch });
      await persistJsonValue(SETTINGS_STORAGE_KEYS.profile, nextProfile);
    },
    [profile]
  );

  const handleAvatarFile = useCallback(
    async (file) => {
      if (!file) return;
      setAvatarUploading(true);
      try {
        const formData = new FormData();
        formData.append("avatar", file);
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/upload/profile-picture`,
          { method: "POST", body: formData }
        );
        if (!response.ok) {
          showToast(payload?.message || "Upload failed", "error");
          return;
        }
        const profileUrl = payload?.data?.profile_url || "";
        setRemoteProfilePatch((prev) => prev ? { ...prev, avatar: profileUrl } : prev);
        await persistProfile({ avatar: profileUrl });
        showToast("Profile picture updated");
      } catch (err) {
        console.error("Avatar upload error", err);
        showToast("Failed to upload profile picture", "error");
      } finally {
        setAvatarUploading(false);
      }
    },
    [persistProfile, showToast]
  );

  const handleAvatarRemove = useCallback(async () => {
    setAvatarUploading(true);
    try {
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/upload/profile-picture`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        showToast(payload?.message || "Failed to remove picture", "error");
        return;
      }
      setRemoteProfilePatch((prev) => prev ? { ...prev, avatar: "" } : prev);
      await persistProfile({ avatar: "" });
      showToast("Profile picture removed", "info");
    } catch (err) {
      console.error("Avatar remove error", err);
      showToast("Failed to remove profile picture", "error");
    } finally {
      setAvatarUploading(false);
    }
  }, [persistProfile, showToast]);

  const handlePasswordChange = useCallback(
    async ({ current, next, confirm }) => {
      try {
        if (!current || !next || !confirm) {
          showToast("All password fields are required", "error");
          return false;
        }
        if (String(next).length < 8) {
          showToast("New password must be at least 8 characters", "error");
          return false;
        }
        if (next !== confirm) {
          showToast("Passwords do not match", "error");
          return false;
        }

        const { response, payload: result } = await fetchWithAuth(`${API_BASE_URL}/auth/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            old_password: current,
            new_password: next,
            confirm_password: confirm,
          }),
        });
        if (!response.ok || result?.status === "error") {
          throw new Error(result?.message || "Unable to update password");
        }

        showToast(result?.message || "Password changed successfully");
        if (passwordLogoutTimerRef.current) {
          window.clearTimeout(passwordLogoutTimerRef.current);
        }
        passwordLogoutTimerRef.current = window.setTimeout(() => {
          window.dispatchEvent(new Event("chatx:logout"));
          authStore.logout();
          navigate("/auth/login", {
            replace: true,
            state: {
              toast: {
                message: "Password changed. Please login again.",
                severity: "success",
              },
            },
          });
        }, 1400);
        return true;
      } catch (error) {
        showToast(error?.message || "Unable to update password", "error");
        return false;
      }
    },
    [navigate, showToast]
  );

  const handleWallpaperSelect = useCallback(
    async (wallpaper) => {
      await persistJsonValue(SETTINGS_STORAGE_KEYS.wallpaper, {
        id: wallpaper.id,
        url: wallpaper.preview,
        type: "preset",
      });
      showToast("Wallpaper applied");
    },
    [showToast]
  );

  const handleWallpaperUpload = useCallback(
    async (file) => {
      if (!file) return;
      const dataUrl = await fileToDataUrl(file);
      await persistJsonValue(SETTINGS_STORAGE_KEYS.wallpaper, {
        id: `custom-${Date.now()}`,
        url: dataUrl,
        type: "custom",
      });
      showToast("Custom wallpaper applied");
    },
    [showToast]
  );

  const handleWallpaperReset = useCallback(async () => {
    await persistJsonValue(
      SETTINGS_STORAGE_KEYS.wallpaper,
      DEFAULT_WALLPAPER_SELECTION
    );
    showToast("Wallpaper reset", "info");
  }, [showToast]);

  const handleLogoutAllDevices = useCallback(async () => {
    try {
      const { response, payload: result } = await fetchWithAuth(`${API_BASE_URL}/auth/logout-all`, {
        method: "POST",
        headers: {},
      });
      if (!response.ok || result?.status === "error") {
        throw new Error(result?.message || "Unable to logout from all devices");
      }

      setRemoteDevices([]);
      await persistJsonValue(SETTINGS_STORAGE_KEYS.devices, []);
      showToast(result?.message || "Logged out from all devices");

      if (passwordLogoutTimerRef.current) {
        window.clearTimeout(passwordLogoutTimerRef.current);
      }
      passwordLogoutTimerRef.current = window.setTimeout(() => {
        window.dispatchEvent(new Event("chatx:logout"));
        authStore.logout();
        navigate("/auth/login", {
          replace: true,
          state: {
            toast: {
              message: "Logged out from all devices",
              severity: "success",
            },
          },
        });
      }, 1000);
    } catch (error) {
      showToast(error?.message || "Unable to logout from all devices", "error");
    }
  }, [navigate, showToast]);

  const handleLogoutDevice = useCallback(
    async (deviceId) => {
      if (!deviceId) return;
      try {
        const { response, payload: result } = await fetchWithAuth(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ device_id: Number(deviceId) }),
        });
        if (!response.ok || result?.status === "error") {
          throw new Error(result?.message || "Unable to logout device");
        }

        const nextDevices = devices.filter((device) => device.id !== deviceId);
        setRemoteDevices(nextDevices);
        await persistJsonValue(SETTINGS_STORAGE_KEYS.devices, nextDevices);
        showToast("Device session removed", "info");
      } catch (error) {
        showToast(error?.message || "Unable to logout device", "error");
      }
    },
    [devices, showToast]
  );

  const handleRevokeTrustedDevice = useCallback(
    async (deviceId) => {
      if (!deviceId) return;
      try {
        const { response, payload: result } = await fetchWithAuth(
          `${API_BASE_URL}/auth/trusted-devices/${Number(deviceId)}/revoke`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok || result?.status === "error") {
          throw new Error(result?.message || "Unable to revoke trusted device");
        }

        const nextDevices = devices.map((device) =>
          String(device.id) === String(deviceId)
            ? { ...device, isTrusted: false, status: "logged_out" }
            : device
        );
        setRemoteDevices(nextDevices);
        await persistJsonValue(SETTINGS_STORAGE_KEYS.devices, nextDevices);
        showToast("Trusted device revoked", "success");
      } catch (error) {
        showToast(error?.message || "Unable to revoke trusted device", "error");
      }
    },
    [devices, showToast]
  );

  const handlePinUpdate = useCallback(
    async ({ currentPin, newPin, confirmPin }) => {
      // Validate the pin change by mirroring the same checks the modal enforces.
      const sanitizedNewPin = (newPin ?? "").trim();
      const sanitizedConfirmPin = (confirmPin ?? "").trim();
      const sanitizedCurrentPin = (currentPin ?? "").trim();

      if (!/^[0-9]{4}$/.test(sanitizedNewPin)) {
        showToast("PIN must be exactly 4 digits", "error");
        return false;
      }

      if (sanitizedNewPin !== sanitizedConfirmPin) {
        showToast("PINs do not match", "error");
        return false;
      }

      if (typeof window === "undefined") {
        showToast("PINs can only be updated in the browser", "error");
        return false;
      }

      const storedHash = window.localStorage.getItem(PIN_HASH_KEY);
      const storedSalt = window.localStorage.getItem(PIN_SALT_KEY) ?? "";

      if (storedHash) {
        if (!/^[0-9]{4}$/.test(sanitizedCurrentPin)) {
          showToast("Current PIN is required to update it", "error");
          return false;
        }
        const verificationHash = await hashPinWithSalt(
          sanitizedCurrentPin,
          storedSalt
        );
        if (verificationHash !== storedHash) {
          showToast("Current PIN is incorrect", "error");
          return false;
        }
      }

      try {
        const salt = generateSaltHex();
        const newHash = await hashPinWithSalt(sanitizedNewPin, salt);

        window.localStorage.setItem(PIN_HASH_KEY, newHash);
        window.localStorage.setItem(PIN_SALT_KEY, salt);
        window.localStorage.setItem(LOCK_STATE_KEY, "unlocked");
        emitLockStateChange(false, true);
        setHasChatPin(true);
        showToast(
          storedHash ? "Chat lock PIN updated" : "Chat lock PIN created"
        );
        return true;
      } catch (error) {
        console.error("Failed to update chat lock PIN", error);
        showToast("Unable to update chat lock PIN", "error");
        return false;
      }
    },
    [showToast]
  );

  const notificationPermissionSetting = permissions.find(
    (perm) => perm.id === "notifications"
  );
  const browserPermissionLabel =
    notificationPermissionSetting && notificationPermissionSetting.enabled
      ? notificationInfo.permission
      : notificationPermissionSetting
      ? "blocked"
      : notificationInfo.permission;

  const handleNotificationAllow = useCallback(async () => {
    try {
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission !== "granted"
      ) {
        await Notification.requestPermission();
      }
      await persistSystemPreference(true);
      await refreshNotificationInfo();
      setNotificationPermissionFlag(true);
      showToast("Notifications enabled");
    } catch (error) {
      console.error("Failed to enable notifications", error);
      showToast("Unable to enable notifications", "error");
    }
  }, [refreshNotificationInfo, setNotificationPermissionFlag, showToast]);

  const handleNotificationDeny = useCallback(async () => {
    try {
      await persistSystemPreference(false);
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        showToast(
          "Disable notifications from browser/system settings to fully block alerts",
          "warning"
        );
      } else {
        showToast("Notifications blocked", "warning");
      }
      await refreshNotificationInfo();
      setNotificationPermissionFlag(false);
    } catch (error) {
      console.error("Failed to update notification preference", error);
      showToast("Unable to update notification preference", "error");
    }
  }, [refreshNotificationInfo, setNotificationPermissionFlag, showToast]);




  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined" || !notificationSound) return;
    try {
      const soundUrl = resolveSoundAsset(notificationSound);
      if (!soundUrl) return;
      const audio = new Audio(soundUrl);
      audio.play().catch((error) => {
        console.warn("Failed to play notification sound", error);
      });
    } catch (error) {
      console.warn("Failed to initialize notification sound", error);
    }
  }, [notificationSound]);



  const handleNotificationTest = useCallback(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      showToast("Notifications are unsupported in this environment", "error");
      return;
    }
    if (browserPermissionLabel !== "granted") {
      showToast("Please allow notifications first", "warning");
      return;
    }
    if (
      !window.isSecureContext &&
      !["localhost", "127.0.0.1"].includes(window.location.hostname)
    ) {
      showToast(
        "Notifications require HTTPS in browsers. Please use a secure origin.",
        "warning"
      );
      return;
    }
    try {
      const result = showSystemNotification({
        title: "TeamChatX",
        body: "Notifications are working!",
        icon: "/teamchatXElement.png",
      });
      if (!result?.ok) {
        throw result?.error || new Error("Notification dispatch failed");
      }
      playNotificationSound();
      showToast("Test notification sent");
    } catch (error) {
      console.error("Failed to show notification", error);
      showToast("Unable to show notification", "error");
    }
  }, [browserPermissionLabel, playNotificationSound, showToast]);

  const handleOpenNotificationSettings = useCallback(() => {
    openSystemSettings();
    showToast("Opening notification settings...", "info");
  }, [showToast]);

  const handleNotificationSoundChange = useCallback(async (value) => {
    setNotificationSound(value);
    await secureStorage.setItem(SETTINGS_STORAGE_KEYS.notificationSound, value);
  }, []);

  

  const handleNotificationSoundPreview = useCallback(() => {
    playNotificationSound();
  }, [playNotificationSound]);

  const handlePermissionToggle = useCallback(
    async (id) => {
      const current = permissions.find((perm) => perm.id === id);
      if (!current) return;
      if (
        current.requiresDevice &&
        deviceCapabilities[current.requiresDevice] === false
      ) {
        showToast(`${current.label} not available on this device`, "error");
        return;
      }
      const willEnable = !current.enabled;
      if (id === "notifications") {
        if (willEnable) {
          await handleNotificationAllow();
        } else {
          await handleNotificationDeny();
        }
        return;
      }
      const nextPermissions = permissions.map((perm) =>
        perm.id === id ? { ...perm, enabled: willEnable } : perm
      );
      setPermissions(nextPermissions);
      persistPermissions(nextPermissions);
      if (willEnable && (id === "microphone" || id === "camera")) {
        const granted = await requestMediaPermission(id);
        if (!granted) {
          const rollback = permissions.map((perm) =>
            perm.id === id ? { ...perm, enabled: false } : perm
          );
          setPermissions(rollback);
          persistPermissions(rollback);
          showToast(`${current.label} permission denied`, "error");
          return;
        }
        showToast(`${current.label} permission enabled`, "success");
        return;
      }
      showToast(
        `${current.label} ${willEnable ? "enabled" : "disabled"}`,
        willEnable ? "success" : "warning"
      );
    },
    [
      deviceCapabilities,
      handleNotificationAllow,
      handleNotificationDeny,
      permissions,
      persistPermissions,
      requestMediaPermission,
      showToast,
    ]
  );

  // Swap the right pane contents based on the selected tab.
  const renderActiveComponent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <ProfileTab
            user={profile}
            lastLogin={displayedLastLogin}
            onUpload={() => avatarInputRef.current?.click()}
            onRemove={handleAvatarRemove}
            avatarUploading={avatarUploading}
            onTimezoneChange={async (tz) => {
              const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/auth/me/timezone`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ timezone: tz }),
              });
              if (response.ok) {
                setRemoteProfilePatch((prev) => ({ ...prev, timezone: tz }));
                await persistProfile({ timezone: tz });
                showToast("Timezone updated", "success");
              } else {
                showToast(payload?.message || "Failed to update timezone", "error");
              }
            }}
          />
        );
      case "password":
        return (
          <ChangePasswordTab
            onSubmit={handlePasswordChange}
            onPinSubmit={handlePinUpdate}
            hasExistingPin={hasChatPin}
          />
        );
      case "activity":
        return (
          <ActivityTab
            devices={devices}
            timeline={otherDeviceTimeline}
            onLogoutAll={handleLogoutAllDevices}
            onLogoutDevice={handleLogoutDevice}
            onRevokeTrust={handleRevokeTrustedDevice}
          />
        );
      case "wallpapers":
        return (
          <WallpapersTab
            wallpapers={WALLPAPER_PRESETS}
            selectedWallpaper={wallpaperSelection}
            onSelect={handleWallpaperSelect}
            onUpload={handleWallpaperUpload}
            onReset={handleWallpaperReset}
          />
        );
      case "notifications":
        return (
          <NotificationTab
            runtimeLabel={
              notificationInfo.runtime === "electron"
                ? notificationInfo.platform === "win32"
                  ? "Windows Desktop App"
                  : "Desktop App"
                : "Web Browser"
            }
            browserPermission={browserPermissionLabel}
            systemPreference={notificationInfo.systemPreference}
            onTest={handleNotificationTest}
            onOpenSettings={handleOpenNotificationSettings}
            permissions={permissions}
            onTogglePermission={handlePermissionToggle}
            deviceCapabilities={deviceCapabilities}
            soundOptions={NOTIFICATION_SOUNDS}
            selectedSound={notificationSound}
            onSoundChange={handleNotificationSoundChange}
            onSoundPreview={handleNotificationSoundPreview}
            dndEnabled={isDND}
            onDNDToggle={toggleDND}
            dndSchedule={dndState.schedule}
            onDNDScheduleToggle={(active) => setDNDSchedule(active ? (dndState.schedule || { active: true, startTime: "22:00", endTime: "07:00", days: [0,1,2,3,4,5,6] }) : null)}
            onDNDScheduleChange={(field, value) => setDNDSchedule({ ...(dndState.schedule || {}), [field]: value })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box flex={1} sx={{ height: "100%", bgcolor: "background.paper", p: 2 }}>
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          borderRadius: 1,
          overflow: "hidden",
          border: (t) => `1px solid ${t.palette.divider}`,
          height: "100%",
        }}
      >
        <Box
          sx={{
            width: { xs: 220, sm: 260 },
            bgcolor: theme.palette.mode === "light" ? theme.palette.divider :  theme.palette.background.paper,
            borderRight: (t) => `1px solid ${t.palette.divider}`,
            p: 3,
          }}
        >
          <Stack
            spacing={2}
            alignItems="center"
            textAlign="center"
            sx={{ mb: 3 }}
          >
            <Avatar
              src={profile.avatar}
              alt={profile.name}
              sx={{ width: 72, height: 72 }}
            />
            <Box>
              <Typography sx={{ fontWeight: 600 }}>{profile.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {profile.role}
              </Typography>
            </Box>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <List component="nav" disablePadding>
            {TAB_ITEMS.map((tab) => (
              <ListItemButton
                key={tab.id}
                selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  "&.Mui-selected": {
                    background: theme.palette.primary.light,
                    color: "#fff"
                  },
                }}
              >
                <ListItemText
                  primary={tab.label}
                  primaryTypographyProps={{ fontWeight: 400 }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Box
          sx={{
            flex: 1,
            bgcolor: "background.default",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Reuse the app-wide custom scrollbar so tall tabs remain accessible. */}
          <CustomScrollbars>
            <Box sx={{ p: 4, minHeight: "100%" }}>
              {renderActiveComponent()}
            </Box>
          </CustomScrollbars>
        </Box>
      </Paper>

      <input
        type="file"
        hidden
        accept="image/*"
        ref={avatarInputRef}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            handleAvatarFile(file);
          }
          event.target.value = "";
        }}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert severity={toast.severity} sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;


