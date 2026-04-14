import React, { Suspense, useEffect } from "react";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import SideBar from "./SideBar.jsx";
import TopBar from "./TopBar.jsx";
import KeepAliveOutlet from "./KeepAliveOutlet.jsx";
import { ConnectivityProvider } from "../../contexts/ConnectivityContext.jsx";
import { SocketProvider } from "../../contexts/SocketContext.jsx";
import PresenceProvider from "../../contexts/PresenceProvider.jsx";
import { ChatLockProvider } from "../../contexts/ChatLockContext.jsx";
import { TypingIndicatorProvider } from "../../contexts/TypingIndicatorContext.jsx";
import { ScreenShareProvider } from "../../contexts/ScreenShareContext.jsx";
import ScreenShareRequestDialog from "../../components/screenshare/ScreenShareRequestDialog.jsx";
import ScreenShareOverlay from "../../components/screenshare/ScreenShareOverlay.jsx";
import { CallProvider } from "../../contexts/CallContext.jsx";
import CallRequestDialog from "../../components/call/CallRequestDialog.jsx";
import CallOverlay from "../../components/call/CallOverlay.jsx";
import { MeetingProvider } from "../../contexts/MeetingContext.jsx";
import MeetingInviteDialog from "../../components/meeting/MeetingInviteDialog.jsx";
import { appBrandingAssets } from "../../data/CommonData.js";
import { ensurePushSubscription } from "../../utils/webPushClient.js";

const OutletFallback = () => {
  const theme = useTheme();
  const brandText = appBrandingAssets.brand;
  return (
    <Stack
      flexGrow={1}
      minWidth={0}
      alignItems="center"
      justifyContent="center"
      sx={{
        gap: 1,
        bgcolor:
          theme.palette.background.paper,
      }}
    >
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{
          width: 260,
          height: 64,
          position: "relative",
          "@keyframes logoPopSlide": {
            "0%": {
              opacity: 0,
              transform: "translate(96px, 0%) scale(0.6)",
            },
            "35%": {
              opacity: 1,
              transform: "translate(96px, 0%) scale(0.6)",
            },
            "100%": {
              opacity: 1,
              transform: "translate(0, 0%) scale(1)",
            },
          },
          "@keyframes revealChar": {
            "0%": { transform: "translateX(10px) rotateY(90deg)" },
            "100%": { transform: "translateX(0) rotateY(0deg)" },
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
          }}
        >
          <Box
            component="img"
            src={appBrandingAssets.mascot}
            alt={brandText}
            sx={{
              width: 60,
              height: "auto",
              animation: "logoPopSlide 1.2s cubic-bezier(0.22, 0.61, 0.36, 1) both",
              transform: "translate(96px,0%) scale(0.6)",
              transformOrigin: "left center",
              willChange: "transform, opacity",
              opacity: 0,
              zIndex: 9,
            }}
          />
          <Typography
            component="div"
            variant="h4"
            color="text.primary"
            sx={{
              ml: 1,
              display: "flex",
              fontWeight: 700,
              letterSpacing: "0.12em",
              zIndex: 2,
            }}
          >
            {brandText.split("").map((char, index) => (
              <Box
                key={`${char}-${index}`}
                component="span"
                sx={{
                  display: "inline-block",
                  animation: "revealChar 0.8s ease forwards",
                  animationDelay: `${0.45 + index * 0.07}s`,
                  transform: "translateY(10px) rotateX(90deg)",
                }}
              >
                {char}
              </Box>
            ))}
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
};

const DashboardLayout = () => {
  // Register a web-push subscription so notifications arrive even when the tab
  // is closed or the app is backgrounded. Safe to retry — the helper diffs state.
  useEffect(() => {
    const t = setTimeout(() => { ensurePushSubscription().catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const preloadRoutes = async () => {
      try {
        await Promise.all([
          import("../../pages/dashboard/Admin.jsx"),
          import("../../pages/dashboard/Settings.jsx"),
        ]);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Prefetch failed for dashboard routes", error);
        }
      }
    };

    if (!cancelled) {
      preloadRoutes();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ConnectivityProvider>
      <SocketProvider>
        <PresenceProvider>
          <ChatLockProvider>
            <TypingIndicatorProvider>
              <ScreenShareProvider>
                <CallProvider>
                  <MeetingProvider>
                    <Stack direction="column">
                      <TopBar />
                      <Stack
                        direction="row"
                        height={`calc(100vh - 39px)`}
                        overflow={"hidden"}
                      >
                        {/* sidebar  */}
                        <SideBar />
                        <Suspense fallback={<OutletFallback />}>
                          <KeepAliveOutlet
                            keepAlivePaths={["/app"]}
                            containerSx={{ flexGrow: 1, minWidth: 0, display: "flex" }}
                          />
                        </Suspense>
                      </Stack>
                    </Stack>
                    <ScreenShareRequestDialog />
                    <ScreenShareOverlay />
                    <CallRequestDialog />
                    <CallOverlay />
                    <MeetingInviteDialog
                      onJoin={(meetingData) => {
                        // This will be handled by the component that has access to meeting context
                        window.dispatchEvent(new CustomEvent("meeting:join-from-invite", { detail: meetingData }));
                      }}
                    />
                  </MeetingProvider>
                </CallProvider>
              </ScreenShareProvider>
            </TypingIndicatorProvider>
          </ChatLockProvider>
        </PresenceProvider>
      </SocketProvider>
    </ConnectivityProvider>
  );
};

export default DashboardLayout;
