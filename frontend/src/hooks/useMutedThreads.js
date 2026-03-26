import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext.jsx";

/**
 * Manages muted threads state. Syncs with backend via socket events.
 * Usage: const { isMuted, muteThread, unmuteThread, mutedThreads } = useMutedThreads();
 */
const useMutedThreads = () => {
  const socket = useSocket();
  const [mutedThreads, setMutedThreads] = useState(new Map());
  const mutedRef = useRef(mutedThreads);
  mutedRef.current = mutedThreads;

  useEffect(() => {
    if (!socket) return;

    const handleSync = (mutes) => {
      const map = new Map();
      if (Array.isArray(mutes)) {
        for (const m of mutes) {
          map.set(m.thread_id, { muted: true, muteUntil: m.mute_until || null });
        }
      }
      setMutedThreads(map);
    };

    const handleUpdate = (data) => {
      setMutedThreads((prev) => {
        const next = new Map(prev);
        if (data.muted) {
          next.set(data.threadId, { muted: true, muteUntil: data.muteUntil || null });
        } else {
          next.delete(data.threadId);
        }
        return next;
      });
    };

    socket.on("thread:mute_sync", handleSync);
    socket.on("thread:mute_update", handleUpdate);

    return () => {
      socket.off("thread:mute_sync", handleSync);
      socket.off("thread:mute_update", handleUpdate);
    };
  }, [socket]);

  // Auto-unmute expired mutes every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMutedThreads((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [threadId, val] of next) {
          if (val.muteUntil && new Date(val.muteUntil).getTime() <= now) {
            next.delete(threadId);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isMuted = useCallback(
    (threadId) => mutedRef.current.has(threadId),
    []
  );

  const muteThread = useCallback(
    (threadId, duration) => {
      if (!socket) return;
      socket.emit("thread:mute", { threadId, duration });
    },
    [socket]
  );

  const unmuteThread = useCallback(
    (threadId) => {
      if (!socket) return;
      socket.emit("thread:mute", { threadId, duration: "unmute" });
    },
    [socket]
  );

  return { isMuted, muteThread, unmuteThread, mutedThreads };
};

export default useMutedThreads;
