import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { getAccessToken } from "../utils/authApi";

const SocketContext = createContext(null);

const cleanUrl = (value) =>
  typeof value === "string" && value.trim()
    ? value.trim().replace(/\/$/, "")
    : "";

const buildSocketUrl = (explicitUrl) => {
  const resolvedExplicit = cleanUrl(explicitUrl);
  if (resolvedExplicit) return resolvedExplicit;

  // Auto-detect: if opened from network IP, connect socket to same IP
  if (typeof window !== "undefined" && !import.meta.env.PROD) {
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `${window.location.protocol}//${host}:5000`;
    }
  }

  const candidates = [
    import.meta.env.VITE_SOCKET_URL,
    import.meta.env.REACT_APP_SOCKET_URL,
    import.meta.env.VITE_API_URL,
    import.meta.env.VITE_SERVER_URL,
    import.meta.env.VITE_BACKEND_URL,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanUrl(candidate);
    if (cleaned) return cleaned;
  }

  return import.meta.env.PROD ? "" : "http://localhost:5000";
};

export const SocketProvider = ({
  children,
  autoConnect = true,
  url,
  withCredentials = true,
}) => {
  const [socket, setSocket] = useState(null);
  const [connection, setConnection] = useState({
    status: "idle",
    error: null,
    transport: null,
  });

  const socketUrl = useMemo(() => buildSocketUrl(url), [url]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (!socketUrl) {
      setSocket(null);
      setConnection((prev) => ({
        ...prev,
        status: "idle",
        transport: null,
        error: null,
      }));
      return undefined;
    }

    let instance = null;

    const connectWithToken = async () => {
      try {
        const token = await getAccessToken({ refreshIfNeeded: true });
        instance = io(socketUrl, {
          autoConnect: false,
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 750,
          reconnectionDelayMax: 6000,
          timeout: 20000,
          withCredentials,
          auth: { token },
        });
        setSocket(instance);

        const updateState = (next) => {
          setConnection((prev) => ({ ...prev, ...next }));
        };

        const deriveTransport = () => instance.io?.engine?.transport?.name ?? null;

        const handleConnect = () => {
          updateState({ status: "connected", error: null, transport: deriveTransport() });
        };

        const handleDisconnect = (reason) => {
          updateState({
            status: "disconnected",
            error: typeof reason === "string" ? reason : null,
            transport: null,
          });
        };

        const handleReconnectAttempt = () => {
          updateState({ status: "reconnecting", error: null });
        };

        const handleError = (error) => {
          updateState({
            status: "error",
            error: error?.message ?? (typeof error === "string" ? error : "error"),
          });
        };

        instance.on("connect", (...args) => {
          handleConnect(...args);
          // Auto-retry offline queue on reconnect
          try {
            const q = JSON.parse(localStorage.getItem('offline_queue') || '[]');
            if (q.length > 0) {
              console.log(`[socket] Retrying ${q.length} queued messages`);
              const remaining = [];
              q.forEach(item => {
                const text = item.message?.content?.text || item.message?.message || '';
                const msgType = item.message?.type || 'text';
                if (text && item.threadId) {
                  instance.emit('message:send', { threadId: item.threadId, message: text, message_type: msgType }, (res) => {
                    if (!res?.ok) remaining.push(item);
                  });
                }
              });
              setTimeout(() => localStorage.setItem('offline_queue', JSON.stringify(remaining)), 3000);
            }
          } catch {}
        });
        instance.on("disconnect", handleDisconnect);
        instance.on("connect_error", handleError);
        instance.on("error", handleError);

        // Force logout from linked devices (mobile revoked this session)
        instance.on("auth:force_logout", (data) => {
          console.warn("[socket] Force logout received:", data?.reason);
          // Clear auth and redirect to login
          try {
            window.localStorage.clear();
            window.sessionStorage.clear();
          } catch {}
          window.location.href = "/login";
        });
        instance.io?.on("reconnect_attempt", handleReconnectAttempt);
        instance.io?.on("reconnect", handleConnect);

        // Expose socket globally for components that can't use hooks (e.g. MessageInfoOverlay)
        if (typeof window !== "undefined") window.__chatSocket = instance;

        if (autoConnect) {
          updateState({ status: "connecting", error: null });
          instance.connect();
        }
      } catch (err) {
        console.warn("Socket auth failed", err);
      }
    };

    connectWithToken();

    return () => {
      if (instance) {
        instance.removeAllListeners();
        instance.close();
      }
      setSocket(null);
      setConnection({ status: "idle", error: null, transport: null });
    };
  }, [autoConnect, socketUrl, withCredentials]);

  const connect = useCallback(() => {
    if (!socket) return;
    setConnection((prev) => ({ ...prev, status: "connecting", error: null }));
    if (!socket.connected) socket.connect();
  }, [socket]);

  const disconnect = useCallback(() => {
    if (!socket) return;
    socket.disconnect();
    setConnection({ status: "disconnected", error: null, transport: null });
  }, [socket]);

  const value = useMemo(
    () => ({
      socket,
      status: connection.status,
      error: connection.error,
      transport: connection.transport,
      isConnected: connection.status === "connected",
      isConnecting:
        connection.status === "connecting" ||
        connection.status === "reconnecting",
      connect,
      disconnect,
    }),
    [connect, connection, disconnect, socket]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocketContext must be used within a SocketProvider");
  }
  return context;
};

export const useSocket = () => useSocketContext().socket;

export default SocketProvider;
