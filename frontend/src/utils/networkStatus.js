const OFFLINE_PROBE_ENDPOINTS = [
  "/ping",
  "https://www.gstatic.com/generate_204",
  "https://clients3.google.com/generate_204",
];

export const getPingCandidates = () => {
  const origin =
    typeof window !== "undefined" ? window.location.origin ?? "" : "";
  const list = [];
  if (origin) list.push(`${origin}/ping`);
  OFFLINE_PROBE_ENDPOINTS.forEach((url) => {
    if (!list.includes(url)) {
      list.push(url);
    }
  });
  return list;
};

const supportsPromiseAny = typeof Promise?.any === "function";

const promiseAnyFallback = (promises) =>
  new Promise((resolve, reject) => {
    if (!promises.length) {
      reject(new Error("No promises supplied"));
      return;
    }
    let rejectedCount = 0;
    const errors = [];
    promises.forEach((promise, index) => {
      promise.then(resolve).catch((error) => {
        rejectedCount += 1;
        errors[index] = error;
        if (rejectedCount === promises.length) {
          if (typeof AggregateError === "function") {
            reject(new AggregateError(errors, "All promises were rejected"));
          } else {
            reject(new Error("All promises were rejected"));
          }
        }
      });
    });
  });

const runPromiseAny = (promises) => {
  if (supportsPromiseAny) {
    return Promise.any(promises);
  }
  return promiseAnyFallback(promises);
};

const createProbeTask = (url, timeoutMs) => {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId =
    typeof timeoutMs === "number" && timeoutMs > 0
      ? setTimeout(() => controller?.abort(), timeoutMs)
      : null;

  const promise = (async () => {
    try {
      await fetch(url, {
        mode: "no-cors",
        cache: "no-store",
        signal: controller?.signal,
      });
      return true;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  })();

  const abort = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    controller?.abort();
  };

  return { promise, abort };
};

export const probeInternet = async (timeoutMs = 2500) => {
  const candidates = getPingCandidates();
  if (!candidates.length) {
    return typeof navigator === "undefined" ? true : navigator.onLine ?? true;
  }
  const tasks = candidates.map((url) => createProbeTask(url, timeoutMs));
  try {
    await runPromiseAny(tasks.map((task) => task.promise));
    return true;
  } catch {
    return false;
  } finally {
    tasks.forEach((task) => task.abort());
  }
};

export default {
  getPingCandidates,
  probeInternet,
};
