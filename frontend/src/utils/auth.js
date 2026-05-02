import { useSyncExternalStore } from "react";
import secureStorage from "./secureStorage";
import {
  clearStoredCurrentUser,
  setStoredCurrentUser,
} from "./currentUser";
import { API_BASE_URL } from "../config/apiBaseUrl";
import { ensureCsrfCookie, withCsrfHeader } from "./csrf";
import { getOrCreateClientDeviceId } from "./deviceId";

const AUTH_EVENT = "auth:changed";
const PERSISTENT_KEYS_ON_LOGOUT = ["chatx.deviceId"];
const AUTH_KEYS = {
  token: "accessToken",
  refreshToken: "refreshToken",
  username: "username",
  userId: "userId",
  email: "email",
  name: "name",
  organization: "organization",
  role: "role",
  roleKey: "role_key",
};
const REFRESH_SKEW_MS = 60 * 1000;
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000;

let refreshInFlight = null;
let refreshTickerId = null;

const emitChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EVENT));
};

const readAuthSnapshot = () => {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(AUTH_KEYS.userId));
};

const subscribe = (callback) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

const decodeJwtPayload = (token = "") => {
  try {
    const base64Payload = String(token).split(".")[1];
    if (!base64Payload) return {};
    const normalized = base64Payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return {};
  }
};

const getExpiryMs = (token = "") => {
  const payload = decodeJwtPayload(token);
  const expSec = Number(payload?.exp || 0);
  if (!Number.isFinite(expSec) || expSec <= 0) return 0;
  return expSec * 1000;
};

const isTokenNearExpiry = (token = "", skewMs = REFRESH_SKEW_MS) => {
  const expiryMs = getExpiryMs(token);
  if (!expiryMs) return true;
  return Date.now() + skewMs >= expiryMs;
};

const resolveStoredTokens = async () => {
  const accessFromSecure = await secureStorage.getItem(AUTH_KEYS.token);
  const refreshFromSecure = await secureStorage.getItem(AUTH_KEYS.refreshToken);
  const accessToken =
    String(accessFromSecure || window.localStorage.getItem(AUTH_KEYS.token) || "").trim();
  const refreshToken =
    String(refreshFromSecure || window.localStorage.getItem(AUTH_KEYS.refreshToken) || "").trim();
  return { accessToken, refreshToken };
};

const refreshSession = async () => {
  if (typeof window === "undefined") return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const clientDeviceId = getOrCreateClientDeviceId();
    const buildRefreshRequest = () =>
      withCsrfHeader({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientDeviceId ? { "X-Device-Id": clientDeviceId } : {}),
      },
      body: JSON.stringify({
        client_device_id: clientDeviceId || undefined,
      }),
    });
    const requestRefresh = async () => {
      const refreshRequest = buildRefreshRequest();
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        ...refreshRequest,
        credentials: "include",
      });
      const result = await response.json().catch(() => ({}));
      return { response, result };
    };

    let { response, result } = await requestRefresh();
    if (response.status === 403) {
      await ensureCsrfCookie(API_BASE_URL);
      ({ response, result } = await requestRefresh());
    }

    if (!response.ok || result?.status === "error") {
      const refreshError = new Error(result?.message || "Session refresh failed");
      refreshError.forceLogoutAll = Boolean(result?.errors?.force_logout_all);
      throw refreshError;
    }

    const data = result?.data || {};
    const nextAccessToken = String(data?.access_token || "").trim();
    const nextRefreshToken = String(data?.refresh_token || "").trim();

    if (nextAccessToken || nextRefreshToken) {
      await secureStorage.multiSet({
        ...(nextAccessToken ? { [AUTH_KEYS.token]: nextAccessToken } : {}),
        ...(nextRefreshToken ? { [AUTH_KEYS.refreshToken]: nextRefreshToken } : {}),
      });
    }

    emitChange();
    return { accessToken: nextAccessToken, refreshToken: nextRefreshToken };
  })()
    .catch((error) => {
      refreshInFlight = null;
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

const tryRefreshIfNeeded = async () => {
  if (typeof window === "undefined") return false;
  const { accessToken, refreshToken } = await resolveStoredTokens();
  const hasAuthSnapshot = readAuthSnapshot();

  if (!refreshToken && !hasAuthSnapshot) return Boolean(accessToken);
  // Cookie-based auth mode (AUTH_RETURN_TOKENS_IN_BODY=false): no local tokens are expected.
  // In this mode, avoid proactive refresh loops and let protected requests trigger refresh on 401.
  if (!accessToken && !refreshToken && hasAuthSnapshot) return true;
  if (accessToken && !isTokenNearExpiry(accessToken)) return true;

  try {
    await refreshSession();
    return true;
  } catch (error) {
    // Do not hard-logout on transient refresh failures for cookie-based sessions.
    // Logout only when backend explicitly marks session compromised.
    if (error?.forceLogoutAll) {
      authStore.logout();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("chatx:logout"));
      }
    }
    return false;
  }
};

