import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import { PiLockKeyOpen } from "react-icons/pi";
import OrganizationTabs from "../../components/OrganizationTabs.jsx";
import ConversationHeader from "../../components/conversation/Header.jsx";
import ConversationMessage from "../../components/conversation/Message.jsx";
import ConversationFooter from "../../components/conversation/Footer.jsx";
import ConversationInfoSidebar from "../../components/conversation/sidebar/ConversationInfoSidebar.jsx";
import LiveAssistant from "../../components/LiveAssistant/index.jsx";
import { appBrandingAssets, agentSelfId, setRealUserId } from "../../data/CommonData.js";
import ChatList from "../../components/chats/ChatList.jsx";
import ChatListActionsMenu from "../../components/chats/ChatListActionsMenu.jsx";

// Lazy-loaded dialogs/overlays — split out of the main bundle, loaded on first open.
const MessageInfoOverlay = lazy(() => import("../../components/conversation/messages/MessageInfoOverlay.jsx"));
const TranslateDialog = lazy(() => import("../../components/conversation/messages/TranslateDialog.jsx"));
const SummarizeDialog = lazy(() => import("../../components/conversation/messages/SummarizeDialog.jsx"));
const ToneAdjusterDialog = lazy(() => import("../../components/conversation/messages/ToneAdjusterDialog.jsx"));
const ForwardMessageDialog = lazy(() => import("../../components/conversation/messages/ForwardMessageDialog.jsx"));
const ThreadSoundPicker = lazy(() => import("../../components/conversation/ThreadSoundPicker.jsx"));
const DisappearingMessagesDialog = lazy(() => import("../../components/conversation/DisappearingMessagesDialog.jsx"));
import { useChatLockContext } from "../../contexts/ChatLockContext.jsx";
import { LockMode } from "../../hooks/useChatLock.js";
import { FaUserLock } from "react-icons/fa";
import useConversationCache from "../../hooks/useConversationCache.js";
import useSecureStorageValue from "../../hooks/useSecureStorageValue.js";
import { SETTINGS_STORAGE_KEYS } from "./settings/storageKeys.js";
import {
  DEFAULT_PROFILE,
  normalizeProfilePayload,
} from "./settings/defaults.js";
import { parseJsonValue } from "./settings/utils.js";
import useThreadData from "../../hooks/useThreadData.js";
import useSettings from "../../hooks/useSettings.js";
import { threadService } from "../../services/threadService.js";
import { THREAD_NAVIGATE_EVENT } from "../../utils/threadNavigationEvents.js";
import { toggleReactionOnMessage } from "../../components/conversation/messages/reactions.js";
import useMutedThreads from "../../hooks/useMutedThreads.js";
import {
  buildReplyContextPayload,
  canEditMessage,
  canCopyImageMessage,
  getEditableField,
  getImageCopySource,
  getMessagePlainText,
  normalizeMessage,
  updateEditableMessageValue,
  isOwnMessage,
} from "../../components/conversation/messages/helpers.js";
import { copyImageSourceToClipboard } from "../../utils/blobUtils.js";
import { closeSidebar, openSidebar } from "../../redux/slices/app.js";
import { detectDeviceLabel } from "../../utils/deviceDetect.js";
import isGroupThread from "../../utils/threadUtils.js";
import useCurrentUser from "../../hooks/useCurrentUser.js";
import useChatSync from "../../hooks/useChatSync.js";
import { fetchMessages, sendMessage as apiSendMessage, markThreadRead, editMessage as apiEditMessage, deleteMessage as apiDeleteMessage, translateText, uploadChatFile, uploadChatFileWithProgress, fetchSmartReplies, createGroup as apiCreateGroup } from "../../services/chatApi.js";
import { fetchWithAuth } from "../../utils/authApi.js";
import { API_BASE_URL } from "../../config/apiBaseUrl.js";
import useChatSocket from "../../hooks/useChatSocket.js";
import { useTypingActions } from "../../contexts/TypingIndicatorContext.jsx";

const THREAD_SELECTION_STORAGE_KEY = "chatx.selectedThreadsByOrg";

const readStoredThreadSelections = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(THREAD_SELECTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("Failed to read stored thread selections:", error);
    return {};
  }
};

const persistThreadSelections = (value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      THREAD_SELECTION_STORAGE_KEY,
      JSON.stringify(value)
    );
  } catch (error) {
    console.warn("Failed to persist thread selections:", error);
  }
};

const FALLBACK_USER_ID = agentSelfId;
const MESSAGE_WINDOW_SIZE = 30;
const SIDEBAR_WIDTH = 360;

