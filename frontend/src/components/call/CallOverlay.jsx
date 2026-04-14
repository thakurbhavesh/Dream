import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Alert,
  Avatar,
  Box,
  IconButton,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  PiPhone,
  PiPhoneSlash,
  PiMicrophone,
  PiMicrophoneSlash,
  PiVideoCamera,
  PiVideoCameraSlash,
  PiArrowsIn,
  PiArrowsOut,
} from "react-icons/pi";
import { useCallContext } from "../../contexts/CallContext.jsx";
import {
  startOutgoingRing,
  stopOutgoingRing,
  playConnectedSound,
  playEndedSound,
  stopAllCallSounds,
} from "../../utils/callSounds.js";
import CallNotesDialog from "./CallNotesDialog.jsx";

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const CallOverlay = () => {
  const theme = useTheme();
  const {
    status,
    callType,
    peerUserName,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    peerMuted,
    peerVideoOff,
    callDuration,
    error,
    endCall,
    toggleMute,
    toggleVideo,
  } = useCallContext();

  // Persistent hidden audio element — plays remote audio even when minimized
  const hiddenAudioRef = useRef(null);
  useEffect(() => {
    if (hiddenAudioRef.current && remoteStream) {
      hiddenAudioRef.current.srcObject = remoteStream;
      const p = hiddenAudioRef.current.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [remoteStream]);

  const [errorToast, setErrorToast] = useState("");
  useEffect(() => {
    if (error) setErrorToast(error);
  }, [error]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [minimized, setMinimized] = useState(false);
  const [callNotesOpen, setCallNotesOpen] = useState(false);
  const lastCallRef = useRef({ duration: 0, peerName: "" });

  const isActive = status === "active";
  const isConnecting = status === "connecting" || status === "accepted";
  const isCalling = status === "calling";
  const isVideo = callType === "video";
  const showOverlay = isActive || isConnecting || isCalling;

  // Attach local stream (re-run when status changes so elements are available)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, status, minimized]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, status, minimized]);

  // Sound effects based on call status
  const prevStatusRef = useRef(null);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    // Track call info for notes
    if (status === "active") {
      lastCallRef.current = { duration: callDuration, peerName: peerUserName || "" };
    }
    if (status === "active" && callDuration > 0) {
      lastCallRef.current.duration = callDuration;
    }

    if (status === "calling") {
      startOutgoingRing();
    } else if (status === "active" && prev && prev !== "active") {
      stopAllCallSounds();
      playConnectedSound();
    } else if (status === "idle" && prev && prev !== "idle") {
      stopAllCallSounds();
      if (prev === "active") {
        playEndedSound();
        // Auto-open call notes if call was > 10 seconds
        if (lastCallRef.current.duration > 10) {
          setCallNotesOpen(true);
        }
      }
    } else if (status !== "calling") {
      stopOutgoingRing();
    }

    return () => {
      if (status === "idle") stopAllCallSounds();
    };
  }, [status]);

  const persistentMedia = createPortal(
    <>
      <audio ref={hiddenAudioRef} autoPlay style={{ display: "none" }} />
      <Snackbar
        open={!!errorToast}
        autoHideDuration={5000}
        onClose={() => setErrorToast("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ zIndex: 10000 }}
      >
        <Alert severity="error" variant="filled" onClose={() => setErrorToast("")}>
          {errorToast}
        </Alert>
      </Snackbar>
    </>,
    document.body
  );

  if (!showOverlay) return persistentMedia;

  const withPersistent = (node) => (
    <>
      {persistentMedia}
      {node}
    </>
  );

  // ─── Calling / Connecting: floating card ─────────────────────────────────
  if (isCalling || isConnecting) {
    return withPersistent(createPortal(
      <Box
        sx={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          width: 320,
          bgcolor: theme.palette.background.paper,
          borderRadius: 4,
          boxShadow: "0 16px 64px rgba(0,0,0,0.3)",
          textAlign: "center",
          overflow: "hidden",
          animation: "fadeInScale 0.3s ease-out",
          "@keyframes fadeInScale": {
            from: { opacity: 0, transform: "translate(-50%, -50%) scale(0.9)" },
            to: { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
          },
        }}
      >
        {/* Gradient header */}
        <Box
          sx={{
            height: 80,
            background: isVideo
              ? "linear-gradient(135deg, #1976d2, #42a5f5)"
              : "linear-gradient(135deg, #2e7d32, #66bb6a)",
          }}
        />
        <Stack spacing={2} alignItems="center" sx={{ mt: -5, pb: 3, px: 3 }}>
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: isVideo ? "info.main" : "success.main",
              color: "#fff",
              fontSize: 28,
              border: `4px solid ${theme.palette.background.paper}`,
            }}
          >
            {(peerUserName || "?")[0].toUpperCase()}
          </Avatar>
          <Typography variant="h6" fontWeight={600}>
            {peerUserName || "User"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isCalling ? "Calling..." : "Connecting..."}
          </Typography>
          <IconButton
            onClick={endCall}
            sx={{
              bgcolor: "error.main",
              color: "#fff",
              width: 56,
              height: 56,
              "&:hover": { bgcolor: "error.dark" },
            }}
          >
            <PiPhoneSlash size={24} />
          </IconButton>
        </Stack>
      </Box>,
      document.body
    ));
  }

  // ─── Active: Minimized mode ──────────────────────────────────────────────
  if (minimized && isActive) {
    return withPersistent(createPortal(
      <Box
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          width: 280,
          bgcolor: "#1a1a2e",
          borderRadius: 3,
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          cursor: "pointer",
          animation: "slideUp 0.3s ease-out",
          "@keyframes slideUp": {
            from: { opacity: 0, transform: "translateY(20px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
        onClick={() => setMinimized(false)}
      >
        {/* Green accent bar on top */}
        <Box sx={{ height: 3, bgcolor: "#4caf50", width: "100%" }} />

        <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5, gap: 1.5 }}>
          {/* Pulsing green dot + phone icon */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "rgba(76,175,80,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "2px solid rgba(76,175,80,0.3)",
                animation: "ripple 2s ease-out infinite",
                "@keyframes ripple": {
                  "0%": { transform: "scale(1)", opacity: 1 },
                  "100%": { transform: "scale(1.5)", opacity: 0 },
                },
              }}
            />
            {isVideo ? (
              <PiVideoCamera size={18} color="#4caf50" />
            ) : (
              <PiPhone size={18} color="#4caf50" />
            )}
          </Box>

          {/* Name + timer */}
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" color="#fff" fontWeight={600} noWrap>
              {peerUserName || "User"}
            </Typography>
            <Typography variant="caption" sx={{ color: "#4caf50", fontWeight: 500 }}>
              {formatDuration(callDuration)}
            </Typography>
          </Stack>

          {/* Red end call button */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              endCall();
            }}
            sx={{
              bgcolor: "#f44336",
              color: "#fff",
              width: 36,
              height: 36,
              "&:hover": { bgcolor: "#d32f2f" },
            }}
          >
            <PiPhoneSlash size={18} />
          </IconButton>
        </Stack>
      </Box>,
      document.body
    ));
  }

  // ─── Active: Full call UI ────────────────────────────────────────────────
  if (isActive) {
    return withPersistent(createPortal(
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          bgcolor: "#111",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Main area */}
        <Box
          sx={{
            flex: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {/* Remote video / audio avatar */}
          {isVideo && remoteStream && !peerVideoOff ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <Stack spacing={2} alignItems="center">
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  fontSize: 48,
                  bgcolor: "primary.main",
                  color: "#fff",
                }}
              >
                {(peerUserName || "?")[0].toUpperCase()}
              </Avatar>
              <Typography variant="h5" color="#fff" fontWeight={600}>
                {peerUserName || "User"}
              </Typography>
              <Typography variant="h6" color="#aaa">
                {formatDuration(callDuration)}
              </Typography>
              {(peerMuted || peerVideoOff) && (
                <Stack direction="row" spacing={1} alignItems="center">
                  {peerMuted && (
                    <Stack direction="row" spacing={0.5} alignItems="center"
                      sx={{ bgcolor: "rgba(244,67,54,0.2)", px: 1.25, py: 0.5, borderRadius: 2 }}>
                      <PiMicrophoneSlash size={16} color="#f44336" />
                      <Typography variant="caption" color="#f44336" fontWeight={600}>muted</Typography>
                    </Stack>
                  )}
                  {isVideo && peerVideoOff && (
                    <Stack direction="row" spacing={0.5} alignItems="center"
                      sx={{ bgcolor: "rgba(244,67,54,0.2)", px: 1.25, py: 0.5, borderRadius: 2 }}>
                      <PiVideoCameraSlash size={16} color="#f44336" />
                      <Typography variant="caption" color="#f44336" fontWeight={600}>camera off</Typography>
                    </Stack>
                  )}
                </Stack>
              )}
              {/* Audio plays via persistent hidden element at root */}
            </Stack>
          )}

          {/* Local video PIP (video calls only) */}
          {isVideo && localStream && (
            <Box
              sx={{
                position: "absolute",
                bottom: 100,
                right: 24,
                width: 200,
                height: 150,
                borderRadius: 2,
                overflow: "hidden",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                border: "2px solid rgba(255,255,255,0.2)",
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scaleX(-1)",
                }}
              />
              {isVideoOff && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    bgcolor: "rgba(0,0,0,0.8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <PiVideoCameraSlash size={32} color="#fff" />
                </Box>
              )}
            </Box>
          )}

          {/* Timer overlay for video calls */}
          {isVideo && remoteStream && (
            <Box
              sx={{
                position: "absolute",
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                bgcolor: "rgba(0,0,0,0.6)",
                borderRadius: 2,
                px: 2,
                py: 0.5,
              }}
            >
              <Typography variant="body2" color="#fff" fontWeight={500}>
                {peerUserName} - {formatDuration(callDuration)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Call controls toolbar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            py: 3,
            bgcolor: "rgba(0,0,0,0.85)",
          }}
        >
          {/* Mute */}
          <Tooltip title={isMuted ? "Unmute" : "Mute"}>
            <IconButton
              onClick={toggleMute}
              sx={{
                width: 56,
                height: 56,
                bgcolor: isMuted ? "error.main" : "rgba(255,255,255,0.15)",
                color: "#fff",
                "&:hover": {
                  bgcolor: isMuted ? "error.dark" : "rgba(255,255,255,0.25)",
                },
              }}
            >
              {isMuted ? <PiMicrophoneSlash size={24} /> : <PiMicrophone size={24} />}
            </IconButton>
          </Tooltip>

          {/* Toggle video (only for video calls) */}
          {isVideo && (
            <Tooltip title={isVideoOff ? "Turn on camera" : "Turn off camera"}>
              <IconButton
                onClick={toggleVideo}
                sx={{
                  width: 56,
                  height: 56,
                  bgcolor: isVideoOff ? "error.main" : "rgba(255,255,255,0.15)",
                  color: "#fff",
                  "&:hover": {
                    bgcolor: isVideoOff ? "error.dark" : "rgba(255,255,255,0.25)",
                  },
                }}
              >
                {isVideoOff ? <PiVideoCameraSlash size={24} /> : <PiVideoCamera size={24} />}
              </IconButton>
            </Tooltip>
          )}

          {/* End call */}
          <Tooltip title="End call">
            <IconButton
              onClick={endCall}
              sx={{
                width: 64,
                height: 64,
                bgcolor: "error.main",
                color: "#fff",
                "&:hover": { bgcolor: "error.dark" },
              }}
            >
              <PiPhoneSlash size={28} />
            </IconButton>
          </Tooltip>

          {/* Minimize */}
          <Tooltip title="Minimize">
            <IconButton
              onClick={() => setMinimized(true)}
              sx={{
                width: 56,
                height: 56,
                bgcolor: "rgba(255,255,255,0.15)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
              }}
            >
              <PiArrowsIn size={24} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>,
      document.body
    ));
  }

  // Show call notes dialog even when overlay is hidden (call ended)
  if (callNotesOpen) {
    return withPersistent(
      <CallNotesDialog
        open={callNotesOpen}
        onClose={() => setCallNotesOpen(false)}
        callDuration={lastCallRef.current.duration}
        peerUserName={lastCallRef.current.peerName}
        chatContext={[]}
      />
    );
  }

  return persistentMedia;
};

export default CallOverlay;
