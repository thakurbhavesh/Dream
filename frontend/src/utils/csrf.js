const CSRF_COOKIE_KEY = "csrf_token";

export const getCookieValue = (key = "") => {
  if (typeof document === "undefined" || !key) return "";
  const escapedKey = key.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedKey}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
};

export const getCsrfToken = () => getCookieValue(CSRF_COOKIE_KEY);

export const ensureCsrfCookie = async (apiBaseUrl = "") => {
  const base = String(apiBaseUrl || "").trim();
  if (!base || typeof fetch === "undefined") return false;
  try {
    const response = await fetch(`${base}/auth/csrf`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const withCsrfHeader = (options = {}) => {
  const method = String(options?.method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return options;

  const csrfToken = getCsrfToken();
  if (!csrfToken) return options;

  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      "X-CSRF-Token": csrfToken,
    },
  };
};

export default getCsrfToken;
