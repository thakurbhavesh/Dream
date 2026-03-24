import { withCsrfHeader } from "./csrf";

const DEFAULT_TIMEOUT_MS = 12000;

export const fetchJson = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const nextOptions = withCsrfHeader(options);

  try {
    const response = await fetch(url, {
      ...nextOptions,
      credentials: nextOptions.credentials || "include",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export default fetchJson;
