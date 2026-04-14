import { fetchWithAuth } from "./authApi.js";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
};

const isSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  window.isSecureContext;

const fetchPublicKey = async () => {
  const { response, payload } = await fetchWithAuth("/push/vapid-public-key");
  if (!response.ok) return null;
  return payload?.publicKey && payload?.configured ? payload.publicKey : null;
};

/**
 * Ensure the current user has an active push subscription registered with the backend.
 * Safe to call repeatedly — it diffs existing subscriptions and re-subscribes if needed.
 */
export const ensurePushSubscription = async () => {
  try {
    if (!isSupported()) return { ok: false, reason: "unsupported" };
    if (Notification.permission === "denied") return { ok: false, reason: "denied" };
    if (Notification.permission === "default") {
      const res = await Notification.requestPermission();
      if (res !== "granted") return { ok: false, reason: "permission" };
    }

    const publicKey = await fetchPublicKey();
    if (!publicKey) return { ok: false, reason: "not_configured" };

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    // If existing subscription uses a different key, drop it
    if (subscription) {
      const existingKey = subscription.options?.applicationServerKey;
      if (existingKey) {
        const bytes = new Uint8Array(existingKey);
        const target = urlBase64ToUint8Array(publicKey);
        const same = bytes.length === target.length && bytes.every((b, i) => b === target[i]);
        if (!same) {
          await subscription.unsubscribe().catch(() => {});
          subscription = null;
        }
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await fetchWithAuth("/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    });
    return { ok: true, subscription };
  } catch (err) {
    console.warn("[webPushClient] subscribe error", err?.message || err);
    return { ok: false, reason: "error", error: err };
  }
};

export const removePushSubscription = async () => {
  try {
    if (!isSupported()) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetchWithAuth("/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => {});
      await subscription.unsubscribe().catch(() => {});
    }
  } catch (err) {
    console.warn("[webPushClient] unsubscribe error", err?.message || err);
  }
};