const createForwardMessageId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `fwd-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createGroupId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `group-${Date.now()}-${Math.random().toString(16).slice(2)}`;


const cloneMessagePayload = (message) => {
  if (!message) return null;
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(message);
    }
  } catch {
    // ignore structured clone failures
  }
  try {
    return JSON.parse(JSON.stringify(message));
  } catch {
    return { ...message };
  }
};

const sanitizeForwardMetadata = (metadata = {}) => {
  const next = { ...(metadata || {}) };
  delete next.replyTo;
  delete next.pinned;
  delete next.pinnedAt;
  delete next.pinnedBy;
  delete next.pinEvent;
  return next;
};

const deriveForwardedFromLabel = (message, fallbackLabel) => {
  return (
    message?.metadata?.forwardedFrom ||
    message?.metadata?.senderName ||
    message?.author?.name ||
    message?.authorName ||
    message?.sender_name ||
    fallbackLabel ||
    "Forwarded message"
  );
};

const normalizeAttachmentList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value.length === "number") {
    const result = [];
    for (let index = 0; index < value.length; index += 1) {
      result.push(value[index]);
    }
    return result.filter(Boolean);
  }
  if (typeof value[Symbol.iterator] === "function") {
    return Array.from(value).filter(Boolean);
  }
  return [];
};

const normaliseLookupValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
};

const normalizeIdentityValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
};

const collectGroupMemberTokens = (thread) => {
  const tokens = [];
  const pushToken = (value) => {
    const normalized = normalizeIdentityValue(value);
    if (normalized) tokens.push(normalized);
  };
  const members = Array.isArray(thread?.members) ? thread.members : [];
  members.forEach((member) => {
    pushToken(member?.id);
    pushToken(member?.user_id);
    pushToken(member?.userId);
    pushToken(member?.email);
    pushToken(member?.username);
    pushToken(member?.name);
    pushToken(member?.label);
  });
  const participants = Array.isArray(thread?.participants)
    ? thread.participants
    : [];
  participants.forEach((participant) => pushToken(participant));
  return tokens;
};

const copyTextToClipboard = async (value) => {
  if (!value) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      console.warn('Clipboard write failed', error);
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand('copy');
    document.body.removeChild(textarea);
    return succeeded;
  } catch (error) {
    console.warn('Clipboard fallback failed', error);
    return false;
  }
};

const profileEquals = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

const GeneralApp = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { chatListRightAligned } = useSettings();
  const mascotSrc = appBrandingAssets.mascot;
  const sidebar = useSelector((state) => state.app.sidebar, shallowEqual);
  const currentUser = useCurrentUser();
  const { orgId: syncedOrgId } = useChatSync(); // fetch real threads from backend and sync into threadService
  const storedName = String(currentUser?.displayName || "").trim();
  const welcomeName = storedName || "there";
  const storedProfileRaw = useSecureStorageValue(
    SETTINGS_STORAGE_KEYS.profile,
    ""
  );
  const wallpaperRaw = useSecureStorageValue(
    SETTINGS_STORAGE_KEYS.wallpaper,
    ""
  );
  const wallpaperSelection = useMemo(
    () => parseJsonValue(wallpaperRaw, null),
    [wallpaperRaw]
  );
  const resolvedProfile = useMemo(() => {
    const parsed = parseJsonValue(storedProfileRaw, DEFAULT_PROFILE);
    return normalizeProfilePayload(parsed);
  }, [storedProfileRaw]);
  // Real user ID from profile — fallback to agentSelfId only if not loaded yet
  const CURRENT_USER_ID = useMemo(() => {
    const realId = resolvedProfile?.user_id || resolvedProfile?.id;
    if (realId && String(realId) !== FALLBACK_USER_ID && !String(realId).startsWith('agent')) {
      return String(realId);
    }
    return FALLBACK_USER_ID;
  }, [resolvedProfile]);
  const currentUserName = useMemo(
    () =>
      resolvedProfile.displayName ||
      resolvedProfile.fullName ||
      resolvedProfile.username ||
      DEFAULT_PROFILE.displayName,
    [resolvedProfile]
  );
  const currentUserTokens = useMemo(() => {
    const tokens = new Set();
    const addToken = (value) => {
      const normalized = normalizeIdentityValue(value);
      if (normalized) tokens.add(normalized);
    };
    addToken(CURRENT_USER_ID);
    addToken(resolvedProfile?.id);
    addToken(resolvedProfile?.user_id);
    addToken(resolvedProfile?.email);
    addToken(resolvedProfile?.username);
    addToken(resolvedProfile?.displayName);
    addToken(resolvedProfile?.fullName);
    return tokens;
  }, [resolvedProfile]);

  const {
    organizations,
    threadsByOrg,
    getThreadsForOrg,
    getMessagesWindow,
    loadingStates,
    appendMessages,
    upsertThread,
    removeThread,
    patchMessage,
    removeMessage: removeStoredMessage,
    markThreadMessagesRead,
  } = useThreadData();

  const fallbackOrgId = useMemo(() => {
    const preferred =
      organizations.find((org) => org?.isPrimary)?.id ?? organizations[0]?.id;
    return preferred ?? null;
  }, [organizations]);

  const lastProfileRef = useRef(null);
  const lastPreviewMessageRef = useRef(new Map());
  const deliveryTimersRef = useRef(new Map());

  useEffect(() => {
    const trimmedUsername = storedName?.trim() || "";
    const organizationId =
      resolvedProfile.organizationId ??
      resolvedProfile.organization_id ??
      fallbackOrgId;
    const defaultDisplayName =
      resolvedProfile.displayName ??
      resolvedProfile.name ??
      DEFAULT_PROFILE.displayName;
    const displayName = trimmedUsername || defaultDisplayName;

    const nextProfile = {
      ...resolvedProfile,
      email: currentUser?.email || resolvedProfile.email,
      username: trimmedUsername || resolvedProfile.username || displayName,
      fullName: trimmedUsername || resolvedProfile.fullName || displayName,
      displayName,
      organizationId,
      organization_id: organizationId,
    };

    // Set real user ID globally as soon as profile loads
    const realId = nextProfile?.user_id || nextProfile?.id;
    if (realId) setRealUserId(realId);

    if (profileEquals(lastProfileRef.current, nextProfile)) {
      return;
    }
    lastProfileRef.current = nextProfile;
    threadService.setAgentProfile(nextProfile);
  }, [storedName, resolvedProfile, fallbackOrgId]);

  // Fetch latest device info from /auth/me and push os_name + user_agent into agentProfile
  useEffect(() => {
    let cancelled = false;
    fetchWithAuth(`${API_BASE_URL}/auth/me`, { method: "GET" })
      .then(({ payload }) => {
        if (cancelled) return;
        const devices = payload?.data?.user_devices ?? payload?.user_devices ?? [];
        if (!devices.length) return;
        // Sort by last_active_at descending to get the latest device
        const sorted = [...devices].sort(
          (a, b) => new Date(b.last_active_at ?? 0) - new Date(a.last_active_at ?? 0)
        );
        const latest = sorted[0];
        threadService.setAgentProfile({
          os_name: latest.os_name ?? null,
          user_agent: latest.user_agent ?? null,
        });
        // Update avatar from signed profile_url (backend signs S3 keys in /auth/me)
        const signedAvatar = payload?.data?.user?.profile_url || payload?.data?.profile_url;
        if (signedAvatar && signedAvatar.startsWith("http")) {
          threadService.setAgentProfile({ avatar: signedAvatar });
        }
        // Initialize user timezone for time formatting
        const userTz = payload?.data?.user?.timezone;
        if (userTz) {
          import("../../utils/timezone.js").then(({ setUserTimezone }) => setUserTimezone(userTz));
        }
      })
      .catch(() => {/* silent — device info is non-critical */});
    return () => { cancelled = true; };
  }, []);

  const defaultOrganizationId = organizations[0]?.id ?? null;
  const storedSelectionsInitial = useMemo(
    () => readStoredThreadSelections(),
    []
  );
  const [storedSelections, setStoredSelections] = useState(
    storedSelectionsInitial
  );
  const [activeOrganizationId, setActiveOrganizationId] = useState(
    () => defaultOrganizationId
  );
  const [activeThreadId, setActiveThreadId] = useState(
    () => storedSelectionsInitial[defaultOrganizationId] ?? null
  );
  const [orgTransitionLoading, setOrgTransitionLoading] = useState(true);
  const [pendingAttachmentDrops, setPendingAttachmentDrops] = useState({});
  const [replyReference, setReplyReference] = useState(null);
  const clearReplyReference = useCallback(() => setReplyReference(null), []);
  const [editingReference, setEditingReference] = useState(null);
  const [pollEditingReference, setPollEditingReference] = useState(null);
  const clearEditingReference = useCallback(
    () => setEditingReference(null),
    []
  );
  const clearPollEditingReference = useCallback(
    () => setPollEditingReference(null),
    []
  );
  const [multiCopyState, setMultiCopyState] = useState({
    active: false,
    threadId: null,
    selected: new Set(),
  });
  const selectionActive =
    multiCopyState.active && multiCopyState.threadId === activeThreadId;
  const selectionCount = selectionActive
    ? multiCopyState.selected.size
    : 0;
  const [messageToast, setMessageToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [actionDialog, setActionDialog] = useState({
    open: false,
    type: null,
    message: null,
    threadId: null,
  });
  // Confirmation dialog state for destructive thread-level actions
  // (exit / delete group / delete chat). Split from `actionDialog` so the
  // existing per-message flow stays untouched.
  const [threadActionConfirm, setThreadActionConfirm] = useState({
    open: false,
    type: null, // 'leave' | 'delete-group' | 'hide'
    thread: null,
    busy: false,
  });
  const closeThreadActionConfirm = useCallback(() => {
    setThreadActionConfirm((prev) => ({ ...prev, open: false, busy: false }));
  }, []);
  const [messageInfoState, setMessageInfoState] = useState({
    open: false,
    message: null,
    threadId: null,
    version: 0,
  });
  const previousThreadIdRef = useRef(activeThreadId);
  const [forwardState, setForwardState] = useState({
    open: false,
    messages: [],
    sourceThreadId: null,
    fromSelection: false,
  });
  const [translateDialogState, setTranslateDialogState] = useState({
    open: false,
    message: null,
    threadId: null,
  });
  const [summarizeDialogState, setSummarizeDialogState] = useState({
    open: false,
    message: null,
  });
  const [toneAdjustDialogState, setToneAdjustDialogState] = useState({
    open: false,
    message: null,
  });
  const [soundPickerState, setSoundPickerState] = useState({ open: false, threadId: null });
  const [disappearDialogState, setDisappearDialogState] = useState({ open: false, threadId: null, currentTimer: 0 });
  const showMessageToast = useCallback((message, severity = "success") => {
    setMessageToast({ open: true, message, severity });
  }, []);
  const closeMessageToast = useCallback(() => {
    setMessageToast((prev) => ({ ...prev, open: false }));
  }, []);
  const openForwardDialog = useCallback(
    (messages, { threadId = null, fromSelection = false } = {}) => {
      if (!Array.isArray(messages) || messages.length === 0) return;
      const normalizedMessages = messages.filter(Boolean);
      if (!normalizedMessages.length) return;
      setForwardState({
        open: true,
        messages: normalizedMessages,
        sourceThreadId: threadId,
        fromSelection: Boolean(fromSelection),
      });
    },
    []
  );
  const closeForwardDialog = useCallback(() => {
    setForwardState({
      open: false,
      messages: [],
      sourceThreadId: null,
      fromSelection: false,
    });
  }, []);

  const clearDeliveryTimers = useCallback((messageId) => {
    if (!messageId) return;
    const timers = deliveryTimersRef.current.get(messageId);
    if (!timers) return;
    timers.forEach((timer) => clearTimeout(timer));
    deliveryTimersRef.current.delete(messageId);
  }, []);

  useEffect(() => {
    return () => {
      deliveryTimersRef.current.forEach((timers) =>
        timers.forEach((timer) => clearTimeout(timer))
      );
      deliveryTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const handleLogout = () => {
      dispatch(closeSidebar());
    };
    if (typeof window === "undefined") return undefined;
    window.addEventListener("chatx:logout", handleLogout);
    return () => window.removeEventListener("chatx:logout", handleLogout);
  }, [dispatch]);

  const locateThreadById = useCallback(
    (orgId, threadId) => {
      if (!orgId || !threadId) return null;
      const list = getThreadsForOrg(orgId) ?? [];
      return list.find((thread) => thread.id === threadId) ?? null;
    },
    [getThreadsForOrg]
  );

 
  const getMessagePreview = useCallback((targetMessage) => {
    if (!targetMessage) return "";
    const textContent =
      targetMessage.content?.text ??
      targetMessage.message ??
      targetMessage.content?.caption ??
      "";
    if (textContent) {
      return textContent.length > 120
        ? `${textContent.slice(0, 117)}...`
        : textContent;
    }
    switch (targetMessage.type) {
      case "image":
        return "Image attachment";
      case "video":
        return "Video attachment";
      case "file":
        return targetMessage.content?.fileName || "File attachment";
      case "code":
        return "Code snippet";
      default:
        return "Attachment";
    }
  }, []);
  const [threadWindowMeta, setThreadWindowMeta] = useState({});

  const {
    isLocked,
    dialogMode,
    dialogOpen,
    pinValue,
    snackbar,
    openUnlockDialog,
    closeDialog,
    handlePinSubmit,
    handlePinChange,
    handleSnackbarClose,
  } = useChatLockContext();

  const updateStoredSelections = useCallback((updater) => {
    setStoredSelections((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : updater || {};
      persistThreadSelections(next);
      return next;
    });
  }, []);

  const queueAttachmentsForThread = useCallback((threadId, files = []) => {
    if (!threadId || !Array.isArray(files) || files.length === 0) return;
    setPendingAttachmentDrops((prev) => {
      const next = { ...prev };
      const existing = next[threadId] ?? [];
      next[threadId] = [...existing, ...files];
      return next;
    });
  }, []);

  const handleExternalThreadIntent = useCallback(
    ({ threadId, organizationId, attachments }) => {
      if (!threadId) return;
      if (isLocked) {
        openUnlockDialog();
        return;
      }
      const targetOrgId = organizationId ?? activeOrganizationId ?? null;
      if (targetOrgId && targetOrgId !== activeOrganizationId) {
        setActiveOrganizationId(targetOrgId);
      }
      setActiveThreadId(threadId);
      if (targetOrgId) {
        updateStoredSelections((prev) => ({
          ...prev,
          [targetOrgId]: threadId,
        }));
      }
      const normalizedAttachments = normalizeAttachmentList(attachments);
      if (normalizedAttachments.length) {
        queueAttachmentsForThread(threadId, [...normalizedAttachments]);
      }
    },
    [
      activeOrganizationId,
      isLocked,
      openUnlockDialog,
      queueAttachmentsForThread,
      updateStoredSelections,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleEvent = (event) => {
      handleExternalThreadIntent(event.detail || {});
    };
    window.addEventListener(THREAD_NAVIGATE_EVENT, handleEvent);
    return () => window.removeEventListener(THREAD_NAVIGATE_EVENT, handleEvent);
  }, [handleExternalThreadIntent]);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.serviceWorker?.addEventListener
    ) {
      return undefined;
    }
    const handler = (event) => {
      if (event?.data?.type === "OPEN_THREAD_FROM_NOTIFICATION") {
        handleExternalThreadIntent(event.data);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, [handleExternalThreadIntent]);

  // Resolve "thread-self" to "dm-{userId}" for socket/API calls
  const resolveThreadId = useCallback((threadId) => {
    if (threadId === 'thread-self' && CURRENT_USER_ID && !String(CURRENT_USER_ID).startsWith('agent')) {
      return `dm-${CURRENT_USER_ID}`;
    }
    return threadId;
  }, [CURRENT_USER_ID]);

  const isRealThread = useCallback((threadId) => {
    if (!threadId) return false;
    const resolved = resolveThreadId(threadId);
    return resolved.startsWith('dm-') || resolved.startsWith('group-');
  }, [resolveThreadId]);

  const conversationLoader = useCallback(
    async (threadId) => {
      if (!threadId) return [];

      // For real API threads: always fetch from database (source of truth)
      if (isRealThread(threadId)) {
        const apiThreadId = resolveThreadId(threadId);
        const tryFetch = async () => {
          const { messages: apiMessages, hasMore } = await fetchMessages(apiThreadId, { limit: MESSAGE_WINDOW_SIZE, fullResponse: true });
          if (Array.isArray(apiMessages) && apiMessages.length) {
            appendMessages(threadId, apiMessages);
          }
          setThreadWindowMeta((prev) => ({
            ...prev,
            [threadId]: { hasMore },
          }));
          return apiMessages;
        };

        try {
          return await tryFetch();
        } catch (err) {
          console.warn("[conversationLoader] fetch failed, retrying:", err?.message);
          try {
            await new Promise((r) => setTimeout(r, 800));
            return await tryFetch();
          } catch (retryErr) {
            console.error("[conversationLoader] retry failed:", retryErr?.message);
            // Fallback: return cached messages from threadService if available
            const cached = getMessagesWindow?.(threadId, { limit: MESSAGE_WINDOW_SIZE });
            if (cached?.messages?.length) {
              console.log("[conversationLoader] using cached messages as fallback");
              return cached.messages;
            }
            return [];
          }
        }
      }

      // For mock/local threads: read from threadService cache
      const windowResult =
        getMessagesWindow?.(threadId, {
          limit: MESSAGE_WINDOW_SIZE,
        }) ?? {};
      const messages = windowResult.messages ?? [];
      setThreadWindowMeta((prev) => {
        const nextHasMore = Boolean(windowResult.hasMore);
        if (prev[threadId]?.hasMore === nextHasMore) {
          return prev;
        }
        return {
          ...prev,
          [threadId]: { hasMore: nextHasMore },
        };
      });
      return messages;
    },
    [getMessagesWindow, appendMessages, isRealThread]
  );

  const fetchOlderMessages = useCallback(
    async ({ threadId, before, limit = MESSAGE_WINDOW_SIZE } = {}) => {
      if (!threadId) {
        return { messages: [], hasMore: false };
      }

      // For real threads: fetch older messages from API
      if (isRealThread(threadId) && before) {
        try {
          const { messages, hasMore } = await fetchMessages(resolveThreadId(threadId), { limit, before, fullResponse: true });
          // Store older messages in conversation cache so they survive state resets
          if (messages.length) {
            for (const msg of messages) {
              upsertMessage(threadId, msg);
            }
          }
          setThreadWindowMeta((prev) => ({
            ...prev,
            [threadId]: { hasMore },
          }));
          return { messages, hasMore };
        } catch (err) {
          console.warn("[fetchOlder] API error:", err?.message);
          return { messages: [], hasMore: false };
        }
      }

      // For local/mock threads: read from threadService cache
      const windowResult =
        getMessagesWindow?.(threadId, {
          before,
          limit,
        }) ?? { messages: [], hasMore: false };
      setThreadWindowMeta((prev) => {
        const nextHasMore = Boolean(windowResult.hasMore);
        if (prev[threadId]?.hasMore === nextHasMore) {
          return prev;
        }
        return {
          ...prev,
          [threadId]: { hasMore: nextHasMore },
        };
      });
      return windowResult;
    },
    [getMessagesWindow, isRealThread]
  );

  const {
    state: conversationState,
    loadThread,
    prime,
    invalidate,
    upsertMessage,
    removeMessage: removeMessageFromCache,
    findMessage,
    markCacheMessagesRead,
  } = useConversationCache(conversationLoader, { max: 20 });
  const closeActionDialog = useCallback(
    () =>
      setActionDialog({
        open: false,
        type: null,
        message: null,
        threadId: null,
      }),
    []
  );
  const handleCloseMessageInfo = useCallback(
    () =>
      setMessageInfoState((prev) => ({
        open: false,
        message: null,
        threadId: null,
        version: prev.version + 1,
      })),
    []
  );
  const performMessageRemoval = useCallback(
    (type, threadId, targetMessage) => {
      if (!threadId || !targetMessage?.id) return;
      removeMessageFromCache(threadId, targetMessage.id);
      removeStoredMessage(threadId, targetMessage.id);
      console.info(
        `[Conversation] ${type === "unsend" ? "Unsent" : "Deleted"} message`,
        targetMessage.id
      );
    },
    [removeMessageFromCache, removeStoredMessage]
  );
  // ─── Socket.IO real-time chat ───────────────────────────────────────────────
  const { startTyping: typingStart, stopTyping: typingStop } = useTypingActions();
  // Pinned threads: threadId → pinned_at ISO (used to pin chats to top)
  const [pinnedThreads, setPinnedThreads] = useState({});
  const chatSocket = useChatSocket({
    onNewMessage: useCallback((data) => {
      if (!data?.threadId || !data?.message) return;
      upsertMessage(data.threadId, data.message);
      appendMessages?.(data.threadId, [data.message]);
      // Update thread list: incoming message = no tick shown
      if (activeOrganizationId && data.message?.direction === 'incoming') {
        upsertThread(activeOrganizationId, {
          id: data.threadId,
          lastMessageDirection: 'incoming',
          lastMessageStatus: null,
        });
      }
    }, [upsertMessage, appendMessages, activeOrganizationId, upsertThread]),

    onMessageEdited: useCallback((data) => {
      if (!data?.threadId || !data?.message) return;
      console.log("[edit] received:", data.threadId, data.message?.id, data.message?.content?.text);
      upsertMessage(data.threadId, data.message);
      patchMessage?.(data.threadId, data.message);
    }, [upsertMessage, patchMessage]),

    onMessageDeleted: useCallback((data) => {
      if (!data?.threadId || !data?.messageId) return;
      removeMessageFromCache(data.threadId, data.messageId);
      removeStoredMessage(data.threadId, data.messageId);
    }, [removeMessageFromCache, removeStoredMessage]),

    onMessageRecalled: useCallback((data) => {
      if (!data?.threadId || !data?.messageId) return;
      // Replace message content with recalled indicator
      upsertMessage(data.threadId, {
        id: data.messageId,
        content: { text: "", recalled: true },
      });
      patchMessage?.(data.threadId, {
        id: data.messageId,
        content: { text: "", recalled: true },
      });
    }, [upsertMessage, patchMessage]),

    onMessageReacted: useCallback((data) => {
      if (!data?.threadId || !data?.messageId) return;
      console.log("[reaction] received:", data.threadId, data.messageId, data.emoji, data.action);
      const msg = findMessage(data.threadId, data.messageId);
      if (!msg) {
        console.warn("[reaction] message not found in cache:", data.threadId, data.messageId);
        return;
      }
      const updated = toggleReactionOnMessage(msg, {
        emoji: data.emoji,
        userId: String(data.userId),
        userName: data.userName || "",
      });
      upsertMessage(data.threadId, updated);
      patchMessage?.(data.threadId, updated);
    }, [findMessage, upsertMessage, patchMessage]),

    onTypingUpdate: useCallback((data) => {
      if (!data?.threadId || !data?.userId) return;
      if (data.isTyping) {
        typingStart(data.threadId, { id: data.userId, name: data.name || "Someone", source: "remote" });
      } else {
        typingStop(data.threadId, data.userId);
      }
    }, [typingStart, typingStop]),

    onOnlineList: useCallback((data) => {
      if (!data?.users || !activeOrganizationId) return;
      data.users.forEach((uid) => {
        upsertThread(activeOrganizationId, { id: `dm-${uid}`, status: "Online" });
      });
    }, [activeOrganizationId, upsertThread]),

    onUserOnline: useCallback((data) => {
      if (!data?.userId || !activeOrganizationId) return;
      upsertThread(activeOrganizationId, { id: `dm-${data.userId}`, status: "Online" });
    }, [activeOrganizationId, upsertThread]),

    onUserOffline: useCallback((data) => {
      if (!data?.userId || !activeOrganizationId) return;
      upsertThread(activeOrganizationId, { id: `dm-${data.userId}`, status: "Offline" });
    }, [activeOrganizationId, upsertThread]),

    onUserStatus: useCallback((data) => {
      if (!data?.userId || !activeOrganizationId) return;
      upsertThread(activeOrganizationId, { id: `dm-${data.userId}`, status: data.status || "Online" });
    }, [activeOrganizationId, upsertThread]),

    onReadAck: useCallback((data) => {
      if (!data?.threadId) return;
      // Receiver read our messages — update all outgoing messages to "read" (green tick)
      markThreadMessagesRead(data.threadId);    // threadService (sidebar tick + stored messages)
      markCacheMessagesRead(data.threadId);     // conversation cache (chat window ticks)
      // Update thread list tick to green
      if (activeOrganizationId) {
        upsertThread(activeOrganizationId, { id: data.threadId, lastMessageStatus: 'read' });
      }
    }, [markThreadMessagesRead, markCacheMessagesRead, activeOrganizationId, upsertThread]),

    // Receiver came online — messages delivered (double tick)
    onDeliveredAck: useCallback((data) => {
      if (!data?.threadId || !activeOrganizationId) return;
      upsertThread(activeOrganizationId, { id: data.threadId, lastMessageStatus: 'delivered' });
      // Update individual messages in conversation cache to "delivered"
      if (data.messageIds?.length) {
        for (const msgId of data.messageIds) {
          upsertMessage(data.threadId, { id: String(msgId), status: 'delivered' });
        }
      }
    }, [activeOrganizationId, upsertThread, upsertMessage]),

    // Thread update from backend (unread count, read status, etc.)
    onThreadUpdate: useCallback((data) => {
      if (!data?.threadId || !activeOrganizationId) return;
      upsertThread(activeOrganizationId, { id: data.threadId, ...data });
    }, [activeOrganizationId, upsertThread]),

    onPollVoted: useCallback((data) => {
      if (!data?.threadId || !data?.messageId || !data?.options) return;
      const msg = findMessage(data.threadId, data.messageId);
      if (!msg) return;
      const updated = {
        ...msg,
        content: { ...msg.content, options: data.options },
        metadata: { ...msg.metadata, options: data.options },
      };
      upsertMessage(data.threadId, updated);
      patchMessage?.(data.threadId, updated);
    }, [findMessage, upsertMessage, patchMessage]),

    onPollEnded: useCallback((data) => {
      if (!data?.threadId || !data?.messageId) return;
      const msg = findMessage(data.threadId, data.messageId);
      if (!msg) return;
      const updated = {
        ...msg,
        content: { ...msg.content, endedAt: data.endedAt, endedBy: data.endedBy },
        metadata: { ...msg.metadata, endedAt: data.endedAt, endedBy: data.endedBy },
      };
      upsertMessage(data.threadId, updated);
      patchMessage?.(data.threadId, updated);
    }, [findMessage, upsertMessage, patchMessage]),

    onPollEdited: useCallback((data) => {
      if (!data?.threadId || !data?.messageId || !data?.content) return;
      const msg = findMessage(data.threadId, data.messageId);
      if (!msg) return;
      const updated = {
        ...msg,
        content: { ...msg.content, ...data.content },
        metadata: { ...msg.metadata, ...data.content },
      };
      upsertMessage(data.threadId, updated);
      patchMessage?.(data.threadId, updated);
    }, [findMessage, upsertMessage, patchMessage]),

    // S3 upload progress from backend (Phase 2: Backend → S3, maps to 50-100%)
    onUploadS3Progress: useCallback((data) => {
      if (!data?.uploadId) return;
      const entry = window.__pendingUploads?.get(data.uploadId);
      if (!entry) return;
      const { threadId, message } = entry;
      const scaled = 50 + Math.round((data.percent || 0) * 0.5);
      // Throttle: only update every 5%
      if (entry._lastS3 && scaled - entry._lastS3 < 5 && scaled < 100) return;
      entry._lastS3 = scaled;
      upsertMessage(threadId, {
        ...message,
        status: "uploading",
        metadata: { ...(message.metadata || {}), uploadState: "uploading", uploadProgress: scaled, uploadPhase: "s3" },
      });
    }, [upsertMessage]),

    onPinSync: useCallback((rows) => {
      const map = {};
      (rows || []).forEach((r) => { if (r?.thread_id) map[r.thread_id] = r.pinned_at || new Date().toISOString(); });
      setPinnedThreads(map);
    }, []),

    onPinUpdate: useCallback((data) => {
      if (!data?.threadId) return;
      setPinnedThreads((prev) => {
        const next = { ...prev };
        if (data.pinned) next[data.threadId] = data.pinned_at || new Date().toISOString();
        else delete next[data.threadId];
        return next;
      });
    }, []),
  });

  // ─── Mute hook ────────────────────────────────────────────────────────────────
  const { isMuted: isThreadMuted, muteThread, unmuteThread } = useMutedThreads();

  // ─── Header menu action handler ─────────────────────────────────────────────
  const handleHeaderMenuAction = useCallback(async (action, thread) => {
    const tid = thread?.id || activeThreadId;
    if (!tid) return;
    switch (action) {
      case "Mute":
        muteThread(tid, "forever");
        showMessageToast("Chat muted");
        break;
      case "Unmute":
        unmuteThread(tid);
        showMessageToast("Chat unmuted");
        break;
      case "NotificationSound":
        setSoundPickerState({ open: true, threadId: tid });
        break;
      case "DisappearingMessages": {
        const timer = await chatSocket.getDisappearTimer(tid).catch(() => ({}));
        setDisappearDialogState({ open: true, threadId: tid, currentTimer: timer?.durationSeconds || 0 });
        break;
      }
      default:
        break;
    }
  }, [activeThreadId, muteThread, unmuteThread, showMessageToast, chatSocket]);

  const handleSoundPickerSelect = useCallback((soundFile) => {
    const tid = soundPickerState.threadId;
    if (!tid) return;
    chatSocket.setThreadSound(tid, soundFile);
    // Update local secure storage
    import("../../utils/secureStorage.js").then(({ secureStorage }) => {
      secureStorage.getItem("chatx.threadSounds").then((raw) => {
        const sounds = raw ? JSON.parse(raw) : {};
        if (soundFile === "default") delete sounds[tid];
        else sounds[tid] = soundFile;
        secureStorage.setItem("chatx.threadSounds", JSON.stringify(sounds));
      }).catch(() => {});
    });
    setSoundPickerState({ open: false, threadId: null });
    showMessageToast("Notification sound updated");
  }, [soundPickerState.threadId, chatSocket, showMessageToast]);

  const handleDisappearSave = useCallback((durationSeconds) => {
    const tid = disappearDialogState.threadId;
    if (!tid) return;
    chatSocket.setDisappearTimer(tid, durationSeconds);
    setDisappearDialogState({ open: false, threadId: null, currentTimer: 0 });
    showMessageToast(durationSeconds ? "Disappearing messages enabled" : "Disappearing messages disabled");
  }, [disappearDialogState.threadId, chatSocket, showMessageToast]);

  // Emit thread:focus when active thread changes — tells backend which chat user is viewing
  // Also clear on tab hidden so notifications still fire when app is minimized
  useEffect(() => {
    if (!chatSocket?.focusThread) return;
    const pushFocus = () => {
      const tabVisible = typeof document === "undefined" || document.visibilityState === "visible";
      if (!tabVisible) {
        chatSocket.focusThread(null);
        return;
      }
      const resolved = activeThreadId && isRealThread(activeThreadId) ? resolveThreadId(activeThreadId) : null;
      chatSocket.focusThread(resolved);
    };
    pushFocus();
    document.addEventListener("visibilitychange", pushFocus);
    window.addEventListener("focus", pushFocus);
    window.addEventListener("blur", pushFocus);
    return () => {
      document.removeEventListener("visibilitychange", pushFocus);
      window.removeEventListener("focus", pushFocus);
      window.removeEventListener("blur", pushFocus);
    };
  }, [activeThreadId, chatSocket, isRealThread, resolveThreadId]);

  const handleTypingStart = useCallback((tid) => {
    if (tid && isRealThread(tid)) chatSocket.startTyping(tid);
  }, [chatSocket, isRealThread]);

  const handleTypingStop = useCallback((tid) => {
    if (tid && isRealThread(tid)) chatSocket.stopTyping(tid);
  }, [chatSocket, isRealThread]);

  const handleActionConfirm = useCallback(() => {
    if (!actionDialog.open || !actionDialog.message || !actionDialog.threadId) {
      closeActionDialog();
      return;
    }
    const msgId = actionDialog.message?.id;
    const threadId = actionDialog.threadId;

    if (actionDialog.type === "unsend" && isRealThread(threadId)) {
      // Recall: remove from both sides via socket
      chatSocket.recallMessage(msgId, threadId);
    } else if (actionDialog.type === "delete" && isRealThread(threadId)) {
      // Delete: remove from sender side only via socket
      chatSocket.deleteMessage(msgId, threadId);
    }
    performMessageRemoval(
      actionDialog.type,
      actionDialog.threadId,
      actionDialog.message
    );
    closeActionDialog();
  }, [actionDialog, closeActionDialog, performMessageRemoval, chatSocket, isRealThread]);
  const [scrollSignal, setScrollSignal] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [smartReplies, setSmartReplies] = useState([]);
  const smartReplyThreadRef = useRef(null);
  const closeInfoSidebar = useCallback(() => {
    dispatch(closeSidebar());
  }, [dispatch]);

  const hasMultipleOrganizations = organizations.length > 1;
  useEffect(() => {
    if (
      !organizations.some(
        (organization) => organization.id === activeOrganizationId
      )
    ) {
      const fallbackOrgId = organizations[0]?.id ?? null;
      setActiveOrganizationId(fallbackOrgId);
      const fallbackThreadId = storedSelections[fallbackOrgId] ?? null;
      setActiveThreadId(fallbackThreadId ?? null);
    }
  }, [activeOrganizationId, organizations, storedSelections]);

  // Auto-switch to the real org once useChatSync resolves the actual org ID
  const autoSwitchedRef = useRef(false);
  useEffect(() => {
    if (!syncedOrgId || autoSwitchedRef.current) return;
    autoSwitchedRef.current = true;
    setActiveOrganizationId(syncedOrgId);
    setActiveThreadId(storedSelections[syncedOrgId] ?? null);
  }, [syncedOrgId, storedSelections]);

  useEffect(() => {
    setSearchOpen(false);
  }, [activeThreadId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const isEditableTarget = (target) => {
      if (!target) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName?.toLowerCase?.() || "";
      return tag === "input" || tag === "textarea" || tag === "select";
    };
    const handleKeyDown = (event) => {
      if (isLocked || !activeThreadId) return;
      if (isEditableTarget(event.target)) return;
      const isFindShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key?.toLowerCase?.() === "f";
      if (!isFindShortcut) return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeThreadId, isLocked]);

  useEffect(() => {
    if (
      replyReference &&
      replyReference.threadId &&
      replyReference.threadId !== activeThreadId
    ) {
      setReplyReference(null);
    }
  }, [activeThreadId, replyReference]);

  useEffect(() => {
    if (
      editingReference &&
      editingReference.threadId &&
      editingReference.threadId !== activeThreadId
    ) {
      setEditingReference(null);
    }
  }, [activeThreadId, editingReference]);

  useEffect(() => {
    if (
      pollEditingReference &&
      pollEditingReference.threadId &&
      pollEditingReference.threadId !== activeThreadId
    ) {
      setPollEditingReference(null);
    }
  }, [activeThreadId, pollEditingReference]);

  useEffect(() => {
    setMultiCopyState((prev) => {
      if (!prev.active) return prev;
      if (prev.threadId === activeThreadId) return prev;
      return { active: false, threadId: null, selected: new Set() };
    });
  }, [activeThreadId]);

  useEffect(() => {
    if (!messageInfoState.open) return;
    if (messageInfoState.threadId === activeThreadId) return;
    setMessageInfoState((prev) => ({
      open: false,
      message: null,
      threadId: null,
      version: prev.version + 1,
    }));
  }, [messageInfoState.open, messageInfoState.threadId, activeThreadId]);

  const threadsForActiveOrg = useMemo(() => {
    const baseThreads =
      threadsByOrg?.[activeOrganizationId] ??
      getThreadsForOrg(activeOrganizationId) ??
      [];
    return baseThreads.filter((thread) => {
      const allowedAgents = Array.isArray(thread.allowedAgentIds)
        ? thread.allowedAgentIds
        : null;
      if (!allowedAgents || allowedAgents.length === 0) return true;
      return allowedAgents.includes(CURRENT_USER_ID);
    });
  }, [activeOrganizationId, getThreadsForOrg, threadsByOrg]);

  const selectableMembers = useMemo(
    () =>
      threadsForActiveOrg.filter((thread) => {
        if (isGroupThread(thread)) return false;
        if (thread?.isSelfThread) return false;
        if (thread?.user_id === CURRENT_USER_ID) return false;
        return true;
      }),
    [threadsForActiveOrg]
  );

  const threadDirectory = useMemo(() => {
    const map = new Map();
    threadsForActiveOrg.forEach((thread) => {
      if (thread?.id) {
        map.set(thread.id, thread);
      }
    });
    return map;
  }, [threadsForActiveOrg]);

  const threadOrgMap = useMemo(() => {
    const map = new Map();
    Object.entries(threadsByOrg || {}).forEach(([orgId, list]) => {
      (list || []).forEach((thread) => {
        if (thread?.id) {
          map.set(thread.id, orgId);
        }
      });
    });
    return map;
  }, [threadsByOrg]);

  const threadUserIndex = useMemo(() => {
    const map = new Map();
    const addEntry = (key, entry) => {
      if (!key || map.has(key)) return;
      map.set(key, entry);
    };
    Object.entries(threadsByOrg || {}).forEach(([orgId, list]) => {
      (list || []).forEach((thread) => {
        if (!thread?.id) return;
        const threadType = String(
          thread.type ?? thread.threadType ?? thread.conversationType ?? ""
        ).toLowerCase();
        if (threadType === "group") return;
        const allowedAgents = Array.isArray(thread.allowedAgentIds)
          ? thread.allowedAgentIds
          : null;
        if (
          allowedAgents &&
          allowedAgents.length > 0 &&
          !allowedAgents.includes(CURRENT_USER_ID)
        ) {
          return;
        }
        const entry = { thread, orgId };
        addEntry(`id:${thread.user_id ?? thread.userId ?? ""}`, entry);
        addEntry(`email:${normaliseLookupValue(thread.email)}`, entry);
        addEntry(
          `name:${normaliseLookupValue(thread.username ?? thread.label ?? "")}`,
          entry
        );
      });
    });
    return map;
  }, [threadsByOrg]);

  const updateThreadPreviewMeta = useCallback(
    (threadId, lastMessage, fallbackThread = null) => {
      if (!threadId || !lastMessage) return;
      const orgId =
        threadOrgMap.get(threadId) ??
        activeOrganizationId ??
        fallbackOrgId ??
        null;
      if (!orgId) return;
      const sourceThread =
        locateThreadById(orgId, threadId) ?? fallbackThread ?? null;
      const previewText =
        (lastMessage?.type === "poll" && lastMessage?.content?.question
          ? `Poll - ${lastMessage.content.question}`
          : "") ||
        lastMessage?.content?.text ||
        lastMessage?.message ||
        lastMessage?.content?.caption ||
        lastMessage?.content?.title ||
        lastMessage?.content?.question ||
        lastMessage?.content?.fileName ||
        "";
      const messageType =
        lastMessage?.type === "link"
          ? "link"
          : lastMessage?.type === "file" ||
              lastMessage?.type === "image" ||
              lastMessage?.type === "video"
            ? "attachment"
            : "message";
      const statusLabel = lastMessage?.status ?? "";
      const normalizedLastMessage = lastMessage?.__normalized
        ? lastMessage
        : normalizeMessage(lastMessage);
      upsertThread?.(orgId, {
        ...(sourceThread ?? { id: threadId }),
        preview: previewText,
        messageType,
        lastMessageAt: normalizedLastMessage?.createdAt,
        lastActivityAt: normalizedLastMessage?.createdAt,
        updatedAt: normalizedLastMessage?.createdAt,
        time: normalizedLastMessage?.createdAt,
        readStatus: statusLabel,
        read_status: statusLabel,
        lastMessage: normalizedLastMessage,
      });
    },
    [
      activeOrganizationId,
      fallbackOrgId,
      locateThreadById,
      threadOrgMap,
      upsertThread,
    ]
  );


  const activeThread = useMemo(
    () =>
      threadsForActiveOrg.find((thread) => thread.id === activeThreadId) ??
      null,
    [threadsForActiveOrg, activeThreadId]
  );

  const activeThreadTokens = useMemo(() => {
    if (!activeThread || isGroupThread(activeThread)) return new Set();
    const tokens = new Set();
    const addToken = (value) => {
      const normalized = normalizeIdentityValue(value);
      if (normalized) tokens.add(normalized);
    };
    addToken(activeThread.user_id);
    addToken(activeThread.userId);
    addToken(activeThread.email);
    addToken(activeThread.username);
    addToken(activeThread.label);
    addToken(activeThread.name);
    addToken(activeThread.fullName);
    addToken(activeThread.contact?.email);
    addToken(activeThread.contact?.name);
    return tokens;
  }, [activeThread]);

  const commonGroups = useMemo(() => {
    if (!activeThread || isGroupThread(activeThread)) return [];
    if (!currentUserTokens.size || !activeThreadTokens.size) return [];
    const hasAnyToken = (tokenSet, candidates) =>
      candidates.some((token) => tokenSet.has(token));
    return threadsForActiveOrg.filter((thread) => {
      if (!isGroupThread(thread)) return false;
      if (thread?.id === activeThread?.id) return false;
      const memberTokens = collectGroupMemberTokens(thread);
      if (!memberTokens.length) return false;
      return (
        hasAnyToken(currentUserTokens, memberTokens) &&
        hasAnyToken(activeThreadTokens, memberTokens)
      );
    });
  }, [
    activeThread,
    activeThreadTokens,
    currentUserTokens,
    threadsForActiveOrg,
  ]);

  const scheduleDeliveryLifecycle = useCallback(
    (threadId, message, { baseThread = null } = {}) => {
      const direction = message?.direction?.toLowerCase?.() || "";
      if (!threadId || !message?.id || direction !== "outgoing") return;
      clearDeliveryTimers(message.id);
      const resolvedBase =
        threadId === activeThreadId ? activeThread : baseThread;
      const steps = [
        { delay: 600, status: "sent" },
        { delay: 1600, status: "delivered" },
        { delay: 2800, status: "read" },
      ];
      const timers = [];
      const applyUpdate = (status, isFinal = false) => {
        const updated = { ...message, status };
        upsertMessage(threadId, updated);
        patchMessage?.(threadId, updated);
        updateThreadPreviewMeta(threadId, updated, resolvedBase);
        if (isFinal) {
          clearDeliveryTimers(message.id);
        }
      };
      steps.forEach(({ delay, status }, index) => {
        const timer = setTimeout(
          () => applyUpdate(status, index === steps.length - 1),
          delay
        );
        timers.push(timer);
      });
      deliveryTimersRef.current.set(message.id, timers);
    },
    [
      activeThread,
      activeThreadId,
      clearDeliveryTimers,
      patchMessage,
      upsertMessage,
      updateThreadPreviewMeta,
    ]
  );

  

  

  const infoOverlayThread = useMemo(() => {
    if (!messageInfoState.threadId) return null;
    if (activeThread?.id === messageInfoState.threadId) return activeThread;
    return (
      threadsForActiveOrg.find(
        (thread) => thread.id === messageInfoState.threadId
      ) ?? null
    );
  }, [messageInfoState.threadId, activeThread, threadsForActiveOrg]);

  const threadsLoading =
    !activeOrganizationId ||
    Boolean(loadingStates?.[activeOrganizationId]) ||
    orgTransitionLoading ||
    ((!threadsForActiveOrg || threadsForActiveOrg.length === 0) && loadingStates?.[activeOrganizationId] === undefined);

  useEffect(() => {
    if (!activeOrganizationId) return;
    // Don't clear thread selection while threads are still loading —
    // prevents losing activeThreadId when navigating back from Admin
    if (threadsLoading) return;

    const storedId = storedSelections[activeOrganizationId];
    if (storedId && storedId !== activeThreadId) {
      const exists = threadsForActiveOrg.some(
        (thread) => thread.id === storedId
      );
      if (exists) {
        setActiveThreadId(storedId);
        return;
      }
      updateStoredSelections((prev) => {
        const next = { ...prev };
        delete next[activeOrganizationId];
        return next;
      });
    }

    if (
      activeThreadId &&
      threadsForActiveOrg.length > 0 &&
      !threadsForActiveOrg.some((thread) => thread.id === activeThreadId)
    ) {
      setActiveThreadId(null);
      updateStoredSelections((prev) => {
        const next = { ...prev };
        delete next[activeOrganizationId];
        return next;
      });
    }
  }, [
    activeOrganizationId,
    activeThreadId,
    storedSelections,
    threadsForActiveOrg,
    threadsLoading,
    updateStoredSelections,
  ]);

  useEffect(() => {
    loadThread(activeThreadId ?? null);
  }, [activeThreadId, loadThread]);

  const handleReloadChat = useCallback(() => {
    if (!activeThreadId) return;
    invalidate(activeThreadId);
    loadThread(activeThreadId);
  }, [activeThreadId, invalidate, loadThread]);

  useEffect(() => {
    const previousThreadId = previousThreadIdRef.current;
    if (previousThreadId !== activeThreadId && sidebar.open) {
      dispatch(closeSidebar());
    }
    previousThreadIdRef.current = activeThreadId;
  }, [activeThreadId, dispatch, sidebar.open]);

  useEffect(() => {
    setOrgTransitionLoading(true);
    const timeout = setTimeout(() => setOrgTransitionLoading(false), 0);
    return () => clearTimeout(timeout);
  }, [activeOrganizationId]);

  const handleThreadSelect = useCallback(
    (thread) => {
      if (isLocked) return;
      const threadId = thread?.id ?? null;
      setActiveThreadId(threadId);
      updateStoredSelections((prev) => {
        const next = { ...prev };
        if (threadId) {
          next[activeOrganizationId] = threadId;
        } else {
          delete next[activeOrganizationId];
        }
        return next;
      });
      // Mark as read on the backend for real threads + reset local unread
      if (threadId && isRealThread(threadId)) {
        const resolvedId = resolveThreadId(threadId);
        // Try API first, if fails (401 etc.), socket thread:focus will also mark read
        markThreadRead(resolvedId).catch((err) => {
          console.warn("[markRead] API failed, relying on socket thread:focus:", err?.message);
        });
        markThreadMessagesRead(threadId);
      }
    },
    [isLocked, activeOrganizationId, updateStoredSelections, isRealThread, resolveThreadId, markThreadMessagesRead]
  );

  const handleCreateGroup = useCallback(
    async ({ name, description, members, avatar } = {}) => {
      if (!activeOrganizationId) return false;
      const trimmedName = String(name || "").trim();
      if (!trimmedName) return false;

      const baseMembers = Array.isArray(members) ? members : [];
      const memberIds = baseMembers
        .map((m) => Number(m?.user_id ?? m?.userId ?? m?.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      try {
        // Call backend to create group + members in DB
        const result = await apiCreateGroup({
          name: trimmedName,
          description: description || "",
          members: memberIds,
        });

        const groupId = result.groupId;
        const threadId = result.threadId || `group-${groupId}`;
        const now = new Date().toISOString();
        const avatarValue =
          typeof avatar === "string" && avatar.trim() ? avatar : null;

        const mapMember = (member) => ({
          id: String(member?.user_id ?? member?.userId ?? member?.id),
          name: member?.label || member?.name || member?.username || "Member",
          email: member?.email || "",
          role: "Member",
          avatar: member?.profilePicture || member?.avatar || "",
        });
        const selectedMembers = baseMembers.map(mapMember).filter((m) => m.id);
        const selfMember = {
          id: CURRENT_USER_ID,
          name: currentUserName || "You",
          email: resolvedProfile?.email || "",
          role: "Admin",
          avatar: resolvedProfile?.avatar || "",
        };
        const uniqueMembers = [
          selfMember,
          ...selectedMembers.filter((m) => String(m.id) !== CURRENT_USER_ID),
        ];

        const systemMessage = {
          id: `sys-${Date.now()}`,
          type: "system",
          message_type: "system",
          createdAt: now,
          direction: "incoming",
          metadata: {
            event: {
              action: "group_created",
              actor: { name: "You" },
              groupName: trimmedName,
              text: "You created the group",
            },
          },
          content: { text: "You created the group" },
        };

        const groupThread = {
          id: threadId,
          type: "group",
          threadType: "group",
          conversationType: "group",
          groupId,
          groupName: trimmedName,
          label: trimmedName,
          description: description || "",
          profilePicture: avatarValue,
          avatar: avatarValue,
          status: "Online",
          createdAt: now,
          created_at: now,
          lastMessageAt: now,
          preview: "You created the group",
          messageType: "system",
          readStatus: "sent",
          unreadCount: 0,
          members: uniqueMembers,
          participants: uniqueMembers.map((m) => m.email || m.name).filter(Boolean),
          createdBy: { id: CURRENT_USER_ID, name: "You" },
          isAdmin: true,
          lastMessage: systemMessage,
        };

        upsertThread(activeOrganizationId, groupThread);
        appendMessages(threadId, [systemMessage]);
        prime(threadId, [systemMessage]);
        return true;
      } catch (err) {
        console.error("[createGroup] failed:", err?.message);
        return false;
      }
    },
    [
      activeOrganizationId,
      resolvedProfile?.avatar,
      resolvedProfile?.email,
      appendMessages,
      prime,
      upsertThread,
    ]
  );

  const emitGroupSystemEvent = useCallback(
    (thread, { action, targets, text, groupName } = {}) => {
      if (!thread?.id || !action) return false;
      const now = new Date().toISOString();
      const resolvedGroupName =
        groupName || thread?.groupName || thread?.label || thread?.name;
      const actorName = "You";
      const event = {
        action,
        actor: { name: actorName },
        groupName: resolvedGroupName,
        ...(targets ? { targets } : {}),
        ...(text ? { text } : {}),
      };
      const message = {
        id: `sys-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: "system",
        message_type: "system",
        createdAt: now,
        direction: "incoming",
        metadata: {
          event,
        },
        content: {
          text: text || "",
        },
      };
      appendMessages(thread.id, [message]);
      upsertMessage(thread.id, message);
      return true;
    },
    [appendMessages, upsertMessage]
  );

  const removeActiveSelection = useCallback(
    (threadId) => {
      if (activeThreadId !== threadId) return;
      setActiveThreadId(null);
      updateStoredSelections((prev) => {
        const next = { ...prev };
        delete next[activeOrganizationId];
        return next;
      });
    },
    [activeOrganizationId, activeThreadId, updateStoredSelections]
  );

  const handleLeaveGroup = useCallback(
    async (thread) => {
      if (!thread?.id || !activeOrganizationId) return false;
      if (!isGroupThread(thread)) return false;

      const confirmed = window.confirm("Are you sure you want to leave this group?");
      if (!confirmed) return false;

      const groupId = thread.group_id || thread.id?.replace?.("group-", "");
      if (groupId) {
        try {
          const { leaveGroup: apiLeave } = await import("../../services/chatApi.js");
          await apiLeave(groupId);
        } catch (err) {
          console.warn("[leaveGroup] API:", err?.message);
        }
      }

      emitGroupSystemEvent(thread, { action: "member_left" });

      // Keep the thread in sidebar but mark as left (don't remove)
      upsertThread(activeOrganizationId, {
        id: thread.id,
        hasLeft: true,
        canChat: false,
        membershipStatus: "left",
        leftAt: new Date().toISOString(),
        unreadCount: 0,
        readStatus: "read",
      });

      invalidate(thread.id);
      dispatch(closeSidebar());
      showMessageToast("You left the group", "success");
      return true;
    },
    [
      activeOrganizationId,
      dispatch,
      emitGroupSystemEvent,
      invalidate,
      upsertThread,
      showMessageToast,
    ]
  );

  const handleDeleteGroup = useCallback(
    (thread) => {
      if (!thread?.id || !activeOrganizationId) return false;
      if (!isGroupThread(thread)) return false;
      emitGroupSystemEvent(thread, {
        action: "group_deleted",
        text: "You deleted the group",
      });
      removeThread(activeOrganizationId, thread.id, {
        removeMessages: true,
      });
      invalidate(thread.id);
      removeActiveSelection(thread.id);
      dispatch(closeSidebar());
      showMessageToast("Group deleted", "success");
      return true;
    },
    [
      activeOrganizationId,
      dispatch,
      emitGroupSystemEvent,
      invalidate,
      removeActiveSelection,
      removeThread,
      showMessageToast,
    ]
  );

  // Soft-hide a group from *this user's* chat list (local-to-user action).
  // Group + other members unaffected. Invoked only when user is already an
  // inactive member (left / kicked / banned) — see sidebar gating.
  const handleHideGroupThread = useCallback(
    async (thread) => {
      if (!thread?.id || !activeOrganizationId) return false;
      if (!isGroupThread(thread)) return false;
      const numericId = Number(String(thread.id).replace(/^group-/, ""));
      if (!numericId) return false;

      try {
        const { hideGroupThread: apiHide } = await import("../../services/chatApi.js");
        await apiHide(numericId);
      } catch (err) {
        console.warn("[hideGroupThread] API:", err?.message);
        showMessageToast("Couldn't hide chat. Please try again.", "error");
        return false;
      }

      removeThread(activeOrganizationId, thread.id, { removeMessages: true });
      invalidate(thread.id);
      removeActiveSelection(thread.id);
      dispatch(closeSidebar());
      showMessageToast("Chat deleted", "success");
      return true;
    },
    [
      activeOrganizationId,
      dispatch,
      invalidate,
      removeActiveSelection,
      removeThread,
      showMessageToast,
    ]
  );

  const activateThreadForOrg = useCallback(
    (organizationId, threadId) => {
      if (isLocked) return;
      if (!organizationId || !threadId) return;
      setActiveOrganizationId(organizationId);
      setActiveThreadId(threadId);
      updateStoredSelections((prev) => ({
        ...prev,
        [organizationId]: threadId,
      }));
    },
    [isLocked, updateStoredSelections]
  );

  const locateThreadForAuthor = useCallback(
    (author = {}, message = null) => {
      const authorId =
        author?.id ??
        message?.author?.id ??
        message?.sender_id ??
        message?.senderId ??
        message?.authorId ??
        message?.metadata?.senderId ??
        message?.metadata?.sender_id ??
        "";
      const authorName =
        author?.name ??
        message?.author?.name ??
        message?.authorName ??
        message?.sender_name ??
        message?.senderName ??
        message?.metadata?.senderName ??
        "";
      const authorEmail =
        author?.email ??
        message?.author?.email ??
        message?.sender_email ??
        message?.senderEmail ??
        message?.metadata?.senderEmail ??
        "";
      const candidates = [];
      if (authorId) {
        candidates.push(`id:${authorId}`);
      }
      const normalisedEmail = normaliseLookupValue(authorEmail);
      if (normalisedEmail) {
        candidates.push(`email:${normalisedEmail}`);
      }
      const normalisedName = normaliseLookupValue(authorName);
      if (normalisedName) {
        candidates.push(`name:${normalisedName}`);
      }
      for (const key of candidates) {
        const match = threadUserIndex.get(key);
        if (match) return match;
      }
      return null;
    },
    [threadUserIndex]
  );

  const handleUpdateGroup = useCallback(
    (thread, payload = {}) => {
      if (!thread?.id || !activeOrganizationId) return false;
      if (!isGroupThread(thread)) return false;
      const resolveMemberId = (member) =>
        member?.id ||
        member?.user_id ||
        member?.userId ||
        member?.email ||
        member?.username ||
        member?.name ||
        member?.label ||
        null;
      const previousMembers = Array.isArray(thread?.members)
        ? thread.members
        : [];
      const previousById = new Map(
        previousMembers
          .map((member) => [resolveMemberId(member), member])
          .filter(([id]) => id)
      );
      const selectedMembers = Array.isArray(payload.members)
        ? payload.members
        : previousMembers;
      const normalizedMembers = selectedMembers
        .map((member) => {
          const id = resolveMemberId(member);
          if (!id) return null;
          const prev = previousById.get(id);
          return {
            id,
            name: member?.name || member?.label || prev?.name || "Member",
            email: member?.email || prev?.email || "",
            role: prev?.role || member?.role || "Member",
            avatar:
              member?.avatar ||
              member?.profilePicture ||
              prev?.avatar ||
              prev?.profilePicture ||
              "",
          };
        })
        .filter(Boolean);
      const hasSelf = normalizedMembers.some(
        (member) => member?.id === CURRENT_USER_ID
      );
      if (!hasSelf) {
        normalizedMembers.unshift({
          id: CURRENT_USER_ID,
          name: currentUserName || "You",
          email: resolvedProfile?.email || "",
          role: "Admin",
          avatar: resolvedProfile?.avatar || "",
        });
      }
      const previousName =
        thread?.groupName || thread?.label || thread?.name || "";
      const nextName = String(payload.name || previousName).trim();
      const previousDescription =
        thread?.description || thread?.groupDescription || thread?.topic || "";
      const nextDescription =
        typeof payload.description === "string"
          ? payload.description
          : previousDescription;
      const previousAvatar =
        thread?.profilePicture || thread?.avatar || "";
      const nextAvatar =
        typeof payload.avatar === "string" ? payload.avatar : previousAvatar;
      const updatedThread = {
        ...thread,
        groupName: nextName || previousName,
        label: nextName || previousName,
        description: nextDescription,
        profilePicture: nextAvatar,
        avatar: nextAvatar,
        members: normalizedMembers,
        participants: normalizedMembers
          .map((member) => member.email || member.name)
          .filter(Boolean),
      };
      upsertThread(activeOrganizationId, updatedThread);
      const previousIds = new Set(
        previousMembers.map((member) => resolveMemberId(member)).filter(Boolean)
      );
      const nextIds = new Set(
        normalizedMembers.map((member) => resolveMemberId(member)).filter(Boolean)
      );
      if (nextName && nextName !== previousName) {
        emitGroupSystemEvent(updatedThread, {
          action: "group_renamed",
          groupName: nextName,
        });
      }
      if (nextDescription !== previousDescription) {
        emitGroupSystemEvent(updatedThread, {
          action: "group_description_updated",
        });
      }
      if (nextAvatar !== previousAvatar) {
        emitGroupSystemEvent(updatedThread, {
          action: "group_photo_updated",
          text: "You updated the group photo",
        });
      }
      const addedMembers = normalizedMembers.filter(
        (member) =>
          !previousIds.has(resolveMemberId(member)) &&
          resolveMemberId(member) !== CURRENT_USER_ID
      );
      const removedMembers = previousMembers.filter(
        (member) =>
          !nextIds.has(resolveMemberId(member)) &&
          resolveMemberId(member) !== CURRENT_USER_ID
      );
      if (addedMembers.length) {
        emitGroupSystemEvent(updatedThread, {
          action: "member_added",
          targets: addedMembers.map((member) => member.name || "Member"),
        });
      }
      if (removedMembers.length) {
        emitGroupSystemEvent(updatedThread, {
          action: "member_removed",
          targets: removedMembers.map((member) => member.name || "Member"),
        });
      }
      return true;
    },
    [
      activeOrganizationId,
      currentUserName,
      emitGroupSystemEvent,
      resolvedProfile?.avatar,
      resolvedProfile?.email,
      upsertThread,
    ]
  );

  const handleMemberDirectMessage = useCallback(
    (member) => {
      const match = locateThreadForAuthor(member || {}, null);
      if (!match?.thread?.id || !match?.orgId) {
        showMessageToast("Direct message not available", "info");
        return;
      }
      activateThreadForOrg(match.orgId, match.thread.id);
    },
    [activateThreadForOrg, locateThreadForAuthor, showMessageToast]
  );

  const handleMemberViewProfile = useCallback(
    (member) => {
      const match = locateThreadForAuthor(member || {}, null);
      if (!match?.thread?.id || !match?.orgId) {
        showMessageToast("Profile not available", "info");
        return;
      }
      activateThreadForOrg(match.orgId, match.thread.id);
      dispatch(openSidebar());
    },
    [
      activateThreadForOrg,
      dispatch,
      locateThreadForAuthor,
      showMessageToast,
    ]
  );


  const handleAuthorAction = useCallback(
    (actionKey, message, { author } = {}) => {
      if (!actionKey) return;
      const match = locateThreadForAuthor(author, message);
      if (!match?.thread?.id || !match?.orgId) {
        showMessageToast(
          "You do not have permission to view this profile",
          "warning"
        );
        return;
      }
      if (actionKey === "send-dm") {
        activateThreadForOrg(match.orgId, match.thread.id);
      }
    },
    [
      activateThreadForOrg,
      locateThreadForAuthor,
      showMessageToast,
    ]
  );

  const handleOrganizationChange = useCallback(
    (organizationId) => {
      setActiveOrganizationId(organizationId);
      const storedId = storedSelections[organizationId];
      setActiveThreadId(storedId ?? null);
    },
    [storedSelections]
  );

  const handleExternalAttachmentsConsumed = useCallback((threadId) => {
    if (!threadId) return;
    setPendingAttachmentDrops((prev) => {
      if (!prev[threadId] || prev[threadId].length === 0) {
        return prev;
      }
      const next = { ...prev };
      delete next[threadId];
      return next;
    });
  }, []);

  const handleThreadDropFiles = useCallback(
    (thread, files) => {
      if (!thread?.id) return;
      const normalizedFiles = normalizeAttachmentList(files);
      if (!normalizedFiles.length) return;
      handleExternalThreadIntent({
        threadId: thread.id,
        organizationId: activeOrganizationId,
        attachments: normalizedFiles,
      });
    },
    [activeOrganizationId, handleExternalThreadIntent]
  );

  const handleComposerSend = useCallback(
    (targetThreadId, outgoingMessages, { baseThread = null } = {}) => {
      if (
        !targetThreadId ||
        !Array.isArray(outgoingMessages) ||
        outgoingMessages.length === 0
      ) {
        return;
      }
      // Clear smart replies when user sends a message
      setSmartReplies([]);
      const preparedMessages = outgoingMessages.map((message) => {
        if (
          message?.direction?.toLowerCase?.() === "outgoing" &&
          !message.status
        ) {
          return { ...message, status: "queued" };
        }
        return message;
      });
      appendMessages?.(targetThreadId, preparedMessages);
      const effectiveBase =
        baseThread || (activeThread?.id === targetThreadId ? activeThread : null);
      preparedMessages.forEach((message) => {
        upsertMessage(targetThreadId, message);
        updateThreadPreviewMeta(targetThreadId, message, effectiveBase);
        if (message?.direction?.toLowerCase?.() === "outgoing") {
          // For real API threads, also send to backend
          if (isRealThread(targetThreadId)) {
            const socketThreadId = resolveThreadId(targetThreadId);

            // Intercept scheduled messages — route to schedule emitter instead of send
            if (message?.metadata?.scheduled && message?.metadata?.sendAt) {
              const text = message?.content?.text ?? message?.message ?? "";
              chatSocket.scheduleMessage(socketThreadId, text, message?.type ?? "text", null, message.metadata.sendAt)
                .catch((err) => console.error("[schedule] failed:", err));
              return; // Don't send immediately
            }

            const isFileMsg = ["file", "image", "video"].includes(message?.type);
            const rawFile = message?.__file;

            const sendViaSocket = (meta) => {
              const text = message?.content?.text ?? message?.message ?? "";
              const msgType = message?.type ?? "text";
              const socketMeta = meta || { ...message?.content };
              delete socketMeta.text;
              // Merge replyTo from message.metadata so receiver sees quoted message
              if (message?.metadata?.replyTo && !socketMeta.replyTo) {
                socketMeta.replyTo = message.metadata.replyTo;
              }
              // Merge forwarded flags so backend persists forwarded status
              if (message?.metadata?.forwarded) {
                socketMeta.forwarded = true;
                if (message.metadata.forwardedBy) socketMeta.forwardedBy = message.metadata.forwardedBy;
                if (message.metadata.forwardedFrom) socketMeta.forwardedFrom = message.metadata.forwardedFrom;
                if (message.metadata.forwardedAt) socketMeta.forwardedAt = message.metadata.forwardedAt;
              }
              return chatSocket.sendMessage(
                socketThreadId, text, msgType,
                Object.keys(socketMeta).length ? socketMeta : null
              ).then((res) => {
                const serverMsg = res?.message;
                const serverId = serverMsg?.id;
                const serverStatus = serverMsg?.status || "delivered";
                // Replace local UUID with server DB ID so recall/react/edit work
                if (serverId && serverId !== message.id) {
                  removeMessageFromCache(targetThreadId, message.id);
                  upsertMessage(targetThreadId, { ...message, ...serverMsg, id: serverId, status: serverStatus });
                } else {
                  upsertMessage(targetThreadId, { ...message, status: serverStatus });
                }
                // Update thread list tick (single/double/green)
                if (activeOrganizationId) {
                  upsertThread(activeOrganizationId, {
                    id: targetThreadId,
                    lastMessageStatus: serverStatus,
                    lastMessageDirection: 'outgoing',
                  });
                }
              }).catch((err) => {
                console.warn("[send]", err);
                upsertMessage(targetThreadId, { ...message, status: "error" });
                // Queue for offline retry
                try {
                  const q = JSON.parse(localStorage.getItem('offline_queue') || '[]');
                  q.push({ threadId: targetThreadId, message: { ...message, status: 'queued' }, _queuedAt: Date.now() });
                  localStorage.setItem('offline_queue', JSON.stringify(q.slice(-50)));
                } catch {}
              });
            };

            if (isFileMsg && rawFile) {
              // Upload file to S3 first with progress, then send URL via socket
              const uploadId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              // Store mapping so S3 progress socket events can update the right message
              window.__pendingUploads = window.__pendingUploads || new Map();
              window.__pendingUploads.set(uploadId, { threadId: targetThreadId, message });

              upsertMessage(targetThreadId, {
                ...message, status: "uploading",
                metadata: { ...(message.metadata || {}), uploadState: "uploading", uploadProgress: 0, uploadPhase: "server" },
              });
              let _lastProgress = -1;
              uploadChatFileWithProgress(rawFile, {
                uploadId,
                onProgress: (percent) => {
                  // Phase 1: Browser → Backend (0-50%) — throttle to every 5%
                  const scaled = Math.round(percent * 0.5);
                  if (scaled - _lastProgress < 5 && scaled < 50) return;
                  _lastProgress = scaled;
                  upsertMessage(targetThreadId, {
                    ...message,
                    status: "uploading",
                    metadata: { ...(message.metadata || {}), uploadState: "uploading", uploadProgress: scaled, uploadPhase: "server" },
                  });
                },
              }).then((uploaded) => {
                // Clean up tracking
                window.__pendingUploads?.delete(uploadId);
                // Replace data URL with S3 URL in content
                const updatedContent = { ...message.content };
                if (updatedContent.url) updatedContent.url = uploaded.file_url;
                if (updatedContent.fileUrl) updatedContent.fileUrl = uploaded.file_url;
                if (updatedContent.files) {
                  updatedContent.files = updatedContent.files.map((f) => ({
                    ...f, url: uploaded.file_url, fileUrl: uploaded.file_url,
                  }));
                }
                updatedContent.fileName = uploaded.file_name;
                updatedContent.fileSize = uploaded.file_size;
                updatedContent.fileKey = uploaded.file_key;

                const meta = {
                  ...updatedContent,
                  fileName: uploaded.file_name,
                  fileUrl: uploaded.file_url,
                  fileKey: uploaded.file_key,
                  fileType: uploaded.file_type,
                  fileSize: uploaded.file_size,
                };
                delete meta.text;

                // Update local message with S3 URL — drop raw File to free memory
                const { __file: _dropped, ...cleanMessage } = message;
                upsertMessage(targetThreadId, {
                  ...cleanMessage, content: updatedContent, status: "sending",
                  metadata: { ...(cleanMessage.metadata || {}), uploadState: "done", uploadProgress: 100 },
                });

                return sendViaSocket(meta);
              }).catch((err) => {
                window.__pendingUploads?.delete(uploadId);
                console.warn("[upload]", err);
                upsertMessage(targetThreadId, {
                  ...message, status: "error",
                  metadata: { ...(message.metadata || {}), uploadState: "error", uploadError: err.message },
                });
              });
            } else {
              // Text/emoji/code/link — send directly via socket
              sendViaSocket();
            }
          } else {
            scheduleDeliveryLifecycle(targetThreadId, message, {
              baseThread: effectiveBase,
            });
          }
        }
      });
      if (activeThread?.id === targetThreadId) {
        setScrollSignal((prev) => prev + 1);
      }
    },
    [
      activeThread,
      appendMessages,
      scheduleDeliveryLifecycle,
      setScrollSignal,
      updateThreadPreviewMeta,
      upsertMessage,
      isRealThread,
    ]
  );

  const renderSidebarContent = () => (
    <ConversationInfoSidebar
      open={sidebar.open}
      thread={activeThread}
      messages={conversationMessages}
      onClose={closeInfoSidebar}
      onLeaveGroup={(thread) =>
        setThreadActionConfirm({ open: true, type: "leave", thread, busy: false })
      }
      onDeleteGroup={(thread) =>
        setThreadActionConfirm({ open: true, type: "delete-group", thread, busy: false })
      }
      onHideGroupThread={(thread) =>
        setThreadActionConfirm({ open: true, type: "hide", thread, busy: false })
      }
      onGroupEvent={emitGroupSystemEvent}
      onMemberViewProfile={handleMemberViewProfile}
      onMemberDirectMessage={handleMemberDirectMessage}
      onUpdateGroup={handleUpdateGroup}
      availableMembers={selectableMembers}
      commonGroups={commonGroups}
      onOpenGroup={handleThreadSelect}
      activeThreadId={activeThreadId}
      width={SIDEBAR_WIDTH}
      order={chatListRightAligned ? -1 : 3}
    />
  );

  const hasActiveThread = Boolean(activeThreadId);
  const conversationLoading =
    hasActiveThread &&
    (conversationState.loading ||
      conversationState.threadId !== activeThreadId);

  const conversationMessages =
    conversationState.threadId === activeThreadId
      ? conversationState.messages
      : [];
  const selectionHasPoll = useMemo(() => {
    if (!selectionActive || !multiCopyState.selected.size) return false;
    return conversationMessages.some(
      (message) =>
        multiCopyState.selected.has(message.id) && message.type === "poll"
    );
  }, [conversationMessages, multiCopyState.selected, selectionActive]);

  useEffect(() => {
    if (!activeThreadId || !conversationMessages.length) {
      return;
    }
    const lastMessage = conversationMessages[conversationMessages.length - 1];
    if (!lastMessage?.id) return;
    const cache = lastPreviewMessageRef.current;
    const cachedId = cache.get(activeThreadId);
    if (cachedId === lastMessage.id) {
      return;
    }
    cache.set(activeThreadId, lastMessage.id);
    updateThreadPreviewMeta(activeThreadId, lastMessage, activeThread);
  }, [
    activeThreadId,
    conversationMessages,
    activeThread,
    updateThreadPreviewMeta,
  ]);
  
  const handleCopyMessage = useCallback(
    async (targetMessage) => {
      if (!targetMessage) return;
      if (canCopyImageMessage(targetMessage)) {
        const source = getImageCopySource(targetMessage);
        if (!source) return;
        try {
          await copyImageSourceToClipboard(source);
        } catch {
          // silent fail
        }
        return;
      }
      const text = getMessagePlainText(targetMessage);
      if (!text) return;
      try {
        await copyTextToClipboard(text);
      } catch {
        // silent fail
      }
    },
    []
  );

  const exitMultiCopyMode = useCallback(() => {
    setMultiCopyState({ active: false, threadId: null, selected: new Set() });
  }, []);

  const beginMultiCopyMode = useCallback((threadId, seedMessage) => {
    if (!threadId) return;
    setMultiCopyState((prev) => {
      const nextSelected =
        prev.active && prev.threadId === threadId
          ? new Set(prev.selected)
          : new Set();
      if (seedMessage?.id) {
        nextSelected.add(seedMessage.id);
      }
      return {
        active: true,
        threadId,
        selected: nextSelected,
      };
    });
  }, []);

  const handleToggleMultiCopySelection = useCallback(
    (message, checked) => {
      if (!message?.id) return;
      setMultiCopyState((prev) => {
        if (!prev.active || prev.threadId !== activeThreadId) return prev;
        const nextSelected = new Set(prev.selected);
        if (checked) {
          nextSelected.add(message.id);
        } else {
          nextSelected.delete(message.id);
        }
        return {
          ...prev,
          selected: nextSelected,
        };
      });
    },
    [activeThreadId]
  );

  const handleMultiCopyConfirm = useCallback(async () => {
    if (
      !multiCopyState.active ||
      !multiCopyState.threadId ||
      multiCopyState.threadId !== activeThreadId
    ) {
      exitMultiCopyMode();
      return;
    }
    if (!multiCopyState.selected.size) {
      showMessageToast("Select at least one message", "info");
      return;
    }
    const selectedMessages = conversationMessages.filter((message) =>
      multiCopyState.selected.has(message.id)
    );
    if (!selectedMessages.length) {
      showMessageToast("Nothing to copy", "info");
      return;
    }
    const sortedMessages = [...selectedMessages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const combined = sortedMessages
      .map((msg) => getMessagePlainText(msg))
      .filter((text) => Boolean(text))
      .join("\n");
    if (!combined.trim()) {
      showMessageToast("Nothing to copy", "info");
      return;
    }
    const success = await copyTextToClipboard(combined);
    showMessageToast(
      success ? "Messages copied" : "Unable to copy messages",
      success ? "success" : "error"
    );
    if (success) {
      exitMultiCopyMode();
    }
  }, [
    activeThreadId,
    conversationMessages,
    exitMultiCopyMode,
    multiCopyState,
    showMessageToast,
  ]);

  const handleSelectionForward = useCallback(() => {
    if (
      !multiCopyState.active ||
      !multiCopyState.threadId ||
      multiCopyState.threadId !== activeThreadId
    ) {
      exitMultiCopyMode();
      return;
    }
    const selectedMessages = conversationMessages.filter((message) =>
      multiCopyState.selected.has(message.id)
    );
    if (!selectedMessages.length) {
      showMessageToast("Select at least one message", "info");
      return;
    }
    openForwardDialog(selectedMessages, {
      threadId: activeThreadId,
      fromSelection: true,
    });
  }, [
    activeThreadId,
    conversationMessages,
    multiCopyState,
    openForwardDialog,
    showMessageToast,
  ]);

  const handleSelectionDelete = useCallback(() => {
    if (
      !multiCopyState.active ||
      !multiCopyState.threadId ||
      multiCopyState.threadId !== activeThreadId
    ) {
      exitMultiCopyMode();
      return;
    }
    const selectedMessages = conversationMessages.filter((message) =>
      multiCopyState.selected.has(message.id)
    );
    if (!selectedMessages.length) {
      showMessageToast("Select at least one message", "info");
      return;
    }
    selectedMessages.forEach((message) => {
      performMessageRemoval("delete", activeThreadId, message);
    });
    showMessageToast(
      selectedMessages.length === 1
        ? "Message deleted"
        : `${selectedMessages.length} messages deleted`,
      "success"
    );
    exitMultiCopyMode();
  }, [
    activeThreadId,
    conversationMessages,
    exitMultiCopyMode,
    multiCopyState,
    performMessageRemoval,
    showMessageToast,
  ]);

  const forwardingRef = useRef(false);
  const handleForwardSubmit = useCallback(
    (targetThreadIds) => {
      // Prevent double-submit (forward button clicked twice)
      if (forwardingRef.current) return;
      forwardingRef.current = true;
      setTimeout(() => { forwardingRef.current = false; }, 2000);

      const uniqueTargets = Array.from(
        new Set((targetThreadIds || []).filter(Boolean))
      );
      if (!forwardState.messages.length || !uniqueTargets.length) {
        showMessageToast("Select at least one chat", "info");
        forwardingRef.current = false;
        return;
      }
      const agentProfileSnapshot = threadService.agentProfile ?? {};
      const senderId = agentProfileSnapshot.id ?? CURRENT_USER_ID;
      const senderName =
        agentProfileSnapshot.displayName ??
        agentProfileSnapshot.fullName ??
        agentProfileSnapshot.username ??
        "You";
      const senderAvatar = agentProfileSnapshot.avatar ?? null;
      const deviceLabel = detectDeviceLabel();
      const sourceLabel = threadDirectory.get(
        forwardState.sourceThreadId ?? ""
      )?.label;
      const payloadsByThread = new Map();
      uniqueTargets.forEach((threadId) => {
        const targetThread = threadDirectory.get(threadId);
        if (!targetThread) return;
        const receiverId =
          targetThread.user_id ??
          targetThread.id ??
          targetThread.threadId ??
          targetThread.channelId ??
          threadId;
        const receiverName =
          targetThread.label ??
          targetThread.fullName ??
          targetThread.username ??
          targetThread.contact?.name ??
          "Conversation";
        const outgoingMessages = forwardState.messages.map((message) => {
          const normalized = message.__normalized
            ? message
            : normalizeMessage(message);
          const cloned = cloneMessagePayload(normalized) || { ...normalized };
          const timestamp = new Date().toISOString();
          const previouslyForwarded =
            normalized?.metadata?.forwarded ||
            normalized?.metadata?.forwardedFrom ||
            normalized?.metadata?.forwardedLabel;
          const isSelfAuthored =
            !previouslyForwarded && isOwnMessage(normalized, senderId);
          const shouldMarkForwarded =
            Boolean(previouslyForwarded) || !isSelfAuthored;
          const metadata = sanitizeForwardMetadata(cloned.metadata);
          if (shouldMarkForwarded) {
            metadata.forwarded = true;
            metadata.forwardedFrom = deriveForwardedFromLabel(
              normalized,
              sourceLabel
            );
            metadata.forwardedBy = senderName;
            metadata.forwardedAt = timestamp;
          } else {
            delete metadata.forwarded;
            delete metadata.forwardedFrom;
            delete metadata.forwardedBy;
            delete metadata.forwardedAt;
          }
          cloned.id = createForwardMessageId();
          cloned.createdAt = timestamp;
          cloned.updatedAt = timestamp;
          cloned.direction = "outgoing";
          cloned.status = "sent";
          cloned.author = {
            id: senderId,
            name: senderName,
            avatar: senderAvatar,
          };
          cloned.sender_id = senderId;
          cloned.sender_name = senderName;
          cloned.receiver_id = receiverId;
          cloned.receiver_name = receiverName;
          cloned.device_sender = deviceLabel;
          cloned.metadata = metadata;
          cloned.message_type = cloned.message_type || cloned.type;
          delete cloned.__normalized;
          return cloned;
        });
        if (outgoingMessages.length) {
          payloadsByThread.set(threadId, outgoingMessages);
        }
      });
      if (!payloadsByThread.size) {
        showMessageToast("Unable to forward message", "error");
        return;
      }
      payloadsByThread.forEach((messages, threadId) => {
        const targetThread = threadDirectory.get(threadId) ?? null;
        messages.forEach((message) => {
          updateThreadPreviewMeta(threadId, message, targetThread);
        });
        handleComposerSend(threadId, messages, { baseThread: targetThread });
      });
      showMessageToast(
        forwardState.messages.length === 1
          ? `Message forwarded to ${uniqueTargets.length} chat${
              uniqueTargets.length > 1 ? "s" : ""
            }`
          : `${forwardState.messages.length} messages forwarded`,
        "success"
      );
      closeForwardDialog();
      if (forwardState.fromSelection) {
        exitMultiCopyMode();
      }
    },
    [
      forwardState,
      showMessageToast,
      threadDirectory,
      handleComposerSend,
      closeForwardDialog,
      exitMultiCopyMode,
    ]
  );

  const activeThreadHasMore =
    activeThreadId && threadWindowMeta[activeThreadId]
      ? threadWindowMeta[activeThreadId].hasMore
      : false;
  const externalAttachmentsForActiveThread =
    (activeThreadId && pendingAttachmentDrops[activeThreadId]) || [];

  const handleComposerEditSubmit = useCallback(
    ({
      threadId: targetThreadId,
      messageId,
      value,
      fieldPath,
      message: baseMessage,
    }) => {
      if (!targetThreadId || !messageId) return;
      const sourceMessage =
        baseMessage ||
        conversationMessages.find((item) => item.id === messageId);
      if (!sourceMessage) return;
      const updated = updateEditableMessageValue(
        sourceMessage,
        value,
        fieldPath
      );
      if (!updated) return;
      upsertMessage(targetThreadId, updated);
      patchMessage?.(targetThreadId, updated);
      // Send edit to backend via socket
      if (isRealThread(targetThreadId)) {
        const newText = updated?.content?.text ?? value ?? "";
        chatSocket.editMessage(messageId, targetThreadId, newText);
      }
      setEditingReference(null);
    },
    [conversationMessages, patchMessage, setEditingReference, upsertMessage, chatSocket, isRealThread]
  );

  const handlePollEditSubmit = useCallback(
    ({ threadId: targetThreadId, messageId, poll, message: baseMessage }) => {
      if (!targetThreadId || !messageId || !poll) return;
      const sourceMessage =
        baseMessage ||
        conversationMessages.find((item) => item.id === messageId);
      if (!sourceMessage) return;
      const existingOptions = Array.isArray(sourceMessage.content?.options)
        ? sourceMessage.content.options
        : [];
      const mergedOptions = Array.isArray(poll.options)
        ? poll.options.map((option) => {
            const existing = existingOptions.find(
              (entry) => entry.id === option.id
            );
            return existing
              ? { ...existing, label: option.label }
              : { ...option, votes: 0, voters: [] };
          })
        : [];
      const updatedPoll = {
        ...(sourceMessage.content || {}),
        ...poll,
        options: mergedOptions,
        voterAvatars:
          poll.voterAvatars ?? sourceMessage.content?.voterAvatars ?? [],
      };
      const updated = {
        ...sourceMessage,
        content: updatedPoll,
        metadata: {
          ...(sourceMessage.metadata || {}),
          editedAt: new Date().toISOString(),
        },
      };
      upsertMessage(targetThreadId, updated);
      patchMessage?.(targetThreadId, updated);
      // Persist poll edit to backend via socket
      if (isRealThread(targetThreadId)) {
        chatSocket.editPoll(messageId, targetThreadId, updatedPoll);
      }
      setPollEditingReference(null);
    },
    [conversationMessages, patchMessage, upsertMessage, chatSocket, isRealThread]
  );

  const handleMessageAction = useCallback(
    (actionKey, message, context = {}) => {
      if (!message) return;
      const targetThreadId = context.threadId ?? activeThreadId;
      if (!targetThreadId) return;
      if (actionKey === "copy") {
        void handleCopyMessage(message);
        return;
      }
      if (actionKey === "info") {
        setMessageInfoState((prev) => ({
          open: true,
          message,
          threadId: targetThreadId,
          version: prev.version + 1,
        }));
        return;
      }
      if (actionKey === "select") {
        beginMultiCopyMode(targetThreadId, message);
        return;
      }
      if (
        (actionKey === "edit" || actionKey === "poll-edit") &&
        message.type === "poll"
      ) {
        clearReplyReference();
        clearEditingReference();
        setPollEditingReference({
          threadId: targetThreadId,
          message,
          messageId: message.id,
        });
        return;
      }
      if (actionKey === "edit") {
        if (!canEditMessage(message)) {
          showMessageToast("Edit window expired", "info");
          return;
        }
        const editable = getEditableField(message);
        if (!editable) return;
        clearReplyReference();
        setEditingReference({
          threadId: targetThreadId,
          message,
          messageId: message.id,
          fieldPath: editable.path,
          initialValue: editable.value || "",
          sessionId: `${message.id}-${Date.now()}`,
          context: {
            label:
              editable.path === "content.caption"
                ? "Editing caption"
                : "Editing message",
            snippet: editable.value || "",
          },
        });
        return;
      }
      if (actionKey === "delete" || actionKey === "unsend") {
        setActionDialog({
          open: true,
          type: actionKey,
          message,
          threadId: targetThreadId,
        });
        return;
      }
      if (actionKey === "react") {
        const emoji = context.emoji;
        if (!emoji) return;
        const updatedMessage = toggleReactionOnMessage(message, {
          emoji,
          userId: CURRENT_USER_ID,
          userName: currentUserName,
        });
        upsertMessage(targetThreadId, updatedMessage);
        patchMessage?.(targetThreadId, updatedMessage);
        if (isRealThread(targetThreadId)) {
          chatSocket.reactToMessage(message.id, targetThreadId, emoji);
        }
        return;
      }
      if (actionKey === "translate") {
        const text = getMessagePlainText(message);
        if (!text) { showMessageToast("Nothing to translate", "info"); return; }
        setTranslateDialogState({ open: true, message, threadId: targetThreadId });
        return;
      }
      if (actionKey === "summarize") {
        setSummarizeDialogState({ open: true, message });
        return;
      }
      if (actionKey === "tone-adjust") {
        const text = getMessagePlainText(message);
        if (!text) { showMessageToast("Nothing to adjust", "info"); return; }
        setToneAdjustDialogState({ open: true, message });
        return;
      }
      if (actionKey === "reply") {
        clearEditingReference();
        const replyPayload = buildReplyContextPayload(
          message,
          CURRENT_USER_ID
        );
        if (replyPayload) {
          setReplyReference({
            threadId: targetThreadId,
            context: replyPayload,
          });
          // Trigger AI smart suggestions for the message being replied to
          const replyText = getMessagePlainText(message);
          if (replyText && replyText.length >= 2) {
            fetchSmartReplies(replyText, { senderName: message?.author?.name || '' })
              .then((suggestions) => setSmartReplies(suggestions || []))
              .catch(() => setSmartReplies([]));
          }
        }
        return;
      }
      if (actionKey === "pin") {
        const viewerPinned =
          message?.metadata?.pinned &&
          message?.metadata?.pinnedBy === CURRENT_USER_ID;
        const newPinned = !viewerPinned;
        const updatedMessage = {
          ...message,
          metadata: {
            ...message.metadata,
            pinned: newPinned,
            pinnedBy: newPinned ? CURRENT_USER_ID : null,
            pinnedAt: newPinned ? new Date().toISOString() : null,
          },
        };
        upsertMessage(targetThreadId, updatedMessage);
        patchMessage?.(targetThreadId, updatedMessage);
        // Persist to backend via socket so pin survives reload
        if (isRealThread(targetThreadId)) {
          chatSocket.pinMessage(message.id, targetThreadId, newPinned);
        }
        return;
      }
      if (actionKey === "poll-vote") {
        if (isRealThread(targetThreadId)) {
          chatSocket.votePoll(message.id, targetThreadId, context.optionId, context.pollType);
        }
        return;
      }
      if (actionKey === "poll-end") {
        if (isRealThread(targetThreadId)) {
          chatSocket.endPoll(message.id, targetThreadId, context.endedAt);
        }
        return;
      }
      if (actionKey === "forward") {
        if (message.type === "poll") {
          showMessageToast("Polls cannot be forwarded", "info");
          return;
        }
        openForwardDialog([message], { threadId: targetThreadId });
        return;
      }
      console.log("Message action", actionKey, message, context);
    },
    [
      activeThreadId,
      beginMultiCopyMode,
      clearEditingReference,
      chatSocket,
      clearReplyReference,
      currentUserName,
      handleCopyMessage,
      isRealThread,
      patchMessage,
      setPollEditingReference,
      setEditingReference,
      setReplyReference,
      showMessageToast,
      upsertMessage,
      openForwardDialog,
    ]
  );

  return (
    <>
      <Box
        sx={{
          position: "relative",
          flexGrow: 1,
          width: "100%",
          height: "100%",
        }}
      >
        <Stack
          direction={chatListRightAligned ? "row-reverse" : "row"}
          sx={{
            width: "100%",
            height: "100%",
            bgcolor: theme.palette.background.default,
          }}
        >
          <Box
            sx={{
              width: 350,
              height: "100%",
              ...(chatListRightAligned
                ? { borderLeft: `1px solid ${theme.palette.divider}` }
                : { borderRight: `1px solid ${theme.palette.divider}` }),
              bgcolor: theme.palette.background.paper,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              pt: 1,
              position: "relative",
            }}
          >
            {/* Render organization tabs only when more than one organization is available */}
            {hasMultipleOrganizations ? (
              <Box px={1}>
                <OrganizationTabs
                  organizations={organizations}
                  activeOrganizationId={activeOrganizationId}
                  onChange={handleOrganizationChange}
                />
              </Box>
            ) : null}

            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
              <ChatList
                threads={threadsForActiveOrg}
                activeThreadId={activeThreadId}
                onSelect={handleThreadSelect}
                loading={threadsLoading}
                isLocked={isLocked}
                onDropFiles={handleThreadDropFiles}
                isThreadMuted={isThreadMuted}
                onMuteThread={muteThread}
                onUnmuteThread={unmuteThread}
                pinnedThreads={pinnedThreads}
                onPinThread={(tid, pinned) => chatSocket?.pinThread?.(tid, pinned)}
              />
            </Box>
            <ChatListActionsMenu
              members={selectableMembers}
              currentUser={{
                id: CURRENT_USER_ID,
                name: currentUserName,
                label: "You",
                email: resolvedProfile?.email || "",
                avatar: resolvedProfile?.avatar || "",
              }}
              organizationId={activeOrganizationId}
              threads={threadsForActiveOrg}
              disabled={isLocked || threadsLoading}
              onCreateGroup={handleCreateGroup}
            />
          </Box>

          <Box
            sx={{
              flexGrow: 1,
              height: "100%",
              position: "relative",
              bgcolor: theme.palette.background.default,
              display: "flex",
              flexDirection: "column",
              width: sidebar.open
                ? `calc(100% - 430px - ${SIDEBAR_WIDTH}px)`
                : "calc(100% - 430px)",
              transition: theme.transitions.create("width", {
                duration: theme.transitions.duration.standard,
                easing: theme.transitions.easing.easeInOut,
              }),
            }}
          >
            <Box
              sx={{
                flexGrow: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {isLocked ? (
                <Stack
                  spacing={2}
                  alignItems="center"
                  justifyContent="center"
                  textAlign="center"
                  sx={{ flexGrow: 1, px: 6 }}
                >
                  <Box
                    sx={{
                      width: 96,
                      height: 96,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        theme.palette.mode === "light"
                          ? "rgba(0,0,0,0.06)"
                          : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <FaUserLock color={theme.palette.text.primary} size={42} />
                  </Box>
                  <Typography
                    variant="h5"
                    color={theme.palette.text.primary}
                    sx={{ fontWeight: 700 }}
                  >
                    Conversations locked
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ maxWidth: 360 }}
                  >
                    Unlock with your 4-digit PIN to continue viewing and sending
                    messages.
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<PiLockKeyOpen size={18} />}
                    onClick={openUnlockDialog}
                    sx={{ borderRadius: 999 }}
                  >
                    Unlock chat
                  </Button>
                </Stack>
              ) : activeThread ? (
                <>
                  <ConversationHeader
                    thread={activeThread}
                    selectionActive={selectionActive}
                    selectionCount={selectionCount}
                    selectionForwardDisabled={selectionHasPoll}
                    onSelectionCopy={handleMultiCopyConfirm}
                    onSelectionForward={handleSelectionForward}
                    onSelectionDelete={handleSelectionDelete}
                    onSelectionCancel={exitMultiCopyMode}
                    onSearchToggle={() => setSearchOpen((prev) => !prev)}
                    searchOpen={searchOpen}
                    onReloadChat={handleReloadChat}
                    isMuted={isThreadMuted(activeThread?.id)}
                    onMenuAction={handleHeaderMenuAction}
                  />
                  <Box
                    data-conversation-overlay-root="true"
                    sx={{
                      flexGrow: 1,
                      display: "flex",
                      flexDirection: "column",
                      position: "relative"
                    }}
                  >
                    <ConversationMessage
                      thread={activeThread}
                      messages={conversationMessages}
                      loading={conversationLoading}
                      currentUserId={CURRENT_USER_ID}
                      onAction={handleMessageAction}
                      onAuthorAction={handleAuthorAction}
                      wallpaper={wallpaperSelection?.url}
                      scrollSignal={scrollSignal}
                      fetchPreviousMessages={fetchOlderMessages}
                      initialRemoteHasMore={activeThreadHasMore}
                      multiCopyState={multiCopyState}
                      onMultiCopyToggle={handleToggleMultiCopySelection}
                      searchOpen={searchOpen}
                      onSearchClose={() => setSearchOpen(false)}
                    />
                    {(() => {
                      const status = String(activeThread?.membershipStatus || "").toLowerCase();
                      const planExpired = Boolean(
                        currentUser?.planExpired ||
                          currentUser?.subscription_status === "expired" ||
                          currentUser?.plan_status === "expired" ||
                          activeThread?.planExpired
                      );
                      let reason = null;
                      if (status === "kicked" || status === "removed") reason = "You were removed from this group";
                      else if (status === "banned") reason = "You were banned from this group";
                      else if (activeThread?.hasLeft || status === "left") reason = "You left this group — you can't send messages here";
                      else if (activeThread?.is_airtime && activeThread?.canChat === false) reason = "Only admins can send messages in this group";
                      else if (planExpired) reason = "Your plan has expired — renew to continue messaging";
                      else if (activeThread?.canChat === false) reason = "You can't send messages here";

                      const readOnly = Boolean(reason);
                      return (
                        <ConversationFooter
                          threadId={activeThread?.id}
                          thread={activeThread}
                          externalAttachments={externalAttachmentsForActiveThread}
                          onExternalAttachmentsHandled={
                            handleExternalAttachmentsConsumed
                          }
                          onSendMessages={handleComposerSend}
                          replyReference={
                            replyReference?.threadId === activeThreadId
                              ? replyReference
                              : null
                          }
                          onCancelReply={clearReplyReference}
                          editingReference={
                            editingReference?.threadId === activeThreadId
                              ? editingReference
                              : null
                          }
                          onCancelEdit={clearEditingReference}
                          onSubmitEdit={handleComposerEditSubmit}
                          pollEditingReference={
                            pollEditingReference?.threadId === activeThreadId
                              ? pollEditingReference
                              : null
                          }
                          onCancelPollEdit={clearPollEditingReference}
                          onSubmitPollEdit={handlePollEditSubmit}
                          onTypingStart={handleTypingStart}
                          onTypingStop={handleTypingStop}
                          smartReplies={smartReplies}
                          onSmartRepliesDismiss={() => setSmartReplies([])}
                          placeholderOverride={reason}
                          inputReadOnly={readOnly}
                        />
                      );
                    })()}
                    <Suspense fallback={null}>
                      {messageInfoState.open && messageInfoState.message && (
                        <MessageInfoOverlay
                          key={messageInfoState.version}
                          open
                          message={messageInfoState.message}
                          thread={infoOverlayThread || activeThread || {}}
                          currentUserId={CURRENT_USER_ID}
                          onClose={handleCloseMessageInfo}
                        />
                      )}
                      {forwardState.open && (
                        <ForwardMessageDialog
                          open
                          threads={threadsForActiveOrg}
                          pendingMessageCount={forwardState.messages.length || 0}
                          onClose={closeForwardDialog}
                          onSubmit={handleForwardSubmit}
                        />
                      )}
                      {translateDialogState.open && (
                        <TranslateDialog
                          open
                          message={translateDialogState.message}
                          onClose={() => setTranslateDialogState({ open: false, message: null, threadId: null })}
                          onTranslated={({ language, translated }) => {
                            if (!translateDialogState.message || !translateDialogState.threadId) return;
                            const updated = {
                              ...translateDialogState.message,
                              content: {
                                ...(translateDialogState.message.content || {}),
                                translatedText: translated,
                                translatedLang: language,
                              },
                            };
                            upsertMessage(translateDialogState.threadId, updated);
                            patchMessage?.(translateDialogState.threadId, updated);
                          }}
                        />
                      )}
                      {summarizeDialogState.open && (
                        <SummarizeDialog
                          open
                          message={summarizeDialogState.message}
                          onClose={() => setSummarizeDialogState({ open: false, message: null })}
                        />
                      )}
                      {toneAdjustDialogState.open && (
                        <ToneAdjusterDialog
                          open
                          messageText={getMessagePlainText(toneAdjustDialogState.message) || ""}
                          onClose={() => setToneAdjustDialogState({ open: false, message: null })}
                        />
                      )}
                      {soundPickerState.open && (
                        <ThreadSoundPicker
                          open
                          onClose={() => setSoundPickerState({ open: false, threadId: null })}
                          onSelect={handleSoundPickerSelect}
                        />
                      )}
                      {disappearDialogState.open && (
                        <DisappearingMessagesDialog
                          open
                          onClose={() => setDisappearDialogState({ open: false, threadId: null, currentTimer: 0 })}
                          currentTimer={disappearDialogState.currentTimer}
                          onSave={handleDisappearSave}
                        />
                      )}
                    </Suspense>
                  </Box>
                </>
              ) : (() => {
                const hasThreads = (threadsForActiveOrg?.length || 0) > 0;
                const stateKey = threadsLoading
                  ? "loading"
                  : hasThreads
                  ? "idle"
                  : "welcome";
                const heading = threadsLoading
                  ? "Syncing your conversations"
                  : hasThreads
                  ? "Pick a conversation"
                  : `Welcome, ${welcomeName}`;
                const subtext = threadsLoading
                  ? "This usually takes a moment. Your chats will appear on the left."
                  : hasThreads
                  ? "Select any chat from the list to open it here."
                  : "Pick someone from the list to start your first conversation.";
                const isDark = theme.palette.mode === "dark";
                const easeOut = "cubic-bezier(0.23, 1, 0.32, 1)";
                return (
                  <Stack
                    alignItems="center"
                    justifyContent="center"
                    spacing={3}
                    sx={{
                      flexGrow: 1,
                      m: 1,
                      px: 4,
                      borderRadius: 2,
                      textAlign: "center",
                      position: "relative",
                      backgroundColor: isDark
                        ? theme.palette.background.default
                        : theme.palette.background.paper,
                      backgroundImage: `radial-gradient(ellipse 520px 360px at 50% 42%, ${alpha(
                        theme.palette.primary.main,
                        isDark ? 0.09 : 0.05
                      )} 0%, transparent 70%)`,
                      boxShadow: isDark
                        ? `inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.04)}`
                        : `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.06)}`,
                      "@keyframes gapp-stagger-in": {
                        from: { opacity: 0, transform: "translateY(6px)" },
                        to: { opacity: 1, transform: "translateY(0)" },
                      },
                      "@keyframes gapp-dot-pulse": {
                        "0%, 100%": { opacity: 0.35, transform: "scale(0.85)" },
                        "50%": { opacity: 1, transform: "scale(1)" },
                      },
                      "@media (prefers-reduced-motion: reduce)": {
                        "& [data-animate]": {
                          animation: "none !important",
                          opacity: "1 !important",
                          transform: "none !important",
                        },
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1.25}
                      data-animate
                      sx={{
                        animation: `gapp-stagger-in 360ms ${easeOut} both`,
                        animationDelay: "0ms",
                      }}
                    >
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 1.5,
                          p: 0.75,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isDark
                            ? "rgba(255, 255, 255, 0.92)"
                            : "rgba(255, 255, 255, 0.72)",
                          boxShadow: isDark
                            ? "inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 1px 2px rgba(0,0,0,0.18)"
                            : "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.06)",
                        }}
                      >
                        <img
                          src={mascotSrc}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      </Box>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        color={isDark ? theme.palette.text.primary : theme.palette.primary.main}
                        sx={{ letterSpacing: "-0.01em" }}
                      >
                        TeamChatX
                      </Typography>
                    </Stack>

                    <Stack
                      key={stateKey}
                      alignItems="center"
                      spacing={1.25}
                      data-animate
                      sx={{
                        animation: `gapp-stagger-in 360ms ${easeOut} both`,
                        animationDelay: "90ms",
                      }}
                    >
                      {threadsLoading && (
                        <Box
                          aria-hidden
                          sx={{ display: "flex", gap: 0.75, mb: 0.5 }}
                        >
                          {[0, 1, 2].map((i) => (
                            <Box
                              key={i}
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                backgroundColor: theme.palette.primary.main,
                                animation: `gapp-dot-pulse 1.3s ease ${i * 0.16}s infinite`,
                              }}
                            />
                          ))}
                        </Box>
                      )}
                      <Typography
                        variant="h5"
                        fontWeight={700}
                        color="text.primary"
                        sx={{ letterSpacing: "-0.015em", lineHeight: 1.25 }}
                      >
                        {heading}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ maxWidth: 420, lineHeight: 1.55 }}
                      >
                        {subtext}
                      </Typography>
                    </Stack>
                  </Stack>
                );
              })()}
            </Box>
          </Box>

          {renderSidebarContent()}
        </Stack>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (dialogMode === LockMode.UNLOCK) closeDialog();
        }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ textAlign: "center", fontWeight: 700 }}>
          {dialogMode === LockMode.SET
            ? "Set your 4-digit PIN"
            : "Enter PIN to unlock"}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            margin="dense"
            label="PIN"
            type="password"
            autoComplete="new-password"
            fullWidth
            value={pinValue}
            onChange={(event) => handlePinChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handlePinSubmit();
              }
            }}
            inputProps={{ inputMode: "numeric", maxLength: 4 }}
            sx={{ mt: 1 }}
          />
          <Button
            onClick={handlePinSubmit}
            variant="contained"
            fullWidth
            sx={{ mt: 3, borderRadius: 999, py: 1.2, fontWeight: 600 }}
          >
            {dialogMode === LockMode.SET ? "Save PIN" : "Unlock"}
          </Button>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.error ? "error" : "success"}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      <Snackbar
        open={messageToast.open}
        autoHideDuration={2000}
        onClose={closeMessageToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ "& .MuiSnackbarContent-root": { minWidth: "auto" } }}
        message={messageToast.message}
      />
      <Dialog
        open={actionDialog.open}
        onClose={closeActionDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {actionDialog.type === "unsend"
            ? "Unsend this message?"
            : "Delete this message?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            {actionDialog.type === "unsend"
              ? "This will remove the message for everyone."
              : "This removes the message only for you."}
          </DialogContentText>
          {actionDialog.message ? (
            <Box
              sx={{
                p: 1,
                backgroundColor: theme.palette.action.hover,
                color: "text.primary",
                fontSize: 14,
              }}
            >
              {getMessagePreview(actionDialog.message)}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActionDialog}>Cancel</Button>
          <Button
            onClick={handleActionConfirm}
            color="error"
            variant="contained"
          >
            {actionDialog.type === "unsend" ? "Unsend" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
      {(() => {
        const { open, type, thread, busy } = threadActionConfirm;
        const copy =
          type === "leave"
            ? {
                title: "Exit this group?",
                body: `You'll stop receiving new messages from "${thread?.label || thread?.username || "this group"}". Past conversations will stay visible to you.`,
                confirm: "Exit Group",
                confirmColor: "warning",
              }
            : type === "delete-group"
            ? {
                title: "Delete this group?",
                body: `"${thread?.label || thread?.username || "This group"}" will be permanently deleted for everyone. This cannot be undone.`,
                confirm: "Delete Group",
                confirmColor: "error",
              }
            : type === "hide"
            ? {
                title: "Delete this chat?",
                body: `"${thread?.label || thread?.username || "This chat"}" will be removed from your list. Only you are affected — other members are not notified.`,
                confirm: "Delete Chat",
                confirmColor: "error",
              }
            : null;
        if (!copy) return null;
        const runAction = async () => {
          if (!thread) return;
          setThreadActionConfirm((prev) => ({ ...prev, busy: true }));
          try {
            if (type === "leave") await handleLeaveGroup(thread);
            else if (type === "delete-group") await handleDeleteGroup(thread);
            else if (type === "hide") await handleHideGroupThread(thread);
          } finally {
            closeThreadActionConfirm();
          }
        };
        return (
          <Dialog
            open={open}
            onClose={busy ? undefined : closeThreadActionConfirm}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle sx={{ fontWeight: 700 }}>{copy.title}</DialogTitle>
            <DialogContent>
              <DialogContentText>{copy.body}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeThreadActionConfirm} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={runAction}
                color={copy.confirmColor}
                variant="contained"
                disabled={busy}
                autoFocus
              >
                {busy ? "Please wait…" : copy.confirm}
              </Button>
            </DialogActions>
          </Dialog>
        );
      })()}
      <LiveAssistant />
    </>
  );
};

export default GeneralApp;

