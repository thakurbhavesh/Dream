import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  PiMonitor,
  PiX,
  PiArrowsOut,
  PiArrowsIn,
  PiPencilSimple,
  PiCursor,
  PiStop,
} from "react-icons/pi";
import { useScreenShareContext } from "../../contexts/ScreenShareContext.jsx";
import AnnotationCanvas from "./AnnotationCanvas.jsx";
import AnnotationToolbar from "./AnnotationToolbar.jsx";

const ScreenShareOverlay = () => {
  const theme = useTheme();
  const {
    status,
    role,
    peerUserName,
    remoteStream,
    stopScreenShare,
    annotationMode,
    setAnnotationMode,
    controlStatus,
    requestControl,
    grantControl,
    revokeControl,
    sendDataChannelMessage,
    setDataChannelListener,
  } = useScreenShareContext();

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [selectedTool, setSelectedTool] = useState("pen");
  const [selectedColor, setSelectedColor] = useState("#FF0000");
  const [selectedWidth, setSelectedWidth] = useState(3);
  const [remoteAnnotations, setRemoteAnnotations] = useState([]);
  const [remotePointer, setRemotePointer] = useState(null);

  const isActive = status === "active";
  const isConnecting = status === "connecting" || status === "accepted";
  const showOverlay = isActive || isConnecting;

  // Set video srcObject when remote stream changes
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(() => {});
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [remoteStream]);

  // ESC key to stop
  useEffect(() => {
    if (!showOverlay) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") stopScreenShare();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showOverlay, stopScreenShare]);

  // DataChannel listener for annotations + pointer
  useEffect(() => {
    if (!isActive) return;
    setDataChannelListener((msg) => {
      if (msg.type === "annotation") {
        if (msg.payload?.type === "clear") {
          setRemoteAnnotations([]);
        } else {
          setRemoteAnnotations((prev) => [...prev, msg.payload]);
        }
      } else if (msg.type === "pointer") {
        setRemotePointer(msg.payload);
      }
    });
    return () => setDataChannelListener(null);
  }, [isActive, setDataChannelListener]);

  const handleSendAnnotation = useCallback(
    (annotation) => {
      sendDataChannelMessage({ type: "annotation", payload: annotation });
    },
    [sendDataChannelMessage]
  );

  const handleSendPointer = useCallback(
    (position) => {
      sendDataChannelMessage({ type: "pointer", payload: position });
    },
    [sendDataChannelMessage]
  );

  const handleClearAnnotations = useCallback(() => {
    setRemoteAnnotations([]);
    sendDataChannelMessage({
      type: "annotation",
      payload: { type: "clear" },
    });
  }, [sendDataChannelMessage]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  if (!showOverlay) return null;

  // ─── Sender: small floating indicator ──────────────────────────────────────
  if (role === "sender" && isActive) {
    return createPortal(
      <Box
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          bgcolor: theme.palette.primary.main,
          color: "#fff",
          borderRadius: 3,
          px: 2.5,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          animation: "slideUp 0.3s ease-out",
          "@keyframes slideUp": {
            from: { opacity: 0, transform: "translateY(20px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        <PiMonitor size={20} />
        <Typography variant="body2" fontWeight={600} noWrap>
          Sharing screen with {peerUserName || "user"}
        </Typography>
        {controlStatus === "requesting" && (
          <Stack direction="row" spacing={0.5}>
            <Chip
              label="Control requested"
              size="small"
              sx={{ color: "#fff", borderColor: "#fff" }}
              variant="outlined"
            />
            <Button
              size="small"
              variant="outlined"
              sx={{ color: "#fff", borderColor: "#fff", minWidth: 0, px: 1 }}
              onClick={grantControl}
            >
              Allow
            </Button>
            <Button
              size="small"
              variant="outlined"
              sx={{ color: "#fff", borderColor: "#fff", minWidth: 0, px: 1 }}
              onClick={revokeControl}
            >
              Deny
            </Button>
          </Stack>
        )}
        {controlStatus === "granted" && (
          <Button
            size="small"
            variant="outlined"
            sx={{ color: "#fff", borderColor: "#fff" }}
            onClick={revokeControl}
          >
            Revoke Control
          </Button>
        )}
        <Button
          size="small"
          variant="contained"
          color="error"
          startIcon={<PiStop />}
          onClick={stopScreenShare}
          sx={{ ml: 1 }}
        >
          Stop
        </Button>
      </Box>,
      document.body
    );
  }

  // ─── Viewer: fullscreen overlay ────────────────────────────────────────────
  if (role === "viewer") {
    // Minimized mode
    if (minimized && isActive) {
      return createPortal(
        <Box
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 320,
            borderRadius: 2,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            cursor: "pointer",
          }}
          onClick={() => setMinimized(false)}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: "100%", display: "block" }}
          />
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              bgcolor: "rgba(0,0,0,0.7)",
              color: "#fff",
              px: 1.5,
              py: 0.75,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="caption" noWrap>
              {peerUserName}'s screen
            </Typography>
            <IconButton
              size="small"
              sx={{ color: "#fff" }}
              onClick={(e) => {
                e.stopPropagation();
                stopScreenShare();
              }}
            >
              <PiX size={16} />
            </IconButton>
          </Box>
        </Box>,
        document.body
      );
    }

    // Full overlay
    return createPortal(
      <Box
        ref={containerRef}
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
          bgcolor: "#000",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Toolbar */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
            bgcolor: "rgba(0,0,0,0.85)",
            color: "#fff",
            zIndex: 2,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <PiMonitor size={18} />
            <Typography variant="body2" fontWeight={600}>
              {peerUserName || "User"}'s Screen
            </Typography>
            {isConnecting && (
              <Chip label="Connecting..." size="small" color="warning" />
            )}
          </Stack>
          <Stack direction="row" spacing={0.5}>
            {isActive && (
              <>
                <Tooltip title={annotationMode ? "Exit Annotate" : "Annotate"}>
                  <IconButton
                    sx={{
                      color: annotationMode
                        ? theme.palette.primary.main
                        : "#fff",
                    }}
                    onClick={() => setAnnotationMode(!annotationMode)}
                  >
                    <PiPencilSimple size={18} />
                  </IconButton>
                </Tooltip>
                {controlStatus === "none" && (
                  <Tooltip title="Request Control">
                    <IconButton sx={{ color: "#fff" }} onClick={requestControl}>
                      <PiCursor size={18} />
                    </IconButton>
                  </Tooltip>
                )}
                {controlStatus === "requesting" && (
                  <Chip
                    label="Control requested..."
                    size="small"
                    sx={{ color: "#fff" }}
                    variant="outlined"
                  />
                )}
                {controlStatus === "granted" && (
                  <Chip
                    label="You have control"
                    size="small"
                    color="success"
                  />
                )}
              </>
            )}
            <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              <IconButton sx={{ color: "#fff" }} onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <PiArrowsIn size={18} />
                ) : (
                  <PiArrowsOut size={18} />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Minimize">
              <IconButton
                sx={{ color: "#fff" }}
                onClick={() => setMinimized(true)}
              >
                <PiArrowsIn size={18} />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<PiStop />}
              onClick={stopScreenShare}
              sx={{ ml: 1 }}
            >
              Stop
            </Button>
          </Stack>
        </Box>

        {/* Video + Annotation Canvas */}
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
          {isConnecting && (
            <Stack spacing={2} alignItems="center">
              <PiMonitor size={48} color="#fff" />
              <Typography color="#fff" variant="h6">
                Connecting...
              </Typography>
            </Stack>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: isActive ? "block" : "none",
            }}
          />
          {isActive && (
            <AnnotationCanvas
              active={annotationMode}
              tool={selectedTool}
              color={selectedColor}
              width={selectedWidth}
              onSendAnnotation={handleSendAnnotation}
              onSendPointer={handleSendPointer}
              remoteAnnotations={remoteAnnotations}
              remotePointer={remotePointer}
              videoRef={videoRef}
            />
          )}
        </Box>

        {/* Annotation Toolbar */}
        {annotationMode && isActive && (
          <AnnotationToolbar
            tool={selectedTool}
            color={selectedColor}
            width={selectedWidth}
            onToolChange={setSelectedTool}
            onColorChange={setSelectedColor}
            onWidthChange={setSelectedWidth}
            onClear={handleClearAnnotations}
            onClose={() => setAnnotationMode(false)}
          />
        )}
      </Box>,
      document.body
    );
  }

  // Sender connecting state
  if (role === "sender" && isConnecting) {
    return createPortal(
      <Box
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          bgcolor: theme.palette.warning.main,
          color: "#fff",
          borderRadius: 3,
          px: 2.5,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <PiMonitor size={20} />
        <Typography variant="body2" fontWeight={600}>
          Connecting screen share...
        </Typography>
        <Button
          size="small"
          variant="outlined"
          sx={{ color: "#fff", borderColor: "#fff" }}
          onClick={stopScreenShare}
        >
          Cancel
        </Button>
      </Box>,
      document.body
    );
  }

  return null;
};

export default ScreenShareOverlay;
