import {
  agentSelfId,
} from "../data/CommonData";
import { DEFAULT_PROFILE, normalizeProfilePayload } from "../data/userProfile";
import { normalizeMessage } from "../components/conversation/messages/helpers";

const THREAD_CACHE_KEY = "chatx.threadCache.v1";
const CACHE_VERSION = 5; // bumped: clears mock self-messages from localStorage
const MAX_CACHED_MESSAGES = 50;
const DEFAULT_MESSAGE_WINDOW = 10;
const SELF_THREAD_ID = "thread-self";

const SELF_THREAD_INITIALS = "MY";
const SELF_THREAD_LABEL = "Myself";

const defaultAgentProfile = Object.freeze({
  ...DEFAULT_PROFILE,
  initials: DEFAULT_PROFILE.initials ?? SELF_THREAD_INITIALS,
  avatar: DEFAULT_PROFILE.avatar ?? null,
});

const baseSelfMessages = [];

const cloneMessage = (message) => ({
  ...message,
  author: message.author ? { ...message.author } : undefined,
  content:
    message.content && typeof message.content === "object"
      ? { ...message.content }
      : message.content,
});

const createDefaultSelfMessages = () => baseSelfMessages.map(cloneMessage);

const deriveSelfThreadMeta = (messages = []) => {
  const lastMessage = messages[messages.length - 1] ?? null;
  if (!lastMessage) {
    return {
      preview: "",
      messageType: "message",
      lastTimestamp: null,
      lastMessage: null,
    };
  }
  const preview =
    (lastMessage.type === "poll" && lastMessage.content?.question
      ? `Poll - ${lastMessage.content.question}`
      : lastMessage.content &&
          (lastMessage.content.text ||
            lastMessage.content.title ||
            lastMessage.content.question ||
            lastMessage.content.fileName ||
            lastMessage.content.description ||
            lastMessage.content.url)) ||
    "Saved message";
  const messageType =
    lastMessage.type === "link"
      ? "link"
      : lastMessage.type === "file" || lastMessage.type === "image"
        ? "attachment"
        : "message";
  const lastTimestamp =
    typeof lastMessage.createdAt === "string"
      ? lastMessage.createdAt
      : typeof lastMessage.createdAt === "number"
        ? new Date(lastMessage.createdAt).toISOString()
        : new Date().toISOString();
  return {
    preview,
    messageType,
    lastTimestamp,
    lastMessage,
  };
};

const normaliseString = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const parseTimestamp = (value) => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const safeParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const readCache = () => {
  if (typeof window === "undefined") return null;
  // Clear any stale cache from before backend persistence was enabled
  try { window.localStorage.removeItem(THREAD_CACHE_KEY); } catch {}
  return null;
};

const writeCache = () => {
  // No-op: backend handles all message persistence now.
  // localStorage caching disabled to avoid QuotaExceededError.
};

const persistScheduler = (() => {
  const hasWindow = typeof window !== "undefined";
  const requestIdle =
    hasWindow && typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback.bind(window)
      : null;
  const cancelIdle =
    hasWindow && typeof window.cancelIdleCallback === "function"
      ? window.cancelIdleCallback.bind(window)
      : null;
  const setTimer = hasWindow ? window.setTimeout.bind(window) : setTimeout;
  const clearTimer = hasWindow ? window.clearTimeout.bind(window) : clearTimeout;
  let handle = null;
  let handleType = null;
  let latestPayload = null;
  let eventsBound = false;

  const cancelHandle = () => {
    if (handle === null) return;
    if (handleType === "idle" && cancelIdle) {
      cancelIdle(handle);
    } else {
      clearTimer(handle);
    }
    handle = null;
    handleType = null;
  };

  const runPersist = () => {
    handle = null;
    handleType = null;
    if (!latestPayload) return;
    writeCache(latestPayload);
    latestPayload = null;
  };

  const flush = (payload) => {
    if (payload) {
      latestPayload = payload;
    }
    if (!latestPayload) {
      cancelHandle();
      return;
    }
    cancelHandle();
    runPersist();
  };

  const bindVisibilityGuards = () => {
    if (!hasWindow || eventsBound) return;
    const flushOnExit = () => {
      flush();
    };
    window.addEventListener("beforeunload", flushOnExit);
    window.addEventListener("pagehide", flushOnExit);
    if (typeof document !== "undefined" && document) {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          flushOnExit();
        }
      });
    }
    eventsBound = true;
  };

  const schedule = (payload) => {
    if (!payload) return;
    latestPayload = payload;
    if (!hasWindow) {
      runPersist();
      return;
    }
    bindVisibilityGuards();
    if (handle !== null) return;
    const runner = () => {
      runPersist();
    };
    if (requestIdle) {
      handleType = "idle";
      handle = requestIdle(runner, { timeout: 1500 });
    } else {
      handleType = "timeout";
      handle = setTimer(runner, 0);
    }
  };

  return { schedule, flush };
})();

