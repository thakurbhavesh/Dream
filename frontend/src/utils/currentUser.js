import { useSyncExternalStore } from "react";
import secureStorage from "./secureStorage";
import { normalizeProfilePayload } from "../data/userProfile";

const USER_CHANGED_EVENT = "chatx:user-profile-changed";
const USER_STORAGE_KEY = "chatx.currentUser";
const SECURE_PROFILE_KEY = "chatx.userProfile";
const LAST_LOGIN_STORAGE_KEY = "chatx.lastLoginAt";

const ROLE_BY_KEY = {
  OWNER: 1,
  ADMIN: 2,
  MEMBER: 3,
};

let cachedRawUser = null;
let cachedParsedUser = null;
let cachedLegacyKey = null;
let cachedLegacyUser = null;

const sanitizeString = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toNumericRole = (rawRole, rawRoleKey) => {
  const roleNumber = Number(rawRole);
  if (Number.isFinite(roleNumber) && roleNumber > 0) {
    return roleNumber;
  }
  const normalizedKey = sanitizeString(rawRoleKey).toUpperCase();
  return ROLE_BY_KEY[normalizedKey] || 3;
};

const toRoleKey = (rawRoleKey, roleNumber) => {
  const normalizedKey = sanitizeString(rawRoleKey).toUpperCase();
  if (normalizedKey) {
    return normalizedKey;
  }
  if (roleNumber === 1) return "OWNER";
  if (roleNumber === 2) return "ADMIN";
  return "MEMBER";
};

const normalizeCurrentUser = (raw = {}) => {
  const role = toNumericRole(raw.role, raw.roleKey);
  const roleKey = toRoleKey(raw.roleKey, role);
  const name = sanitizeString(
    raw.name || raw.displayName || raw.username || raw.email,
    "User"
  );
  const email = sanitizeString(raw.email || "");
  const organization = sanitizeString(
    raw.organization ??
      raw.organizationId ??
      raw.organization_id ??
      raw.organizationName,
    ""
  );

  const planExpired = Boolean(
    raw.planExpired ||
      raw.plan_expired ||
      String(raw.subscription_status || "").toLowerCase() === "expired" ||
      String(raw.plan_status || "").toLowerCase() === "expired"
  );

  return {
    id: sanitizeString(raw.id, ""),
    name,
    displayName: name,
    username: sanitizeString(raw.username || name, name),
    email,
    organization,
    organizationName: sanitizeString(raw.organizationName || "", ""),
    role,
    roleKey,
    image: sanitizeString(raw.image || raw.avatar || "", ""),
    remainingCredits: Number(raw.remainingCredits ?? 0) || 0,
    planExpired,
  };
};

const emitUserChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
  window.dispatchEvent(new Event("chatx:display-name"));
};

const readFromLegacyKeys = () => {
  if (typeof window === "undefined") return null;
  const name = sanitizeString(
    window.localStorage.getItem("name") ||
      window.localStorage.getItem("chatx.displayName") ||
      window.localStorage.getItem("username"),
    ""
  );
  const email = sanitizeString(window.localStorage.getItem("email"), "");
  const organization = sanitizeString(
    window.localStorage.getItem("organization"),
    ""
  );
  const role = sanitizeString(window.localStorage.getItem("role"), "");
  const roleKey = sanitizeString(window.localStorage.getItem("role_key"), "");
  const id = sanitizeString(window.localStorage.getItem("userId"), "");
  if (!name && !email && !organization && !role && !id) {
    return null;
  }
  return normalizeCurrentUser({
    id,
    name,
    username: name,
    email,
    organization,
    role,
    roleKey,
  });
};

