export const THREAD_NAVIGATE_EVENT = "chatx:open-thread";

export const emitThreadNavigateEvent = (payload) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(THREAD_NAVIGATE_EVENT, {
        detail: payload,
      })
    );
  } catch (error) {
    console.warn("Failed to dispatch thread navigation event", error);
  }
};
