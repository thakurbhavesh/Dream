import { useCallback, useRef, useState } from "react";

const MAX_CACHE_SIZE = 20;
const MAX_MESSAGES_PER_THREAD = 200;

const emptyState = {
  threadId: null,
  loading: false,
  messages: [],
};

/**
 * Lightweight LRU cache for conversation payloads so chat history is not
 * re-fetched every time the user switches threads. Keeps the most recent
 * conversations hot (default 20, configurable).
 */
export const useConversationCache = (loader, options = {}) => {
  const max = Math.max(1, options.max ?? MAX_CACHE_SIZE);

  const cacheRef = useRef(new Map());
  const orderRef = useRef([]);
  const pendingRef = useRef(new Map());
  const requestedRef = useRef(null);

  const [state, setState] = useState(emptyState);

  const touch = useCallback(
    (threadId) => {
      const order = orderRef.current;
      const existingIndex = order.indexOf(threadId);
      if (existingIndex >= 0) {
        order.splice(existingIndex, 1);
      }
      order.push(threadId);
      while (order.length > max) {
        const evicted = order.shift();
        if (evicted !== undefined) {
          cacheRef.current.delete(evicted);
        }
      }
    },
    [max]
  );

  const setCachedState = useCallback(
    (threadId, messages) => {
      const capped = messages.length > MAX_MESSAGES_PER_THREAD
        ? messages.slice(-MAX_MESSAGES_PER_THREAD)
        : messages;
      cacheRef.current.set(threadId, capped);
      touch(threadId);
      setState((prev) => {
        if (requestedRef.current !== threadId) {
          return {
            ...prev,
            loading: false,
            messages: prev.threadId === threadId ? capped : prev.messages,
          };
        }
        return {
          threadId,
          loading: false,
          messages: capped,
        };
      });
    },
    [touch]
  );

  const loadThread = useCallback(
    async (threadId) => {
      requestedRef.current = threadId ?? null;

      if (!threadId) {
        setState(emptyState);
        return;
      }

      if (cacheRef.current.has(threadId)) {
        touch(threadId);
        setState({
          threadId,
          loading: false,
          messages: cacheRef.current.get(threadId) ?? [],
        });
        return;
      }

      if (pendingRef.current.has(threadId)) {
        setState((prev) => ({
          threadId,
          loading: true,
          messages: prev.threadId === threadId ? prev.messages : [],
        }));
        return;
      }

      setState((prev) => ({
        threadId,
        loading: true,
        messages: prev.threadId === threadId ? prev.messages : [],
      }));

      const loadPromise = Promise.resolve(loader?.(threadId) ?? []).then(
        (result) => {
          const messages = Array.isArray(result) ? result : [];
          // Always update cache (for later reuse)
          if (messages.length > 0 || !cacheRef.current.has(threadId)) {
            cacheRef.current.set(threadId, messages.length > MAX_MESSAGES_PER_THREAD
              ? messages.slice(-MAX_MESSAGES_PER_THREAD)
              : messages);
            touch(threadId);
          }
          // Only update STATE if this thread is still the one user wants to see
          // (prevents stale thread overwriting current thread on rapid switching)
          if (requestedRef.current === threadId) {
            const cached = cacheRef.current.get(threadId) ?? messages;
            setState({ threadId, loading: false, messages: cached });
          }
          return messages;
        }
      ).finally(() => {
        pendingRef.current.delete(threadId);
      });

      pendingRef.current.set(threadId, loadPromise);
    },
    [loader, setCachedState, touch]
  );

  const prime = useCallback(
    (threadId, messages) => {
      if (!threadId) return;
      cacheRef.current.set(threadId, Array.isArray(messages) ? messages : []);
      touch(threadId);
    },
    [touch]
  );

  // Throttle setState to avoid rapid re-renders (e.g. upload progress)
  const setStateTimerRef = useRef(null);
  const pendingStateRef = useRef(null);

  const flushState = useCallback(() => {
    if (pendingStateRef.current) {
      setState(pendingStateRef.current);
      pendingStateRef.current = null;
    }
    setStateTimerRef.current = null;
  }, []);

  const throttledSetState = useCallback((nextState) => {
    pendingStateRef.current = nextState;
    if (!setStateTimerRef.current) {
      setStateTimerRef.current = setTimeout(flushState, 80);
    }
  }, [flushState]);

  const upsertMessage = useCallback((threadId, message) => {
    if (!threadId || !message) return;
    const existing = cacheRef.current.get(threadId) ?? [];
    const index = existing.findIndex((item) => item.id === message.id);
    const next = [...existing];
    if (index >= 0) {
      next[index] = { ...existing[index], ...message };
    } else {
      next.push(message);
    }
    // Cap messages per thread to prevent unbounded growth
    const capped = next.length > MAX_MESSAGES_PER_THREAD
      ? next.slice(-MAX_MESSAGES_PER_THREAD)
      : next;
    cacheRef.current.set(threadId, capped);
    if (state.threadId === threadId) {
      // Use throttled setState for upload progress, immediate for new messages
      const isProgressUpdate = message.status === "uploading";
      const nextState = (prev) => ({ ...prev, messages: capped });
      if (isProgressUpdate) {
        throttledSetState(nextState);
      } else {
        setState(nextState);
      }
    }
    touch(threadId);
  }, [state.threadId, touch, throttledSetState]);

  const removeMessage = useCallback((threadId, messageId) => {
    if (!threadId || !messageId) return;
    const existing = cacheRef.current.get(threadId) ?? [];
    const filtered = existing.filter((item) => item.id !== messageId);
    cacheRef.current.set(threadId, filtered);
    if (state.threadId === threadId) {
      setState((prev) => ({
        ...prev,
        messages: filtered,
      }));
    }
    touch(threadId);
  }, [state.threadId, touch]);

  const invalidate = useCallback((threadId) => {
    if (!threadId) return;
    cacheRef.current.delete(threadId);
    const order = orderRef.current;
    const idx = order.indexOf(threadId);
    if (idx >= 0) order.splice(idx, 1);
    if (state.threadId === threadId) {
      setState((prev) => ({
        ...prev,
        loading: false,
        messages: [],
      }));
    }
  }, [state.threadId]);

  const findMessage = useCallback((threadId, messageId) => {
    if (!threadId || !messageId) return null;
    const existing = cacheRef.current.get(threadId) ?? [];
    return existing.find((item) => item.id === String(messageId)) ?? null;
  }, []);

  // Bulk update: mark all outgoing messages in a thread as "read" (green tick)
  const markCacheMessagesRead = useCallback((threadId) => {
    if (!threadId) return;
    const existing = cacheRef.current.get(threadId) ?? [];
    if (!existing.length) return;
    let changed = false;
    const patched = existing.map((msg) => {
      if (msg.direction === "outgoing" && msg.status !== "read") {
        changed = true;
        return { ...msg, status: "read" };
      }
      return msg;
    });
    if (!changed) return;
    cacheRef.current.set(threadId, patched);
    if (state.threadId === threadId) {
      setState((prev) => ({ ...prev, messages: patched }));
    }
    touch(threadId);
  }, [state.threadId, touch]);

  return {
    state,
    loadThread,
    prime,
    upsertMessage,
    removeMessage,
    invalidate,
    findMessage,
    markCacheMessagesRead,
  };
};

export default useConversationCache;