export const getStoredCurrentUser = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (raw) {
    if (raw === cachedRawUser) {
      return cachedParsedUser;
    }
    try {
      const parsed = normalizeCurrentUser(JSON.parse(raw));
      cachedRawUser = raw;
      cachedParsedUser = parsed;
      return parsed;
    } catch {
      window.localStorage.removeItem(USER_STORAGE_KEY);
      cachedRawUser = null;
      cachedParsedUser = null;
    }
  }
  const legacyName = window.localStorage.getItem("name") || "";
  const legacyDisplayName = window.localStorage.getItem("chatx.displayName") || "";
  const legacyUsername = window.localStorage.getItem("username") || "";
  const legacyEmail = window.localStorage.getItem("email") || "";
  const legacyOrg = window.localStorage.getItem("organization") || "";
  const legacyRole = window.localStorage.getItem("role") || "";
  const legacyRoleKey = window.localStorage.getItem("role_key") || "";
  const legacyId = window.localStorage.getItem("userId") || "";
  const legacyKey = [
    legacyName,
    legacyDisplayName,
    legacyUsername,
    legacyEmail,
    legacyOrg,
    legacyRole,
    legacyRoleKey,
    legacyId,
  ].join("|");
  if (legacyKey === cachedLegacyKey) {
    return cachedLegacyUser;
  }
  const legacyUser = readFromLegacyKeys();
  cachedLegacyKey = legacyKey;
  cachedLegacyUser = legacyUser;
  return legacyUser;
};

const writeLegacyKeys = (user) => {
  window.localStorage.setItem("chatx.displayName", user.displayName);
  window.localStorage.setItem("name", user.name);
  window.localStorage.setItem("username", user.username);
  window.localStorage.setItem("email", user.email);
  window.localStorage.setItem("organization", user.organization);
  window.localStorage.setItem("role", String(user.role));
  window.localStorage.setItem("role_key", user.roleKey);
  if (user.id) {
    window.localStorage.setItem("userId", user.id);
  }
};

const buildSecureProfilePayload = (user, raw = {}) =>
  normalizeProfilePayload({
    id: user.id,
    user_id: user.id,
    name: user.name,
    displayName: user.displayName,
    fullName: user.name,
    username: user.username,
    email: user.email,
    avatar: sanitizeString(raw.avatar || raw.profileUrl || raw.profile_url || user.image, ""),
    role: sanitizeString(raw.roleName || user.roleKey, user.roleKey),
    designation: sanitizeString(raw.designation || raw.designationName || raw.roleName, user.roleKey),
    department: sanitizeString(raw.department || raw.departmentName, ""),
    mobile: sanitizeString(raw.mobile, ""),
    location: sanitizeString(raw.location || raw.locationName, ""),
    organizationId: user.organization || null,
    organization_id: user.organization || null,
    organizationLabel: user.organizationName || user.organization || "",
    company: user.organizationName || user.organization || "",
  });

export const setStoredCurrentUser = async (rawUser) => {
  if (typeof window === "undefined") return null;
  const normalized = normalizeCurrentUser(rawUser || {});
  const serialized = JSON.stringify(normalized);
  window.localStorage.setItem(USER_STORAGE_KEY, serialized);
  cachedRawUser = serialized;
  cachedParsedUser = normalized;
  cachedLegacyKey = null;
  cachedLegacyUser = null;
  writeLegacyKeys(normalized);
  await secureStorage.setItem(
    SECURE_PROFILE_KEY,
    JSON.stringify(buildSecureProfilePayload(normalized, rawUser || {}))
  );
  const lastLoginAt = sanitizeString(rawUser?.lastLoginAt, "");
  if (lastLoginAt) {
    await secureStorage.setItem(LAST_LOGIN_STORAGE_KEY, lastLoginAt);
  } else {
    secureStorage.removeItem(LAST_LOGIN_STORAGE_KEY);
  }
  emitUserChange();
  return normalized;
};

export const clearStoredCurrentUser = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_STORAGE_KEY);
  cachedRawUser = null;
  cachedParsedUser = null;
  cachedLegacyKey = null;
  cachedLegacyUser = null;
  emitUserChange();
};

const readSnapshot = () => getStoredCurrentUser();

const subscribe = (callback) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(USER_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(USER_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

export const useCurrentUser = () =>
  useSyncExternalStore(subscribe, readSnapshot, readSnapshot);

export const getCurrentDisplayName = (fallback = "User") =>
  sanitizeString(getStoredCurrentUser()?.displayName, fallback);