export const authStore = {
  keys: AUTH_KEYS,
  isAuthenticated: () => readAuthSnapshot(),
  login: async ({
    token = "",
    refreshToken = "",
    username = "",
    id = "1",
    email = "",
    name = "",
    organization = "",
    organizationName = "",
    role = "",
    roleKey = "",
    profile = null,
    lastLoginAt = "",
    planExpired = false,
  } = {}) => {
    if (typeof window === "undefined") return;
    const normalizedToken = String(token || "").trim();
    const normalizedRefreshToken = String(refreshToken || "").trim();
    await secureStorage.multiSet({
      [AUTH_KEYS.username]: username,
      [AUTH_KEYS.userId]: String(id),
      ...(normalizedToken ? { [AUTH_KEYS.token]: normalizedToken } : {}),
      ...(normalizedRefreshToken ? { [AUTH_KEYS.refreshToken]: normalizedRefreshToken } : {}),
    });
    if (!normalizedToken) {
      await secureStorage.removeItem(AUTH_KEYS.token);
    }
    if (!normalizedRefreshToken) {
      await secureStorage.removeItem(AUTH_KEYS.refreshToken);
    }
    const normalizedName = String(name || username || "").trim();
    const normalizedEmail = String(email || "").trim();
    const normalizedOrg = String(organization || "").trim();
    const normalizedOrgName = String(organizationName || "").trim();
    const normalizedRole = String(role || "").trim();
    const normalizedRoleKey = String(roleKey || "").trim();
    window.localStorage.setItem(AUTH_KEYS.name, normalizedName);
    window.localStorage.setItem(AUTH_KEYS.email, normalizedEmail);
    window.localStorage.setItem(AUTH_KEYS.organization, normalizedOrg);
    window.localStorage.setItem(AUTH_KEYS.role, normalizedRole);
    window.localStorage.setItem(AUTH_KEYS.roleKey, normalizedRoleKey);
    await setStoredCurrentUser({
      id,
      name: normalizedName,
      username: normalizedName,
      email: normalizedEmail,
      organization: normalizedOrg,
      organizationName: normalizedOrgName,
      role: normalizedRole,
      roleKey: normalizedRoleKey,
      ...(profile && typeof profile === "object" ? profile : {}),
      planExpired: Boolean(planExpired),
      lastLoginAt,
    });
    emitChange();
  },
  logout: ({ keepKeys = [] } = {}) => {
    if (typeof window === "undefined") return;
    const preserve = new Set([...PERSISTENT_KEYS_ON_LOGOUT, ...keepKeys]);
    Object.keys(window.localStorage).forEach((key) => {
      if (!preserve.has(key)) {
        window.localStorage.removeItem(key);
      }
    });
    // Also clear secure storage tokens
    secureStorage.removeItem(AUTH_KEYS.token);
    secureStorage.removeItem(AUTH_KEYS.refreshToken);
    clearStoredCurrentUser();
    emitChange();
  },
  useAuthStatus: () =>
    useSyncExternalStore(subscribe, readAuthSnapshot, readAuthSnapshot),
  notify: emitChange,
  refreshSession,
  ensureFreshSession: tryRefreshIfNeeded,
  startAutoRefresh: () => {
    if (typeof window === "undefined") return () => {};
    if (refreshTickerId) {
      window.clearInterval(refreshTickerId);
    }
    refreshTickerId = window.setInterval(() => {
      tryRefreshIfNeeded().catch(() => {});
    }, REFRESH_CHECK_INTERVAL_MS);
    return () => {
      if (refreshTickerId) {
        window.clearInterval(refreshTickerId);
        refreshTickerId = null;
      }
    };
  },
};

export default authStore;
