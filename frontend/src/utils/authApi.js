import authStore from "./auth";
import secureStorage from "./secureStorage";
import { ensureCsrfCookie, withCsrfHeader } from "./csrf";
import { API_BASE_URL } from "../config/apiBaseUrl";

const isUnsafeMethod = (method = "GET") =>
  !["GET", "HEAD", "OPTIONS"].includes(String(method).toUpperCase());

const readLocal = (key) =>
  typeof window !== "undefined"
    ? String(window.localStorage.getItem(key) || "").trim()
    : "";

export const getStoredTokens = async () => {
  const accessFromSecure = await secureStorage.getItem(authStore.keys.token);
  const refreshFromSecure = await secureStorage.getItem(authStore.keys.refreshToken);

  const accessToken = String(accessFromSecure || readLocal(authStore.keys.token)).trim();
  const refreshToken = String(refreshFromSecure || readLocal(authStore.keys.refreshToken)).trim();

  return { accessToken, refreshToken };
};

export const getAccessToken = async ({ refreshIfNeeded = true } = {}) => {
  if (refreshIfNeeded) {
    await authStore.ensureFreshSession().catch(() => false);
  }
  const { accessToken } = await getStoredTokens();
  return accessToken;
};

export const fetchWithAuth = async (
  url,
  options = {},
  { refreshIfNeeded = true, retryOnUnauthorized = true } = {}
) => {
  let token = await getAccessToken({ refreshIfNeeded });

  const doRequest = async (bearerToken) => {
    const nextOptions = withCsrfHeader(options);
    const method = String(nextOptions.method || "GET").toUpperCase();
    const headers = {
      ...(nextOptions.headers || {}),
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
    };
    const response = await fetch(url, {
      ...nextOptions,
      cache: "no-store",
      credentials: nextOptions.credentials || "include",
      headers,
    });
    let payload = {};
    const shouldParseBody =
      method !== "HEAD" && ![204, 205, 304].includes(response.status) && response.body !== null;
    if (shouldParseBody) {
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      payload = contentType.includes("application/json")
        ? await response.json().catch(() => ({}))
        : await response.text().catch(() => "");
    }
    return { response, payload };
  };

  let result = await doRequest(token);

  if (result.response.status === 403 && isUnsafeMethod(options.method || "GET")) {
    const recovered = await ensureCsrfCookie(API_BASE_URL);
    if (recovered) {
      result = await doRequest(token);
    }
  }

  if (retryOnUnauthorized && result.response.status === 401) {
    try {
      await authStore.refreshSession();
      token = await getAccessToken({ refreshIfNeeded: false });
      result = await doRequest(token);
      // Cookie-auth fallback: if bearer stays unauthorized after refresh,
      // retry once without Authorization header.
      if (result.response.status === 401 && token) {
        result = await doRequest("");
      }
    } catch (error) {
      if (error?.forceLogoutAll) {
        authStore.logout();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("chatx:logout"));
        }
      }
      // Let caller handle original unauthorized outcome.
    }
  }

  return result;
};
