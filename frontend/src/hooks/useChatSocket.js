/**
 * useChatSocket.js
 *
 * Central hook that bridges Socket.IO events with the chat UI.
 * Handles: new messages, edits, recalls, deletes, reactions, typing, presence, notifications.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSocket } from "../contexts/SocketContext";
import { showSystemNotification } from "../utils/notificationBridge";

// ─── Notification sound helper ────────────────────────────────────────────────
// Reads the user's selected sound from secureStorage, falls back to sound1.mp3.
// Creates a fresh Audio element each call so a stuck/errored element never
// blocks subsequent notifications.  The browser caches the MP3 file anyway.
const SOUND_STORAGE_KEY = "chatx.notificationSound";
const _basePath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

// Cache the selected sound so we don't dynamic-import secureStorage every time
let _cachedSoundFile = null;
let _soundCacheTime = 0;
const SOUND_CACHE_TTL = 60_000; // refresh from storage every 60s

const readStoredSound = async () => {
  if (_cachedSoundFile && Date.now() - _soundCacheTime < SOUND_CACHE_TTL) {
    return _cachedSoundFile;
  }
  try {
    const { secureStorage } = await import("../utils/secureStorage.js");
    const val = await secureStorage.getItem(SOUND_STORAGE_KEY);
    _cachedSoundFile = val || "sound1.mp3";
    _soundCacheTime = Date.now();
    return _cachedSoundFile;
  } catch {
    _cachedSoundFile = "sound1.mp3";
    _soundCacheTime = Date.now();
    return _cachedSoundFile;
  }
};

// Preload the sound setting on module load
readStoredSound().catch(() => {});

// Pre-warm audio context on first user interaction to bypass autoplay policy
let _audioUnlocked = false;
const unlockAudio = () => {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    ctx.resume().catch(() => {});
  } catch {}
  document.removeEventListener("click", unlockAudio, true);
  document.removeEventListener("keydown", unlockAudio, true);
  document.removeEventListener("touchstart", unlockAudio, true);
};
if (typeof document !== "undefined") {
  document.addEventListener("click", unlockAudio, true);
  document.addEventListener("keydown", unlockAudio, true);
  document.addEventListener("touchstart", unlockAudio, true);
}

// ─── Per-thread sound resolution ──────────────────────────────────────────────
let _threadSoundsCache = null;
let _threadSoundsCacheTime = 0;

const readThreadSounds = async () => {
  if (_threadSoundsCache && Date.now() - _threadSoundsCacheTime < SOUND_CACHE_TTL) {
    return _threadSoundsCache;
  }
  try {
    const { secureStorage } = await import("../utils/secureStorage.js");
    const raw = await secureStorage.getItem("chatx.threadSounds");
    _threadSoundsCache = raw ? JSON.parse(raw) : {};
    _threadSoundsCacheTime = Date.now();
    return _threadSoundsCache;
  } catch {
    _threadSoundsCache = {};
    _threadSoundsCacheTime = Date.now();
    return {};
  }
};

const playNotificationSound = async (threadId = null) => {
  try {
    let soundFile;
    if (threadId) {
      const threadSounds = await readThreadSounds();
      soundFile = threadSounds?.[threadId] || (await readStoredSound());
    } else {
      soundFile = await readStoredSound();
    }
    const url = soundFile.startsWith("/")
      ? `${_basePath}${soundFile}`
      : `${_basePath}/sounds/${soundFile}`;
    const audio = new Audio(url);
    audio.volume = 0.5;
    await audio.play();
  } catch (err) {
    console.warn("[notification] sound play failed:", err?.message || err);
  }
};

const useChatSocket = ({
  onNewMessage,
  onMessageEdited,
  onMessageDeleted,
  onMessageRecalled,
  onMessageReacted,
  onMessagePinned,
  onPollVoted,
  onPollEnded,
  onPollEdited,
  onTypingUpdate,
  onUserOnline,
  onUserOffline,
  onUserStatus,
  onOnlineList,
  onReadAck,
  onThreadUpdate,
  onNotification,
  onUploadS3Progress,
  onPinSync,
  onPinUpdate,
} = {}) => {
  const socket = useSocket();
  const callbacksRef = useRef({});

  // Keep latest callbacks in ref to avoid re-subscribing
  callbacksRef.current = {
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onMessageRecalled,
    onMessageReacted,
    onMessagePinned,
    onPollVoted,
    onPollEnded,
    onPollEdited,
    onTypingUpdate,
    onUserOnline,
    onUserOffline,
    onUserStatus,
    onOnlineList,
    onReadAck,
    onThreadUpdate,
    onNotification,
    onUploadS3Progress,
    onPinSync,
    onPinUpdate,
  };

  useEffect(() => {
    if (!socket) return undefined;

    const handlers = {
      "message:new": (data) => callbacksRef.current.onNewMessage?.(data),
      "message:edited": (data) => callbacksRef.current.onMessageEdited?.(data),
      "message:deleted": (data) => callbacksRef.current.onMessageDeleted?.(data),
      "message:recalled": (data) => callbacksRef.current.onMessageRecalled?.(data),
      "message:reacted": (data) => callbacksRef.current.onMessageReacted?.(data),
      "message:pinned": (data) => callbacksRef.current.onMessagePinned?.(data),
      "poll:voted": (data) => callbacksRef.current.onPollVoted?.(data),
      "poll:ended": (data) => callbacksRef.current.onPollEnded?.(data),
      "poll:edited": (data) => callbacksRef.current.onPollEdited?.(data),
      "message:read_ack": (data) => callbacksRef.current.onReadAck?.(data),
      "message:delivered_ack": (data) => callbacksRef.current.onDeliveredAck?.(data),
      "thread:update": (data) => callbacksRef.current.onThreadUpdate?.(data),
      "thread:pin_sync": (data) => callbacksRef.current.onPinSync?.(data),
      "thread:pin_update": (data) => callbacksRef.current.onPinUpdate?.(data),
      "typing:update": (data) => callbacksRef.current.onTypingUpdate?.(data),
      "user:online": (data) => callbacksRef.current.onUserOnline?.(data),
      "user:offline": (data) => callbacksRef.current.onUserOffline?.(data),
      "user:status": (data) => callbacksRef.current.onUserStatus?.(data),
      "users:online_list": (data) => callbacksRef.current.onOnlineList?.(data),
      "upload:s3progress": (data) => callbacksRef.current.onUploadS3Progress?.(data),
      "notification": (data) => {
        try {
          console.log("[socket] notification received:", JSON.stringify(data));
          callbacksRef.current.onNotification?.(data);
          // Play per-thread or global notification sound
          playNotificationSound(data?.threadId).catch((err) =>
            console.warn("[socket] notification sound error:", err)
          );
          // Browser notification — show always (backend already filters same-thread + mute + DND)
          if (data?.title) {
            showSystemNotification({
              title: data.title,
              body: data.body || "",
            });
          }
        } catch (err) {
          console.error("[socket] notification handler error:", err);
        }
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
    };
  }, [socket]);

  // ─── Emitters ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (threadId, message, messageType = "text", metadata = null) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("message:send", { threadId, message, message_type: messageType, metadata }, resolve);
      }),
    [socket]
  );

  const editMessage = useCallback(
    (messageId, threadId, newText) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("message:edit", { messageId, threadId, newText }, resolve);
      }),
    [socket]
  );

  const deleteMessage = useCallback(
    (messageId, threadId) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("message:delete", { messageId, threadId }, resolve);
      }),
    [socket]
  );

  const recallMessage = useCallback(
    (messageId, threadId) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("message:recall", { messageId, threadId }, resolve);
      }),
    [socket]
  );

  const reactToMessage = useCallback(
    (messageId, threadId, emoji) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("message:react", { messageId, threadId, emoji }, resolve);
      }),
    [socket]
  );

  const forwardMessage = useCallback(
    (targetThreadId, message, messageType = "text", metadata = null) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("message:forward", { targetThreadId, message, message_type: messageType, metadata }, resolve);
      }),
    [socket]
  );

  const startTyping = useCallback(
    (threadId) => { socket?.emit("typing:start", { threadId }); },
    [socket]
  );

  const stopTyping = useCallback(
    (threadId) => { socket?.emit("typing:stop", { threadId }); },
    [socket]
  );

  const markRead = useCallback(
    (threadId) => { socket?.emit("message:read", { threadId }); },
    [socket]
  );

  const pinMessage = useCallback(
    (messageId, threadId, pinned) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("message:pin", { messageId, threadId, pinned }, resolve);
      }),
    [socket]
  );

  const votePoll = useCallback(
    (messageId, threadId, optionId, pollType) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("poll:vote", { messageId, threadId, optionId, pollType }, resolve);
      }),
    [socket]
  );

  const endPoll = useCallback(
    (messageId, threadId, endedAt) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("poll:end", { messageId, threadId, endedAt }, resolve);
      }),
    [socket]
  );

  const editPoll = useCallback(
    (messageId, threadId, poll) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("poll:edit", { messageId, threadId, poll }, resolve);
      }),
    [socket]
  );

  const joinGroup = useCallback(
    (groupId) => { socket?.emit("group:join", { groupId }); },
    [socket]
  );

  const focusThread = useCallback(
    (threadId) => { socket?.emit("thread:focus", { threadId: threadId || null }); },
    [socket]
  );

  const pinThread = useCallback(
    (threadId, pinned) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("thread:pin", { threadId, pinned: !!pinned }, resolve);
      }),
    [socket]
  );

  const scheduleMessage = useCallback(
    (threadId, message, messageType, metadata, sendAt) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("message:schedule", { threadId, message, messageType, metadata, sendAt }, resolve);
      }),
    [socket]
  );

  const cancelScheduledMessage = useCallback(
    (id) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("message:schedule:cancel", { id }, resolve);
      }),
    [socket]
  );

  const listScheduledMessages = useCallback(
    () =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("scheduled:list", {}, resolve);
      }),
    [socket]
  );

  const broadcastMessage = useCallback(
    (contactIds, message, messageType = "text", metadata = null) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("broadcast:send", { contactIds, message, messageType, metadata }, resolve);
      }),
    [socket]
  );

  const setThreadSound = useCallback(
    (threadId, soundFile) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("thread:sound:set", { threadId, soundFile }, resolve);
        // Also update local cache
        _threadSoundsCache = null;
        _threadSoundsCacheTime = 0;
      }),
    [socket]
  );

  const setDisappearTimer = useCallback(
    (threadId, durationSeconds) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("thread:disappear:set", { threadId, durationSeconds }, resolve);
      }),
    [socket]
  );

  const getDisappearTimer = useCallback(
    (threadId) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ error: "Not connected" });
        socket.emit("thread:disappear:get", { threadId }, resolve);
      }),
    [socket]
  );

  return useMemo(() => ({
    socket,
    isConnected: socket?.connected ?? false,
    sendMessage,
    editMessage,
    deleteMessage,
    recallMessage,
    reactToMessage,
    forwardMessage,
    startTyping,
    stopTyping,
    markRead,
    pinMessage,
    votePoll,
    endPoll,
    editPoll,
    joinGroup,
    focusThread,
    pinThread,
    scheduleMessage,
    cancelScheduledMessage,
    listScheduledMessages,
    broadcastMessage,
    setThreadSound,
    setDisappearTimer,
    getDisappearTimer,
  }), [socket, sendMessage, editMessage, deleteMessage, recallMessage, reactToMessage, forwardMessage, startTyping, stopTyping, markRead, pinMessage, votePoll, endPoll, editPoll, joinGroup, focusThread, pinThread, scheduleMessage, cancelScheduledMessage, listScheduledMessages, broadcastMessage, setThreadSound, setDisappearTimer, getDisappearTimer]);
};

export default useChatSocket;
