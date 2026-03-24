import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { probeInternet } from "../utils/networkStatus";

const ConnectivityContext = createContext({
  online: true,
  checking: false,
  offlineSince: null,
  refreshStatus: () => {},
});

const getInitialOnlineState = () => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine ?? true;
};

export const ConnectivityProvider = ({ children }) => {
  const [online, setOnline] = useState(getInitialOnlineState);
  const [checking, setChecking] = useState(false);
  const [offlineSince, setOfflineSince] = useState(null);
  const pendingProbeRef = useRef(null);

  const finalizeStatus = useCallback((nextOnline) => {
    setOnline(nextOnline);
    setOfflineSince((prev) => (nextOnline ? null : prev ?? Date.now()));
  }, []);

  const refreshStatus = useCallback(async () => {
    if (pendingProbeRef.current) {
      return pendingProbeRef.current;
    }
    setChecking(true);
    const probePromise = (async () => {
      try {
        const hasInternet = await probeInternet();
        finalizeStatus(hasInternet);
        return hasInternet;
      } catch {
        finalizeStatus(false);
        return false;
      } finally {
        pendingProbeRef.current = null;
        setChecking(false);
      }
    })();
    pendingProbeRef.current = probePromise;
    return probePromise;
  }, [finalizeStatus]);

  useEffect(() => {
    let mounted = true;
    const handleOnline = () => {
      if (!mounted) return;
      finalizeStatus(true);
      refreshStatus();
    };
    const handleOffline = () => {
      if (!mounted) return;
      finalizeStatus(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }
    refreshStatus();

    return () => {
      mounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
      pendingProbeRef.current = null;
    };
  }, [finalizeStatus, refreshStatus]);

  const value = useMemo(
    () => ({
      online,
      checking,
      offlineSince,
      refreshStatus,
    }),
    [online, checking, offlineSince, refreshStatus]
  );

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = () => useContext(ConnectivityContext);

export default ConnectivityContext;
