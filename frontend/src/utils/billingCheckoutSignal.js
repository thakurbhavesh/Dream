const STORAGE_KEY = "teamchatx.billing_checkout_success";

export const storeBillingCheckoutSuccess = (payload = {}) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        invoiceNumber: String(payload.invoiceNumber || "").trim(),
        sessionId: String(payload.sessionId || "").trim(),
        at: Date.now(),
      }),
    );
  } catch {
    // ignore storage failures
  }
};

export const consumeBillingCheckoutSuccess = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw);
    return {
      invoiceNumber: String(parsed?.invoiceNumber || "").trim(),
      sessionId: String(parsed?.sessionId || "").trim(),
      at: Number(parsed?.at || 0),
    };
  } catch {
    return null;
  }
};