const normalizeMessageEntry = (message) => normalizeMessage(message);

const normalizeMessageList = (messages = []) =>
  Array.isArray(messages) ? messages.map(normalizeMessageEntry) : [];

const normalizeMessagesMap = (messagesByThread = {}) => {
  const next = {};
  Object.keys(messagesByThread || {}).forEach((threadId) => {
    next[threadId] = normalizeMessageList(messagesByThread[threadId]);
  });
  return next;
};

const normalizeStateMessages = (state) => ({
  ...state,
  messagesByThread: normalizeMessagesMap(state.messagesByThread || {}),
});

const pickPreviewTextFromMessage = (message = {}) => {
  if (message?.type === "poll" && message?.content?.question) {
    return `Poll - ${message.content.question}`.trim();
  }
  const candidates = [
    message?.content?.text,
    message?.message,
    message?.content?.caption,
    message?.content?.title,
    message?.content?.question,
    message?.content?.fileName,
    message?.content?.url,
    message?.preview,
    message?.content?.description,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return "";
};

const mapMessageTypeForThread = (messageType = "") => {
  const normalized = (messageType || "").toLowerCase();
  if (["image", "video", "audio", "file", "link", "code"].includes(normalized)) {
    return normalized;
  }
  if (normalized === "attachment") {
    return "file";
  }
  return "message";
};

const seedState = () => normalizeStateMessages({
  version: CACHE_VERSION,
  updatedAt: Date.now(),
  organizations: [],
  threadsByOrg: {},
  messagesByThread: {},
  loadingStates: {},
  lastSyncError: null,
});

class ThreadService {
  constructor() {
    this.listeners = new Set();
    this.agentProfile = { ...defaultAgentProfile };
    this.homeOrganizationId =
      this.agentProfile.organizationId ??
      this.agentProfile.organization_id ??
      null;
    const cached = readCache();
    const baseState =
      cached && cached.version === CACHE_VERSION
        ? normalizeStateMessages(cached)
        : seedState();
    this.state = this.ensureSelfThreadPresence(baseState);
    if (!cached) {
      writeCache(this.state);
    }
  }

  getSnapshot = () => this.state;

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  emit() {
    // Debounce rapid successive emits (e.g. multiple patchMessage calls)
    if (this._emitTimer) return;
    this._emitTimer = setTimeout(() => {
      this._emitTimer = null;
      const snapshot = this.getSnapshot();
      this.listeners.forEach((listener) => {
        try {
          listener(snapshot);
        } catch (error) {
          console.error("ThreadService listener error", error);
        }
      });
    }, 50);
  }

  commit(updater, { persist = true, persistMode = "idle" } = {}) {
    const updated =
      typeof updater === "function" ? updater(this.state) : updater ?? this.state;
    const next = this.ensureSelfThreadPresence(updated);
    this.state = next;
    if (persist) {
      if (persistMode === "immediate") {
        persistScheduler.flush(next);
      } else {
        persistScheduler.schedule(next);
      }
    }
    this.emit();
    return next;
  }

  flushPendingWrites() {
    persistScheduler.flush(this.state);
  }

  getOrganizations() {
    return this.state.organizations;
  }

  getThreadsForOrg(orgId, { limit } = {}) {
    const threads = this.state.threadsByOrg[orgId] ?? [];
    if (typeof limit === "number") {
      return threads.slice(0, limit);
    }
    return threads;
  }

  getMessagesWindow(threadId, { limit = DEFAULT_MESSAGE_WINDOW, before } = {}) {
    const all = this.state.messagesByThread[threadId] ?? [];
    if (!all.length) {
      return { messages: [], hasMore: false };
    }
    let endIndex = all.length;
    if (before) {
      const exactIndex = all.findIndex(
        (message) => message?.createdAt === before || message?.id === before
      );
      if (exactIndex >= 0) {
        endIndex = exactIndex;
      } else {
        const targetTimestamp = parseTimestamp(before);
        if (targetTimestamp) {
          const timestampIndex = all.findIndex(
            (message) => parseTimestamp(message?.createdAt) >= targetTimestamp
          );
          if (timestampIndex >= 0) {
            endIndex = timestampIndex;
          }
        }
      }
    }
    const startIndex = Math.max(0, endIndex - limit);
    return {
      messages: all.slice(startIndex, endIndex),
      hasMore: startIndex > 0,
    };
  }

  getMessagesForThread(
    threadId,
    { limit = MAX_CACHED_MESSAGES, before } = {}
  ) {
    if (before) {
      const slice = this.getMessagesWindow(threadId, { limit, before });
      return slice.messages;
    }
    const messages = this.state.messagesByThread[threadId] ?? [];
    return typeof limit === "number" ? messages.slice(-limit) : messages;
  }

  upsertThread(orgId, thread) {
    if (!orgId || !thread?.id) return;
    this.commit((current) => {
      const existing = current.threadsByOrg[orgId] ?? [];
      const nextThreads = existing.some((item) => item.id === thread.id)
        ? existing.map((item) => (item.id === thread.id ? { ...item, ...thread } : item))
        : [thread, ...existing];
      return {
        ...current,
        threadsByOrg: {
          ...current.threadsByOrg,
          [orgId]: nextThreads,
        },
        updatedAt: Date.now(),
      };
    });
  }

  appendMessages(threadId, messages) {
    if (!threadId || !Array.isArray(messages) || messages.length === 0) return;
    const normalizedMessages = normalizeMessageList(messages);
    this.commit((current) => {
      const existing = current.messagesByThread[threadId] ?? [];
      // Dedup: only add messages not already present by ID
      const existingIds = new Set(existing.map((m) => m.id).filter(Boolean));
      const newOnly = normalizedMessages.filter((m) => !m.id || !existingIds.has(m.id));
      const merged = [...existing, ...newOnly].slice(-MAX_CACHED_MESSAGES);
      return {
        ...current,
        messagesByThread: {
          ...current.messagesByThread,
          [threadId]: merged,
        },
        updatedAt: Date.now(),
      };
    });
    const latestMessage = normalizedMessages[normalizedMessages.length - 1];
    this.updateThreadPreviewFromMessage(threadId, latestMessage);
  }

  patchMessage(threadId, nextMessage) {
    if (!threadId || !nextMessage?.id) return;
    const normalizedNext = normalizeMessageEntry(nextMessage);
    this.commit((current) => {
      const existing = current.messagesByThread[threadId] ?? [];
      const index = existing.findIndex(
        (message) => message.id === nextMessage.id
      );
      if (index === -1) {
        return current;
      }
      const patched = [...existing];
      patched[index] = { ...patched[index], ...normalizedNext };
      return {
        ...current,
        messagesByThread: {
          ...current.messagesByThread,
          [threadId]: patched,
        },
        updatedAt: Date.now(),
      };
    });
  }

  /** Mark all outgoing messages in a thread as "read" + reset unread count + update readStatus */
  markThreadMessagesRead(threadId) {
    if (!threadId) return;
    this.commit((current) => {
      // Update messages status to "read"
      const existing = current.messagesByThread[threadId] ?? [];
      const patched = existing.length
        ? existing.map((msg) =>
            msg.direction === "outgoing" && msg.status !== "read"
              ? { ...msg, status: "read" }
              : msg
          )
        : existing;

      // Also reset thread's unreadCount and readStatus
      const nextThreadsByOrg = { ...current.threadsByOrg };
      for (const [orgId, threads] of Object.entries(nextThreadsByOrg)) {
        const idx = threads.findIndex((t) => t.id === threadId);
        if (idx === -1) continue;
        const updated = [...threads];
        updated[idx] = { ...updated[idx], unreadCount: 0, readStatus: 'read', lastMessageStatus: 'read' };
        nextThreadsByOrg[orgId] = updated;
        break;
      }

      return {
        ...current,
        messagesByThread: { ...current.messagesByThread, [threadId]: patched },
        threadsByOrg: nextThreadsByOrg,
        updatedAt: Date.now(),
      };
    });
  }

  removeThread(orgId, threadId, { removeMessages = true } = {}) {
    if (!orgId || !threadId) return;
    this.commit((current) => {
      const threads = current.threadsByOrg[orgId] ?? [];
      const nextThreads = threads.filter((thread) => thread?.id !== threadId);
      if (nextThreads.length === threads.length) {
        return current;
      }
      const nextMessagesByThread = removeMessages
        ? Object.keys(current.messagesByThread || {}).reduce((acc, key) => {
            if (key !== threadId) {
              acc[key] = current.messagesByThread[key];
            }
            return acc;
          }, {})
        : current.messagesByThread;
      return {
        ...current,
        threadsByOrg: {
          ...current.threadsByOrg,
          [orgId]: nextThreads,
        },
        messagesByThread: nextMessagesByThread,
        updatedAt: Date.now(),
      };
    });
  }

  removeMessage(threadId, messageId) {
    if (!threadId || !messageId) return;
    this.commit((current) => {
      const existing = current.messagesByThread[threadId] ?? [];
      const filtered = existing.filter((message) => message.id !== messageId);
      if (filtered.length === existing.length) {
        return current;
      }
      return {
        ...current,
        messagesByThread: {
          ...current.messagesByThread,
          [threadId]: filtered,
        },
        updatedAt: Date.now(),
      };
    });
  }

  setOrgLoading(orgId, loading) {
    if (!orgId) return;
    this.commit((current) => ({
      ...current,
      loadingStates: {
        ...current.loadingStates,
        [orgId]: loading,
      },
    }), { persist: false });
  }

  async refreshOrg(orgId, fetcher) {
    if (!orgId) return;
    this.setOrgLoading(orgId, true);
    const fetchFn =
      fetcher ||
      (async () => ({
        threads: this.getThreadsForOrg(orgId),
      }));
    try {
      const result = await fetchFn(orgId, this.getThreadsForOrg(orgId));
      if (result?.threads) {
        this.commit((current) => ({
          ...current,
          threadsByOrg: {
            ...current.threadsByOrg,
            [orgId]: result.threads,
          },
          updatedAt: Date.now(),
          lastSyncError: null,
        }));
      }
    } catch (error) {
      console.warn("Failed to refresh threads", error);
      this.commit((current) => ({
        ...current,
        lastSyncError: {
          organizationId: orgId,
          message: error?.message ?? "Unable to refresh threads",
          at: Date.now(),
        },
      }), { persist: false });
    } finally {
      this.setOrgLoading(orgId, false);
    }
  }

  setAgentProfile(profile = {}) {
    if (!profile || typeof profile !== "object") return;
    const mergedProfile = normalizeProfilePayload({
      ...this.agentProfile,
      ...profile,
    });

    const nextProfile = {
      ...this.agentProfile,
      ...mergedProfile,
    };

    const watchedKeys = [
      "id",
      "displayName",
      "username",
      "fullName",
      "email",
      "designation",
      "designationId",
      "department",
      "departmentId",
      "company",
      "organizationId",
      "organizationLabel",
      "domainName",
      "location",
      "locationId",
      "mobile",
      "avatar",
      "initials",
      "status",
    ];

    const hasChanged = watchedKeys.some(
      (key) => nextProfile[key] !== this.agentProfile[key]
    );

    if (!hasChanged) return;
    this.agentProfile = nextProfile;
    const preferredOrgId =
      nextProfile.organizationId ??
      nextProfile.organization_id ??
      null;
    if (preferredOrgId) {
      this.homeOrganizationId = String(preferredOrgId);
    }
    // Re-build self thread with correct dm-<userId> ID after profile loads
    this.commit((current) => this.ensureSelfThreadPresence(current), { persist: true });
  }

  ensureSelfThreadPresence(state) {
    if (!state) return state;
    const organizations = Array.isArray(state.organizations)
      ? state.organizations
      : [];
    const existingThreadsByOrg = state.threadsByOrg ?? {};
    const messagesByThread = { ...(state.messagesByThread ?? {}) };
    const selfId = this.getSelfThreadId();

    // Support both old "thread-self" and new "dm-<userId>" keys
    if (!Array.isArray(messagesByThread[selfId])) {
      messagesByThread[selfId] = messagesByThread[SELF_THREAD_ID] || createDefaultSelfMessages();
    }

    const selfMessages = messagesByThread[selfId];
    const threadsByOrg = { ...existingThreadsByOrg };
    const primaryOrgId =
      this.homeOrganizationId ||
      organizations.find((org) => org?.isPrimary)?.id ||
      organizations[0]?.id ||
      null;
    organizations.forEach((organization) => {
      if (!organization?.id) return;
      const currentThreads = Array.isArray(existingThreadsByOrg[organization.id])
        ? existingThreadsByOrg[organization.id]
        : [];
      const filtered = currentThreads.filter(
        (thread) => thread?.id !== SELF_THREAD_ID && thread?.id !== selfId
      );
      if (organization.id === primaryOrgId) {
        threadsByOrg[organization.id] = [
          this.buildSelfThread(organization, selfMessages),
          ...filtered,
        ];
      } else {
        threadsByOrg[organization.id] = filtered;
      }
    });

    return {
      ...state,
      threadsByOrg,
      messagesByThread,
    };
  }

  // Resolve real DM thread ID for Myself: dm-<realUserId> if available, else fallback
  getSelfThreadId() {
    const realId = this.agentProfile?.user_id || this.agentProfile?.id || agentSelfId;
    if (realId && String(realId) !== "agent-self" && !String(realId).startsWith('agent')) {
      return `dm-${realId}`;
    }
    return SELF_THREAD_ID;
  }

  buildSelfThread(organization, selfMessages) {
    const { preview, messageType, lastTimestamp, lastMessage } =
      deriveSelfThreadMeta(selfMessages);
    const allowedAgentIds = Array.from(
      new Set([agentSelfId, this.agentProfile.id].filter(Boolean))
    );
    const organizationLabel =
      normaliseString(this.agentProfile.organizationLabel) ||
      normaliseString(organization?.label) ||
      this.agentProfile.company ||
      "TeamChatX";
    const username =
      this.agentProfile.username ??
      this.agentProfile.fullName ??
      this.agentProfile.displayName ??
      SELF_THREAD_LABEL;
    const fullName =
      this.agentProfile.fullName ??
      this.agentProfile.username ??
      this.agentProfile.displayName ??
      SELF_THREAD_LABEL;
    const initialsOverride =
      this.agentProfile.initials ?? SELF_THREAD_INITIALS;

    return {
      id: this.getSelfThreadId(),
      user_id: this.agentProfile.id ?? agentSelfId,
      username,
      fullName,
      label: SELF_THREAD_LABEL,
      email: this.agentProfile.email ?? "",
      designation: this.agentProfile.designation ?? null,
      designation_id: this.agentProfile.designationId ?? null,
      department: this.agentProfile.department ?? null,
      department_id: this.agentProfile.departmentId ?? null,
      company: organizationLabel,
      domain_name: this.agentProfile.domainName ?? "",
      location: this.agentProfile.location ?? null,
      location_id: this.agentProfile.locationId ?? null,
      mobile: this.agentProfile.mobile ?? "",
      password_hash: null,
      user_status: "active",
      selected_user: 1,
      is_verified: 1,
      global_user: 0,
      isGlobalMember: false,
      status: this.agentProfile.status ?? "Online",
      preview,
      messageType,
      readStatus: "read",
      lastMessageAt: lastTimestamp,
      lastActivityAt: lastTimestamp,
      updatedAt: lastTimestamp,
      createdAt: selfMessages?.[0]?.createdAt ?? lastTimestamp,
      time: undefined,
      unreadCount: 0,
      allowedAgentIds,
      isSelfThread: true,
      isPinned: false,
      profilePicture: this.agentProfile.avatar ?? null,
      avatar: this.agentProfile.avatar ?? null,
      initialsOverride,
      lastMessage,
      use_device: null,
      user_ip: null,
      last_seen: lastTimestamp,
      os_name: this.agentProfile.os_name ?? null,
      os: this.agentProfile.os_name ?? null,
      user_agent: this.agentProfile.user_agent ?? null,
    };
  }

  updateThreadPreviewFromMessage(threadId, message) {
    if (!threadId || !message) return;
    const normalized = message.__normalized ? message : normalizeMessage(message);
    const preview = pickPreviewTextFromMessage(normalized);
    const messageType = mapMessageTypeForThread(normalized.type);
    this.commit((current) => {
      if (!current?.threadsByOrg) return current;
      let foundOrgId = null;
      const nextThreadsByOrg = { ...current.threadsByOrg };
      for (const [orgId, threads] of Object.entries(current.threadsByOrg)) {
        const index = threads.findIndex((thread) => thread.id === threadId);
        if (index === -1) continue;
        const nextThread = {
          ...threads[index],
          preview,
          messageType,
          lastMessageAt: normalized.createdAt,
          lastActivityAt: normalized.createdAt,
          updatedAt: normalized.createdAt,
          time: normalized.createdAt,
          lastMessage: normalized,
          // unreadCount managed ONLY by backend thread:update — no local increment
        };
        const updatedList = [...threads];
        updatedList[index] = nextThread;
        nextThreadsByOrg[orgId] = updatedList;
        foundOrgId = orgId;
        break;
      }
      if (!foundOrgId) {
        return current;
      }
      return {
        ...current,
        threadsByOrg: nextThreadsByOrg,
        updatedAt: Date.now(),
      };
    });
  }
}

export const threadService = new ThreadService();

export default threadService;
