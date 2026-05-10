// src/layouts/dashboard/TopBar.js
import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Divider,
  Stack,
  Typography,
  useTheme,
  Button,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  PiDesktop,
  PiLockKey,
  PiLockKeyOpen,
  PiSignOut,
  PiWifiSlash,
} from "react-icons/pi";
import authStore from "../../utils/auth";
import secureStorage from "../../utils/secureStorage";
import { fetchWithAuth } from "../../utils/authApi";
import { SETTINGS_STORAGE_KEYS } from "../../pages/dashboard/settings/storageKeys";
import { DEFAULT_WALLPAPER_SELECTION } from "../../pages/dashboard/settings/defaults";
import { useConnectivity } from "../../contexts/ConnectivityContext.jsx";
import DownloadToasts from "../../components/DownloadToasts.jsx";
import useCurrentUser from "../../hooks/useCurrentUser.js";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { getOrCreateClientDeviceId } from "../../utils/deviceId.js";
import { useSiteBranding } from "../../contexts/SiteBrandingContext.jsx";

const TopBar = () => {
  const { brandName } = useSiteBranding();
  const theme = useTheme();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const displayName = String(currentUser?.displayName || "Myself").trim() || "Myself";

  const { online } = useConnectivity();

  // Browser vs Electron
  const [isBrowser, setIsBrowser] = useState(true);
  useEffect(() => {
    const isElectron = !!window?.electron?.isElectron;
    setIsBrowser(!isElectron);
  }, []);

  // Desktop app URL (no API calls): take from env or fallback
  const [appUrl, setAppUrl] = useState("/");
  useEffect(() => {
    const envUrl = (import.meta.env.VITE_DESKTOP_APP_URL ?? "").trim();
    setAppUrl(envUrl || "/");
  }, []);

  const [lockState, setLockState] = useState({ locked: false, hasPin: false });
  useEffect(() => {
    const readLockState = () => {
      if (typeof window === "undefined") return;
      const hasPin = Boolean(localStorage.getItem("chatx.pinHash"));
      const locked = hasPin
        ? localStorage.getItem("chatx.lockState") !== "unlocked"
        : false;
      setLockState({ locked, hasPin });
    };

    const handleStateEvent = (event) => {
      if (!event?.detail) return;
      setLockState({
        locked: Boolean(event.detail.locked),
        hasPin: Boolean(event.detail.hasPin),
      });
    };

    readLockState();

    window.addEventListener("chat-lock:state-changed", handleStateEvent);
    window.addEventListener("storage", readLockState);
    return () => {
      window.removeEventListener("chat-lock:state-changed", handleStateEvent);
      window.removeEventListener("storage", readLockState);
    };
  }, []);

  const handleLockToggle = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("chat-lock:toggle"));
  };

  const lockLabel = !lockState.hasPin
    ? "Set PIN"
    : lockState.locked
      ? "Unlock"
      : "Lock";

  const netOK = online;
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (!netOK) {
      wasOfflineRef.current = true;
      return;
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      try {
        if (window?.electron?.ipcRenderer) {
          window.electron.ipcRenderer.send("network:reconnect");
        }
      } catch {}
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("chatx:reconnected"));
      }
    }
  }, [netOK]);

  // Logout (client-only; no API, no sockets)
  const handleLogout = async () => {
    try {
      const clientDeviceId = getOrCreateClientDeviceId();

      await fetchWithAuth(
        `${API_BASE_URL}/auth/logout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(clientDeviceId ? { "X-Device-Id": clientDeviceId } : {}),
          },
          body: JSON.stringify({
            client_device_id: clientDeviceId || undefined,
          }),
        },
        { refreshIfNeeded: false, retryOnUnauthorized: false }
      ).catch(() => null);
    } catch {}

    if (typeof window !== "undefined") {
      window.localStorage.removeItem("chatx.displayName");
      window.dispatchEvent(new Event("chatx:display-name"));
    }
    window.dispatchEvent(new Event("chatx:logout"));
    await secureStorage.setItem(
      SETTINGS_STORAGE_KEYS.wallpaper,
      JSON.stringify(DEFAULT_WALLPAPER_SELECTION)
    );
    authStore.logout({
      keepKeys: [
        "selectedUser",
        "selectedTab",
        "selectedNotificationSound",
        "notificationsAllowed",
        "notificationPermission",
        "fontType",
        SETTINGS_STORAGE_KEYS.wallpaper,
      ],
    });
    navigate("/auth/login", { replace: true });
  };

  const dragRegionSx = isBrowser ? {} : { WebkitAppRegion: "drag" };
  const noDragRegionSx = isBrowser ? {} : { WebkitAppRegion: "no-drag" };

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.primary.main,
        height: "100%",
        width: "100%",
        ...dragRegionSx,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        px={1}
        py="6px"
        height="100%"
        justifyContent="space-between"
        width={isBrowser ? "100%" : "calc(100vw - 150px)"}
        sx={dragRegionSx}
      >
        {/* Left chunk */}
        <Stack spacing={1.5} direction="row" alignItems="center">
          <Typography
            color="#fff"
            variant="body"
            sx={{
              fontWeight: "bold",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {brandName}
          </Typography>

          <Divider orientation="vertical" variant="middle" flexItem />
          <Typography color="#fff" variant="body">
            {displayName}
          </Typography>

          {/* No Internet pill */}
          {!netOK && (
            <Box
              sx={{
                ml: 2,
                px: 1.5,
                py: 0.5,
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                borderRadius: 9999,
                bgcolor: "rgba(0,0,0,0.8)",
                color: "#fff",
              }}
              title="You are offline"
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, lineHeight: 1 }}
              >
                No Internet
              </Typography>
              <PiWifiSlash size={16} color="#ff4d4f" />
            </Box>
          )}
        </Stack>

        {/* Right chunk */}
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ ...noDragRegionSx }}>
            <DownloadToasts />
          </Box>
          <Button
            startIcon={lockState.locked ? <PiLockKeyOpen size={18} /> : <PiLockKey size={18}/>}
            onClick={handleLockToggle}
            sx={{
              fontSize: "12px",
              color: "#fff",
              border: "1px solid rgba(255,255,255,.6)",
              backdropFilter: "blur(10px)",
              borderRadius: "4px",
              "&:hover": { borderColor: "rgba(255,255,255,1)", color: "#fff" },
              p: "0px 8px",
              m: "4px",
              bgcolor: lockState.locked ? "rgba(0,0,0,0.45)" : "transparent",
              ...noDragRegionSx,
            }}
          >
            {lockLabel}
          </Button>

          {/* Desktop App CTA (browser only) */}
          {isBrowser && (
            <Button
              startIcon={<PiDesktop size={16} />}
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontSize: "12px",
                color: "#fff !important",
                border: "1px solid rgba(255,255,255,.6)",
                backdropFilter: "blur(10px)",
                borderRadius: "5px",
                "&:hover": {
                  borderColor: "rgba(255,255,255,1)",
                  color: "#fff",
                },
                p: "2px 8px",
                m: "4px",
                ...noDragRegionSx,
              }}
            >
              Desktop App
            </Button>
          )}

          <Divider orientation="vertical" variant="middle" flexItem />

          <Button
            endIcon={<PiSignOut size={16} />}
            sx={{
              fontSize: "12px",
              color: "#fff",
              height: "auto",
              bgcolor: theme.palette.error.main,
              borderRadius: "4px",
              p: "2px 8px",
              m: "4px",
              "&:hover": { bgcolor: "#111" },
              ...noDragRegionSx,
            }}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default TopBar;
