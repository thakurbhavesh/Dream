import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  browserName,
  isDesktop,
  isIOS,
  isMobile,
  isTablet,
  osName,
  osVersion,
} from "react-device-detect";
import { threadService } from "../services/threadService.js";
import { useSocketContext } from "./SocketContext.jsx";

const INITIAL_IDLE_STATE = { status: "online", idleSeconds: 0 };

const PresenceContext = createContext({
  online: false,
  idleState: INITIAL_IDLE_STATE,
  status: "Offline",
  setThresholds: () => {},
});

const readIdentity = () => {
  if (typeof window === "undefined") {
    return { userId: null, company: null };
  }
  return {
    userId: window.localStorage.getItem("userId"),
    company: window.localStorage.getItem("company"),
  };
};

const normaliseIdle = (state) => {
  if (!state) return INITIAL_IDLE_STATE;
  const rawStatus =
    typeof state.status === "string" ? state.status.toLowerCase() : "online";
  const status =
    rawStatus === "away" || rawStatus === "idle" ? rawStatus : "online";
  const idleSeconds = Number.isFinite(Number(state.idleSeconds))
    ? Math.max(0, Math.floor(Number(state.idleSeconds)))
    : 0;
  return { status, idleSeconds };
};

export const PresenceProvider = ({ children }) => {
  const { socket } = useSocketContext();
  const isElectron =
    typeof window !== "undefined" && Boolean(window?.electron?.isElectron);

  const [online, setOnline] = useState(false);
  const [idleState, setIdleState] = useState(INITIAL_IDLE_STATE);
  const onlineRef = useRef(false);
  const idleStateRef = useRef(INITIAL_IDLE_STATE);
  const thresholdsRef = useRef({
    idle: 1 * 60 * 1000,
    away: 2 * 60 * 1000,
  });
  const lastSentRef = useRef("");
  const lastTabVisibilityRef = useRef(null);
  const channelRef = useRef(null);
  const bumpRafRef = useRef(null);
  const presenceBridge =
    typeof window !== "undefined" ? window.presence ?? null : null;
  const hasElectronBridge = isElectron && Boolean(presenceBridge);

  const setStableOnline = useCallback((nextOnline) => {
    setOnline((prev) => (prev === nextOnline ? prev : nextOnline));
  }, []);

  const setStableIdleState = useCallback((nextState) => {
    setIdleState((prev) => {
      if (
        prev.status === nextState.status &&
        prev.idleSeconds === nextState.idleSeconds
      ) {
        return prev;
      }
      return nextState;
    });
  }, []);

  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  useEffect(() => {
    idleStateRef.current = idleState;
  }, [idleState]);

  useEffect(() => {
    if (!hasElectronBridge || !presenceBridge) return undefined;
    const api = presenceBridge;
    const unsubs = [];

    (async () => {
      try {
        const appOnline = await api.getAppOnline?.();
        setStableOnline(Boolean(appOnline));
      } catch {
        /* noop */
      }
      try {
        const st = await api.getIdleState?.();
        if (st) {
          setStableIdleState(normaliseIdle(st));
        }
      } catch {
        /* noop */
      }
    })();

    unsubs.push(
      api.onApp?.(({ online: nextOnline }) => setStableOnline(!!nextOnline))
    );
    unsubs.push(
      api.onIdle?.((next) => setStableIdleState(normaliseIdle(next)))
    );

    return () => {
      unsubs.forEach((off) => {
        try {
          off?.();
        } catch {
          /* noop */
        }
      });
    };
  }, [hasElectronBridge, presenceBridge]);

  useEffect(() => {
    if (hasElectronBridge) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const { userId, company } = readIdentity();
    let lastActiveAt = Date.now();
    let idleTimer = null;
    let awayTimer = null;

    const emitTabVisibility = (tabcheck) => {
      if (!socket || !userId || !company || !socket.connected) return;
      if (lastTabVisibilityRef.current === tabcheck) return;
      lastTabVisibilityRef.current = tabcheck;
      socket.emit("tab-visibility", { userId, company, tabcheck });
    };

    const onConnect = () => {
      setStableOnline(true);
      emitTabVisibility(1);
    };
    const onDisconnect = () => {
      setStableOnline(false);
      emitTabVisibility(0);
    };
    socket?.on?.("connect", onConnect);
    socket?.on?.("disconnect", onDisconnect);

    try {
      channelRef.current = new BroadcastChannel("presence");
    } catch {
      channelRef.current = null;
    }
    const postActivity = (ts) => {
      try {
        channelRef.current?.postMessage({ type: "activity", ts });
      } catch {
        /* noop */
      }
    };
    const onChannel = (event) => {
      if (event?.data?.type !== "activity") return;
      lastActiveAt = Math.max(lastActiveAt, Number(event.data.ts) || Date.now());
    };
    channelRef.current?.addEventListener?.("message", onChannel);

    const resolveStatus = () => {
      const delta = Date.now() - lastActiveAt;
      if (delta >= thresholdsRef.current.away) return "Away";
      if (delta >= thresholdsRef.current.idle) return "Idle";
      return "Online";
    };

    const apply = (next) => {
      setStableOnline(true);
      const secs = Math.floor((Date.now() - lastActiveAt) / 1000);
      setStableIdleState({
        status: next.toLowerCase(),
        idleSeconds: secs,
      });
      if (next === "Online") {
        emitTabVisibility(1);
      }
    };

    const schedule = () => {
      clearTimeout(idleTimer);
      clearTimeout(awayTimer);
      const delta = Date.now() - lastActiveAt;
      const toIdle = Math.max(0, thresholdsRef.current.idle - delta);
      const toAway = Math.max(0, thresholdsRef.current.away - delta);
      idleTimer = window.setTimeout(() => apply("Idle"), toIdle);
      awayTimer = window.setTimeout(() => apply("Away"), toAway);
    };

    const runBumpImmediately = () => {
      lastActiveAt = Date.now();
      apply("Online");
      postActivity(lastActiveAt);
      schedule();
    };

    const bump = () => {
      if (
        typeof window === "undefined" ||
        typeof window.requestAnimationFrame !== "function"
      ) {
        runBumpImmediately();
        return;
      }
      if (bumpRafRef.current) {
        return;
      }
      bumpRafRef.current = window.requestAnimationFrame(() => {
        bumpRafRef.current = null;
        runBumpImmediately();
      });
    };

    const onVisibility = () => {
      if (!document.hidden) {
        runBumpImmediately();
        emitTabVisibility(1);
      } else {
        emitTabVisibility(0);
      }
    };

    const onUnload = () => {
      const identity = readIdentity();
      if (!socket || !identity.userId || !identity.company) return;
      socket.emit("update_activity_status", {
        userId: identity.userId,
        company: identity.company,
        activity_status: "Offline",
      });
      emitTabVisibility(0);
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "wheel",
      "scroll",
    ];
    activityEvents.forEach((event) =>
      window.addEventListener(event, bump, { passive: true })
    );

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", bump);
      window.addEventListener("pageshow", bump);
      window.addEventListener("beforeunload", onUnload);

    runBumpImmediately();

    return () => {
      socket?.off?.("connect", onConnect);
      socket?.off?.("disconnect", onDisconnect);
      activityEvents.forEach((event) =>
        window.removeEventListener(event, bump)
      );
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", bump);
      window.removeEventListener("pageshow", bump);
      window.removeEventListener("beforeunload", onUnload);
      clearTimeout(idleTimer);
      clearTimeout(awayTimer);
      if (
        bumpRafRef.current &&
        typeof window !== "undefined" &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(bumpRafRef.current);
        bumpRafRef.current = null;
      }
      try {
        channelRef.current?.removeEventListener?.("message", onChannel);
        channelRef.current?.close?.();
      } catch {
        /* noop */
      }
    };
  }, [hasElectronBridge, socket]);

  const status = useMemo(() => {
    if (!online) return "Offline";
    if (idleState.status === "away") return "Away";
    if (idleState.status === "idle") return "Idle";
    return "Online";
  }, [online, idleState.status]);

  useEffect(() => {
    const { userId, company } = readIdentity();
    if (!socket || !userId || !company) return;
    if (lastSentRef.current === status) return;
    lastSentRef.current = status;
    const deviceInfo = {
      isIOS,
      osVersion,
      isMobile,
      browserName,
      osName,
      isTablet,
      isDesktop,
    };
    socket.emit("update_activity_status", {
      userId,
      company,
      activity_status: status,
      deviceInfo,
    });
  }, [socket, status]);

  useEffect(() => {
    threadService.setAgentProfile({ status });
  }, [status]);

  const setThresholds = useCallback(
    async ({ idle, away } = {}) => {
      if (hasElectronBridge && presenceBridge?.setThresholds) {
        await presenceBridge.setThresholds({
          idle: Math.floor((Number(idle ?? 0) || 0) / 1000),
          away: Math.floor((Number(away ?? 0) || 0) / 1000),
        });
        return;
      }
      const idleMs = Number(idle);
      const awayMs = Number(away);
      if (Number.isFinite(idleMs)) {
        thresholdsRef.current.idle = Math.max(0, Math.floor(idleMs));
      }
      if (Number.isFinite(awayMs)) {
        thresholdsRef.current.away = Math.max(0, Math.floor(awayMs));
      }
    },
    [hasElectronBridge, presenceBridge]
  );

  const value = useMemo(
    () => ({
      online,
      idleState,
      status,
      setThresholds,
    }),
    [online, idleState, status, setThresholds]
  );

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => useContext(PresenceContext);

export default PresenceProvider;
