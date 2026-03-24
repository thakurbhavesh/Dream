import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  groupMessagesByDay,
  normalizeMessage,
} from "../components/conversation/messages/helpers.js";
import { agentSelfId } from "../data/CommonData.js";

/**
 * Centralised message state for a single thread. Handles:
 *  - local windowing / pagination
 *  - remote fetches for older history
 *  - optimistic send queue + reconciliation
 */
const DEFAULT_PAGE_SIZE = 50;
const noopFetcher = async () => ({ messages: [], hasMore: false });
const noopSender = async () => ({ ok: true });

const toTimestamp = (value, fallbackIndex) => {
  if (!value) return fallbackIndex;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? fallbackIndex : parsed;
};

const normaliseMessages = (messages = []) => {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const normalized = [];
  let previousTimestamp = -Infinity;
  let needsSort = false;

  messages.forEach((message, index) => {
    if (!message) return;
    const normalizedMessage = message.__normalized
      ? message
      : normalizeMessage(message);
    const timestamp = toTimestamp(normalizedMessage.createdAt, index);
    if (timestamp < previousTimestamp) {
      needsSort = true;
      previousTimestamp = Math.max(previousTimestamp, timestamp);
    } else {
      previousTimestamp = timestamp;
    }
    normalized.push(
      normalizedMessage.id
        ? normalizedMessage
        : {
            ...normalizedMessage,
            id:
              normalizedMessage.createdAt ??
              `msg-${normalizedMessage.createdAt ?? index}`,
          }
    );
  });

  if (needsSort) {
    normalized.sort(
      (a, b) => toTimestamp(a.createdAt, 0) - toTimestamp(b.createdAt, 0)
    );
  }

  // Dedup by ID — prevents any source from producing duplicate messages
  const seen = new Set();
  const deduped = [];
  for (const msg of normalized) {
    const key = msg.id;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    deduped.push(msg);
  }
  return deduped;
};

// Builds a transient outgoing message to show while network request is pending.
const buildOptimisticMessage = (draft) => ({
  id: `temp-${Date.now()}`,
  type: draft.type ?? "text",
  direction: "outgoing",
  author: draft.author ?? { id: agentSelfId, name: "You" },
  content: draft.content ?? { text: draft.text ?? "" },
  createdAt: new Date().toISOString(),
  status: "sending",
  metadata: draft.metadata ?? {},
});

export const useThreadMessagesState = ({
  threadId,
  messages = [],
  pageSize = DEFAULT_PAGE_SIZE,
  fetchPrevious = noopFetcher,
  sendMessageRequest = noopSender,
  initialRemoteHasMore = false,
}) => {
  const [orderedMessages, setOrderedMessages] = useState(
    normaliseMessages(messages)
  );
  const [windowSize, setWindowSize] = useState(pageSize);
  const [remoteHasMore, setRemoteHasMore] = useState(initialRemoteHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sendQueue, setSendQueue] = useState([]);
  const pendingOlderRef = useRef(false);
  const pendingSendRef = useRef(new Map());

  useEffect(() => {
    setOrderedMessages(normaliseMessages(messages));
    setWindowSize(pageSize);
    setRemoteHasMore(initialRemoteHasMore);
    setSendQueue([]);
    pendingOlderRef.current = false;
    pendingSendRef.current.clear();
  }, [threadId, messages, pageSize, initialRemoteHasMore]);

  const totalMessages = orderedMessages.length;
  const visibleMessages = useMemo(() => {
    if (!totalMessages) return sendQueue;
    const start = Math.max(0, totalMessages - windowSize);
    const slice = orderedMessages.slice(start);
    const combined = [...slice, ...sendQueue];
    // Forced dedup — safety net against any duplicate source
    const seen = new Set();
    return combined.filter((m) => {
      if (!m?.id || seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [orderedMessages, totalMessages, windowSize, sendQueue]);

  const groups = useMemo(
    () => groupMessagesByDay(visibleMessages),
    [visibleMessages]
  );

  const hasLocalMore = windowSize < totalMessages;

  const loadOlderMessages = useCallback(async () => {
    if (pendingOlderRef.current) return false;
    if (hasLocalMore) {
      setWindowSize((prev) =>
        Math.min(totalMessages, prev + pageSize || DEFAULT_PAGE_SIZE)
      );
      return true;
    }
    pendingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const before = orderedMessages[0]?.createdAt ?? null;
      const response = await fetchPrevious({
        threadId,
        before,
        limit: pageSize,
      });
      const fetched = normaliseMessages(response?.messages ?? []);
      if (fetched.length) {
        setOrderedMessages((prev) => [...fetched, ...prev]);
        setWindowSize((prev) => prev + fetched.length);
      }
      setRemoteHasMore(Boolean(response?.hasMore));
      return fetched.length > 0;
    } catch (error) {
      console.error("Failed to load previous messages", error);
      return false;
    } finally {
      pendingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [fetchPrevious, hasLocalMore, orderedMessages, pageSize, threadId, totalMessages]);

  const sendMessage = useCallback(
    async (draft) => {
      const optimistic = buildOptimisticMessage(draft);
      setSendQueue((prev) => [...prev, optimistic]);
      pendingSendRef.current.set(optimistic.id, optimistic);
      try {
        const result = await sendMessageRequest({
          threadId,
          draft: optimistic,
        });
        setSendQueue((prev) =>
          prev.map((message) =>
            message.id === optimistic.id
              ? { ...message, status: result?.ok === false ? "error" : "sent" }
              : message
          )
        );
        if (result?.message) {
          setOrderedMessages((prev) => [...prev, result.message]);
        }
      } catch (error) {
        console.error("Failed to send message", error);
        setSendQueue((prev) =>
          prev.map((message) =>
            message.id === optimistic.id
              ? { ...message, status: "error", error: error.message }
              : message
          )
        );
        throw error;
      } finally {
        pendingSendRef.current.delete(optimistic.id);
      }
    },
    [sendMessageRequest, threadId]
  );

  return {
    groups,
    visibleMessages,
    totalMessages,
    hasMore: hasLocalMore || remoteHasMore,
    loadOlderMessages,
    loadingOlder,
    sendMessage,
  };
};

export default useThreadMessagesState;
