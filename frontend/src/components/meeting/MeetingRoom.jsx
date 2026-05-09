import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Avatar,
  Badge,
  Drawer,
  TextField,
  InputAdornment,
  Chip,
  useTheme,
  Fade,
  Paper,
  Divider,
  Button,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  PiMicrophoneBold,
  PiMicrophoneSlashBold,
  PiVideoCameraBold,
  PiVideoCameraSlashBold,
  PiScreencastBold,
  PiPhoneDisconnectBold,
  PiChatCircleBold,
  PiHandBold,
  PiPaperPlaneRightBold,
  PiGridFourBold,
  PiUserFocusBold,
  PiPushPinBold,
  PiSmileyBold,
  PiCopyBold,
  PiUsersBold,
  PiXBold,
  PiPictureInPictureBold,
  PiLockBold,
  PiLockOpenBold,
} from "react-icons/pi";
import { useMeetingContext } from "../../contexts/MeetingContext.jsx";

// ─── Video tile for a single participant ──────────────────────────
const VideoTile = ({ stream, userName, isMuted, isVideoOff, isLocal, isScreenShare, isPinned, onPin, handRaised }) => {
  const videoRef = useRef(null);
  const theme = useTheme();
  const [pipSupported, setPipSupported] = useState(false);
  const [inPip, setInPip] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream, isVideoOff, isScreenShare]);

  useEffect(() => {
    setPipSupported(typeof document !== "undefined" && document.pictureInPictureEnabled);
  }, []);

  useEffect(() => {
    const onEnter = () => setInPip(true);
    const onLeave = () => setInPip(false);
    const v = videoRef.current;
    if (!v) return;
    v.addEventListener("enterpictureinpicture", onEnter);
    v.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      v.removeEventListener("enterpictureinpicture", onEnter);
      v.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [stream]);

  const togglePip = async (e) => {
    e?.stopPropagation?.();
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement === videoRef.current) {
        await document.exitPictureInPicture();
      } else if (videoRef.current.requestPictureInPicture) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("[meeting] PiP request rejected:", err.message);
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "#1a1a2e",
        border: isPinned ? `2px solid ${theme.palette.primary.main}` : "2px solid transparent",
        aspectRatio: "16/9",
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: onPin ? "pointer" : "default",
      }}
      onClick={onPin}
    >
      {stream && !isVideoOff ? (
        <Box
          component="video"
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          sx={{
            width: "100%",
            height: "100%",
            // Screen share: contain so the entire shared screen is visible.
            // Camera: cover so faces fill the tile without letterboxing.
            objectFit: isScreenShare ? "contain" : "cover",
            backgroundColor: isScreenShare ? "#000" : "transparent",
            transform: isLocal && !isScreenShare ? "scaleX(-1)" : "none",
          }}
        />
      ) : (
        <Avatar
          sx={{
            width: 64,
            height: 64,
            fontSize: 28,
            bgcolor: theme.palette.primary.main,
          }}
        >
          {(userName || "U").charAt(0).toUpperCase()}
        </Avatar>
      )}

      {/* Bottom bar */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          px: 1,
          py: 0.5,
          background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
        }}
      >
        {isMuted && <PiMicrophoneSlashBold size={14} color="#f44336" />}
        {isScreenShare && <PiScreencastBold size={14} color="#4caf50" />}
        <Typography variant="caption" sx={{ color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isLocal ? `${userName} (You)` : userName}
        </Typography>
        {isPinned && <PiPushPinBold size={12} color={theme.palette.primary.light} />}
      </Stack>

      {/* Picture-in-Picture toggle (web only — only when stream visible & not local own tile) */}
      {stream && !isVideoOff && pipSupported && !isLocal && (
        <Tooltip title={inPip ? "Exit Picture-in-Picture" : "Picture-in-Picture"} placement="left">
          <IconButton
            size="small"
            onClick={togglePip}
            sx={{
              position: "absolute",
              top: 8,
              left: 8,
              bgcolor: "rgba(0,0,0,0.55)",
              color: "#fff",
              p: 0.6,
              "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
            }}
          >
            <PiPictureInPictureBold size={14} />
          </IconButton>
        </Tooltip>
      )}

      {/* Hand raised indicator */}
      {handRaised && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            fontSize: 24,
            animation: "bounce 1s infinite",
            "@keyframes bounce": {
              "0%, 100%": { transform: "translateY(0)" },
              "50%": { transform: "translateY(-6px)" },
            },
          }}
        >
          &#9995;
        </Box>
      )}
    </Box>
  );
};

// ─── Reaction overlay ──────────────────────────────────────────────
const EMOJI_MAP = {
  "thumbs-up": "\uD83D\uDC4D",
  "clap": "\uD83D\uDC4F",
  "heart": "\u2764\uFE0F",
  "laugh": "\uD83D\uDE02",
  "surprised": "\uD83D\uDE2E",
  "fire": "\uD83D\uDD25",
  "hand-raise": "\u270B",
  "hand-lower": "",
};

const ReactionOverlay = ({ reactions }) => (
  <>
    {/* Top-right name list (existing) */}
    <Box sx={{ position: "absolute", top: 80, right: 20, zIndex: 100, pointerEvents: "none" }}>
      {reactions.map((r) => (
        <Fade in key={r.id}>
          <Paper
            elevation={3}
            sx={{
              px: 1.5, py: 0.5, mb: 0.5, display: "flex", alignItems: "center", gap: 0.5,
              borderRadius: 4, bgcolor: "rgba(0,0,0,0.7)", color: "#fff",
            }}
          >
            <Typography variant="body1">{EMOJI_MAP[r.reaction] || r.reaction}</Typography>
            <Typography variant="caption">{r.userName}</Typography>
          </Paper>
        </Fade>
      ))}
    </Box>
    {/* Floating emoji burst — rises from bottom and fades, like Zoom/Meet */}
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 95,
        pointerEvents: "none",
        overflow: "hidden",
        "@keyframes meetingReactionFloat": {
          "0%": { transform: "translate3d(0, 40px, 0) scale(0.6)", opacity: 0 },
          "10%": { opacity: 1 },
          "60%": { transform: "translate3d(0, -180px, 0) scale(1.1)", opacity: 1 },
          "100%": { transform: "translate3d(0, -360px, 0) scale(0.85)", opacity: 0 },
        },
      }}
    >
      {reactions
        .filter((r) => r.reaction !== "hand-raise" && r.reaction !== "hand-lower")
        .map((r) => {
          // Stable random offset per reaction id so emojis spread across the bottom
          const offsetSeed = String(r.id).split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
          const left = 18 + (offsetSeed % 65); // 18% .. 83%
          const drift = ((offsetSeed * 7) % 21) - 10; // -10px .. +10px horizontal sway
          return (
            <Box
              key={`float-${r.id}`}
              sx={{
                position: "absolute",
                bottom: 110,
                left: `${left}%`,
                fontSize: 38,
                lineHeight: 1,
                animation: "meetingReactionFloat 2.6s ease-out forwards",
                transform: `translateX(${drift}px)`,
                textShadow: "0 4px 16px rgba(0,0,0,0.45)",
              }}
            >
              {EMOJI_MAP[r.reaction] || r.reaction}
            </Box>
          );
        })}
    </Box>
  </>
);

// ─── Chat Drawer ───────────────────────────────────────────────────
const ChatPanel = ({ open, onClose, messages, onSend, myUserId }) => {
  const [text, setText] = useState("");
  const listRef = useRef(null);
  const theme = useTheme();

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      PaperProps={{
        sx: {
          width: 320,
          bgcolor: theme.palette.background.paper,
          borderLeft: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <Stack sx={{ height: "100%" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={600}>Meeting Chat</Typography>
          <IconButton size="small" onClick={onClose}>
            <PiXBold size={16} />
          </IconButton>
        </Stack>
        <Divider />
        <Stack ref={listRef} sx={{ flex: 1, overflow: "auto", px: 2, py: 1, gap: 1 }}>
          {messages.map((msg) => {
            const isMe = String(msg.userId) === String(myUserId);
            return (
              <Stack
                key={msg.id}
                alignItems={isMe ? "flex-end" : "flex-start"}
              >
                {!isMe && (
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.25 }}>
                    {msg.userName}
                  </Typography>
                )}
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    bgcolor: isMe ? "primary.main" : theme.palette.action.hover,
                    color: isMe ? "#fff" : "text.primary",
                    maxWidth: "85%",
                    wordBreak: "break-word",
                  }}
                >
                  <Typography variant="body2">{msg.message}</Typography>
                </Box>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25 }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Typography>
              </Stack>
            );
          })}
          {messages.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
              No messages yet
            </Typography>
          )}
        </Stack>
        <Divider />
        <Stack direction="row" alignItems="center" sx={{ p: 1, gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <IconButton color="primary" onClick={handleSend} disabled={!text.trim()}>
            <PiPaperPlaneRightBold size={20} />
          </IconButton>
        </Stack>
      </Stack>
    </Drawer>
  );
};

// ─── Participants Panel ────────────────────────────────────────────
const ParticipantsPanel = ({
  open,
  onClose,
  participants,
  localUserName,
  isHost,
  onMuteAll,
  onRemove,
  spotlightSocketId,
  onSpotlight,
}) => {
  const theme = useTheme();
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      PaperProps={{
        sx: { width: 280, bgcolor: theme.palette.background.paper, borderLeft: `1px solid ${theme.palette.divider}` },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Participants ({participants.length + 1})
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <PiXBold size={16} />
        </IconButton>
      </Stack>
      {isHost && participants.length > 0 && (
        <>
          <Divider />
          <Stack sx={{ px: 2, py: 1 }}>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<PiMicrophoneSlashBold size={14} />}
              onClick={onMuteAll}
              sx={{ textTransform: "none" }}
            >
              Mute everyone
            </Button>
          </Stack>
        </>
      )}
      <Divider />
      <Stack sx={{ px: 2, py: 1, gap: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
          <Avatar sx={{ width: 28, height: 28, fontSize: 14, bgcolor: "primary.main" }}>
            {(localUserName || "Y").charAt(0)}
          </Avatar>
          <Typography variant="body2" sx={{ flex: 1 }}>{localUserName} (You){isHost ? " • Host" : ""}</Typography>
        </Stack>
        {participants.map((p) => {
          const isSpotlight = spotlightSocketId === p.socketId;
          return (
            <Stack key={p.socketId} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
              <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>
                {(p.userName || "U").charAt(0)}
              </Avatar>
              <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                {p.userName}{isSpotlight ? " • Spotlight" : ""}
              </Typography>
              {!p.audio && <PiMicrophoneSlashBold size={14} color="#f44336" />}
              {p.handRaised && <Box component="span" sx={{ fontSize: 14 }}>&#9995;</Box>}
              {isHost && (
                <>
                  <Tooltip title={isSpotlight ? "Clear spotlight" : "Spotlight for everyone"}>
                    <IconButton
                      size="small"
                      onClick={() => onSpotlight?.(isSpotlight ? null : p.socketId)}
                      sx={{ p: 0.5, color: isSpotlight ? "primary.main" : "inherit" }}
                    >
                      <PiPushPinBold size={12} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove participant">
                    <IconButton size="small" onClick={() => onRemove?.(p.socketId)} sx={{ p: 0.5 }}>
                      <PiXBold size={12} />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Drawer>
  );
};

// ─── Main MeetingRoom ──────────────────────────────────────────────
const MeetingRoom = ({ userName, userId, onLeave }) => {
  const theme = useTheme();
  const meeting = useMeetingContext();
  const [chatOpen, setChatOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Auto-close when meeting goes idle, but ONLY if the host didn't end it.
  // If endedByHost is set, we keep the room mounted so the user sees a
  // "Meeting has ended" overlay; tapping the dismiss button leaves the room.
  useEffect(() => {
    if (meeting.status === "idle" && !meeting.endedByHost) {
      onLeave?.();
    }
  }, [meeting.status, meeting.endedByHost, onLeave]);

  // Auto-pin a remote participant when they start screen sharing.
  // Unpin them when they stop. Local user sharing is handled separately
  // via the showLocalScreenAsPrimary branch in the layout below.
  useEffect(() => {
    const sharer = meeting.participants.find((p) => p.screenShare);
    if (sharer && meeting.pinnedSocketId !== sharer.socketId) {
      meeting.pinParticipant(sharer.socketId);
      meeting.setViewMode("speaker");
    } else if (!sharer && meeting.pinnedSocketId) {
      // If the pinned participant was sharing and stopped, unpin
      const pinned = meeting.participants.find(
        (p) => p.socketId === meeting.pinnedSocketId
      );
      if (pinned && pinned.screenShare === false) {
        meeting.pinParticipant(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.participants.map((p) => `${p.socketId}:${p.screenShare}`).join(",")]);

  // Track unread when chat is closed
  useEffect(() => {
    if (!chatOpen && meeting.chatMessages.length > 0) {
      setUnreadCount((prev) => prev + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.chatMessages.length]);

  const handleOpenChat = () => {
    setChatOpen(true);
    setParticipantsOpen(false);
    setUnreadCount(0);
  };

  const handleOpenParticipants = () => {
    setParticipantsOpen(true);
    setChatOpen(false);
  };

  const handleLeave = () => {
    meeting.leaveMeeting();
    onLeave?.();
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const copyMeetingId = useCallback(() => {
    if (meeting.meetingRoomId) {
      navigator.clipboard.writeText(meeting.meetingRoomId);
    }
  }, [meeting.meetingRoomId]);

  // Effective pin: host-set spotlight always wins over personal pin.
  const effectivePinnedSocketId = meeting.spotlightSocketId || meeting.pinnedSocketId;

  // Determine grid layout
  const totalParticipants = meeting.participants.length + 1; // +1 for local
  const getGridCols = () => {
    if (effectivePinnedSocketId || meeting.viewMode === "speaker") return 1;
    if (totalParticipants <= 1) return 1;
    if (totalParticipants <= 4) return 2;
    if (totalParticipants <= 9) return 3;
    return 4;
  };

  const gridCols = getGridCols();
  // Promote local screen share to the main area so the sharer sees their
  // own screen big (and other tiles move to the sidebar). This activates
  // even when no remote participant is pinned.
  const showLocalScreenAsPrimary =
    meeting.isScreenSharing && meeting.viewMode !== "gallery";
  const showingPinned =
    (effectivePinnedSocketId && meeting.viewMode !== "gallery") ||
    showLocalScreenAsPrimary;

  // Build tiles array — spotlight overrides personal pin
  const pinnedParticipant = meeting.participants.find((p) => p.socketId === effectivePinnedSocketId);

  const reactionEmojis = [
    { key: "thumbs-up", label: "\uD83D\uDC4D" },
    { key: "clap", label: "\uD83D\uDC4F" },
    { key: "heart", label: "\u2764\uFE0F" },
    { key: "laugh", label: "\uD83D\uDE02" },
    { key: "fire", label: "\uD83D\uDD25" },
  ];
  const [showReactions, setShowReactions] = useState(false);

  // Meeting was ended by the host — render a centered notice instead of
  // disappearing silently. Dismiss returns the user to the meetings page.
  if (meeting.status === "idle" && meeting.endedByHost) {
    const handleDismiss = () => {
      meeting.dismissEndedNotice?.();
      onLeave?.();
    };
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1400,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(10, 14, 26, 0.92)",
          p: 3,
        }}
      >
        <Paper
          elevation={4}
          sx={{
            maxWidth: 420,
            width: "100%",
            p: 4,
            borderRadius: 3,
            textAlign: "center",
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              mx: "auto",
              mb: 2,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: alpha(theme.palette.error.main, 0.12),
            }}
          >
            <PiPhoneDisconnectBold size={28} color={theme.palette.error.main} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Meeting has ended
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
            The host ended this meeting. The invite link is no longer active —
            anyone who tries to join with the same code will see an "ended" notice.
          </Typography>
          <Button
            variant="contained"
            onClick={handleDismiss}
            sx={{ minWidth: 140, textTransform: "none", borderRadius: 2 }}
          >
            Got it
          </Button>
        </Paper>
      </Box>
    );
  }

  // If meeting is idle for any other reason (user left, never joined), don't render
  if (meeting.status === "idle") return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        bgcolor: "#0d1117",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ─── Top bar ─────────────────────────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2,
          py: 1,
          bgcolor: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          zIndex: 10,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: 600 }}>
            {meeting.meetingInfo?.title || "Meeting"}
          </Typography>
          <Chip
            size="small"
            label={meeting.meetingRoomId}
            onClick={copyMeetingId}
            icon={<PiCopyBold size={12} />}
            sx={{ color: "#ccc", borderColor: "#555", cursor: "pointer" }}
            variant="outlined"
          />
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip
            size="small"
            label={formatDuration(meeting.duration)}
            sx={{ color: "#4caf50", borderColor: "#4caf50", fontFamily: "monospace" }}
            variant="outlined"
          />
          <Chip
            size="small"
            label={`${totalParticipants} participant${totalParticipants > 1 ? "s" : ""}`}
            sx={{ color: "#ccc", borderColor: "#555" }}
            variant="outlined"
          />
        </Stack>
      </Stack>

      {/* ─── Video Grid ──────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          p: 1,
          mr: chatOpen || participantsOpen ? "320px" : 0,
          transition: "margin-right 0.3s ease",
        }}
      >
        {showingPinned && (pinnedParticipant || showLocalScreenAsPrimary) ? (
          // Pinned / Speaker view (also covers local screen share)
          <Stack direction="row" sx={{ width: "100%", height: "100%", gap: 1 }}>
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {showLocalScreenAsPrimary ? (
                <VideoTile
                  stream={meeting.screenStream}
                  userName={userName}
                  isMuted={meeting.isMuted}
                  isVideoOff={false}
                  isLocal
                  isScreenShare
                  isPinned
                />
              ) : (
                <VideoTile
                  stream={pinnedParticipant.stream}
                  userName={pinnedParticipant.userName}
                  isMuted={!pinnedParticipant.audio}
                  isVideoOff={!pinnedParticipant.video}
                  isScreenShare={pinnedParticipant.screenShare}
                  isPinned
                  handRaised={pinnedParticipant.handRaised}
                />
              )}
            </Box>
            <Stack sx={{ width: 200, gap: 1, overflow: "auto" }}>
              {/* Local camera tile (only show in sidebar when NOT showing it as primary) */}
              {!showLocalScreenAsPrimary && (
                <VideoTile
                  stream={meeting.localStream}
                  userName={userName}
                  isMuted={meeting.isMuted}
                  isVideoOff={meeting.isVideoOff}
                  isLocal
                  isScreenShare={false}
                  onPin={() => meeting.pinParticipant(null)}
                />
              )}
              {/* When local IS sharing, still show local camera (if on) in sidebar */}
              {showLocalScreenAsPrimary && !meeting.isVideoOff && meeting.localStream && (
                <VideoTile
                  stream={meeting.localStream}
                  userName={userName}
                  isMuted={meeting.isMuted}
                  isVideoOff={false}
                  isLocal
                  isScreenShare={false}
                />
              )}
              {meeting.participants
                .filter((p) => p.socketId !== effectivePinnedSocketId)
                .map((p) => (
                  <VideoTile
                    key={p.socketId}
                    stream={p.stream}
                    userName={p.userName}
                    isMuted={!p.audio}
                    isVideoOff={!p.video}
                    isScreenShare={p.screenShare}
                    onPin={() => meeting.pinParticipant(p.socketId)}
                    handRaised={p.handRaised}
                  />
                ))}
            </Stack>
          </Stack>
        ) : (
          // Gallery view
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "grid",
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gap: 1,
              alignContent: "center",
              p: 1,
            }}
          >
            {/* Local video */}
            <VideoTile
              stream={meeting.isScreenSharing ? meeting.screenStream : meeting.localStream}
              userName={userName}
              isMuted={meeting.isMuted}
              isVideoOff={meeting.isVideoOff && !meeting.isScreenSharing}
              isLocal
              isScreenShare={meeting.isScreenSharing}
              isPinned={false}
              onPin={() => {}}
              handRaised={meeting.handRaised}
            />
            {/* Remote participants */}
            {meeting.participants.map((p) => (
              <VideoTile
                key={p.socketId}
                stream={p.stream}
                userName={p.userName}
                isMuted={!p.audio}
                isVideoOff={!p.video}
                isScreenShare={p.screenShare}
                isPinned={effectivePinnedSocketId === p.socketId}
                onPin={() => meeting.pinParticipant(p.socketId)}
                handRaised={p.handRaised}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* ─── Reactions overlay ───────────────────────────── */}
      <ReactionOverlay reactions={meeting.reactions} />

      {/* ─── Reaction picker (above control bar) ─────────── */}
      {showReactions && (
        <Fade in>
          <Paper
            elevation={8}
            sx={{
              position: "absolute",
              bottom: 80,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 0.5,
              px: 1.5,
              py: 0.75,
              borderRadius: 6,
              bgcolor: "rgba(30,30,30,0.95)",
              zIndex: 20,
            }}
          >
            {reactionEmojis.map((r) => (
              <IconButton
                key={r.key}
                size="small"
                onClick={() => { meeting.sendReaction(r.key); setShowReactions(false); }}
                sx={{ fontSize: 24, "&:hover": { transform: "scale(1.3)" }, transition: "transform 0.15s" }}
              >
                {r.label}
              </IconButton>
            ))}
          </Paper>
        </Fade>
      )}

      {/* ─── Bottom control bar ──────────────────────────── */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        spacing={1}
        sx={{
          py: 1.5,
          px: 2,
          bgcolor: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Mic */}
        <Tooltip title={meeting.isMuted ? "Unmute" : "Mute"}>
          <IconButton
            onClick={meeting.toggleMute}
            sx={{
              width: 48, height: 48, borderRadius: "50%",
              bgcolor: meeting.isMuted ? "#f44336" : "rgba(255,255,255,0.1)",
              color: "#fff",
              "&:hover": { bgcolor: meeting.isMuted ? "#d32f2f" : "rgba(255,255,255,0.2)" },
            }}
          >
            {meeting.isMuted ? <PiMicrophoneSlashBold size={22} /> : <PiMicrophoneBold size={22} />}
          </IconButton>
        </Tooltip>

        {/* Video */}
        <Tooltip title={meeting.isVideoOff ? "Turn on camera" : "Turn off camera"}>
          <IconButton
            onClick={meeting.toggleVideo}
            sx={{
              width: 48, height: 48, borderRadius: "50%",
              bgcolor: meeting.isVideoOff ? "#f44336" : "rgba(255,255,255,0.1)",
              color: "#fff",
              "&:hover": { bgcolor: meeting.isVideoOff ? "#d32f2f" : "rgba(255,255,255,0.2)" },
            }}
          >
            {meeting.isVideoOff ? <PiVideoCameraSlashBold size={22} /> : <PiVideoCameraBold size={22} />}
          </IconButton>
        </Tooltip>

        {/* Screen Share */}
        <Tooltip title={meeting.isScreenSharing ? "Stop sharing" : "Share screen"}>
          <IconButton
            onClick={meeting.toggleScreenShare}
            sx={{
              width: 48, height: 48, borderRadius: "50%",
              bgcolor: meeting.isScreenSharing ? "#4caf50" : "rgba(255,255,255,0.1)",
              color: "#fff",
              "&:hover": { bgcolor: meeting.isScreenSharing ? "#388e3c" : "rgba(255,255,255,0.2)" },
            }}
          >
            <PiScreencastBold size={22} />
          </IconButton>
        </Tooltip>

        {/* Reactions */}
        <Tooltip title="Reactions">
          <IconButton
            onClick={() => setShowReactions((p) => !p)}
            sx={{
              width: 48, height: 48, borderRadius: "50%",
              bgcolor: showReactions ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
              color: "#fff",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
            }}
          >
            <PiSmileyBold size={22} />
          </IconButton>
        </Tooltip>

        {/* Hand Raise */}
        <Tooltip title={meeting.handRaised ? "Lower hand" : "Raise hand"}>
          <IconButton
            onClick={meeting.toggleHandRaise}
            sx={{
              width: 48, height: 48, borderRadius: "50%",
              bgcolor: meeting.handRaised ? "#ff9800" : "rgba(255,255,255,0.1)",
              color: "#fff",
              "&:hover": { bgcolor: meeting.handRaised ? "#f57c00" : "rgba(255,255,255,0.2)" },
            }}
          >
            <PiHandBold size={22} />
          </IconButton>
        </Tooltip>

        {/* Chat */}
        <Tooltip title="Chat">
          <IconButton
            onClick={handleOpenChat}
            sx={{
              width: 48, height: 48, borderRadius: "50%",
              bgcolor: chatOpen ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
              color: "#fff",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
            }}
          >
            <Badge badgeContent={unreadCount} color="error" max={99}>
              <PiChatCircleBold size={22} />
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Participants */}
        <Tooltip title="Participants">
          <IconButton
            onClick={handleOpenParticipants}
            sx={{
              width: 48, height: 48, borderRadius: "50%",
              bgcolor: participantsOpen ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
              color: "#fff",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
            }}
          >
            <PiUsersBold size={22} />
          </IconButton>
        </Tooltip>

        {/* View Toggle */}
        <Tooltip title={meeting.viewMode === "gallery" ? "Speaker view" : "Gallery view"}>
          <IconButton
            onClick={() => meeting.setViewMode(meeting.viewMode === "gallery" ? "speaker" : "gallery")}
            sx={{
              width: 48, height: 48, borderRadius: "50%",
              bgcolor: "rgba(255,255,255,0.1)",
              color: "#fff",
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
            }}
          >
            {meeting.viewMode === "gallery" ? <PiUserFocusBold size={22} /> : <PiGridFourBold size={22} />}
          </IconButton>
        </Tooltip>

        {/* Lock meeting (host only) */}
        {Number(meeting.meetingInfo?.host_id) === Number(userId) && (
          <Tooltip title={meeting.isLocked ? "Unlock meeting (allow joins)" : "Lock meeting (block new joins)"}>
            <IconButton
              onClick={() => meeting.setLocked(!meeting.isLocked)}
              sx={{
                width: 48, height: 48, borderRadius: "50%",
                bgcolor: meeting.isLocked ? "rgba(244, 67, 54, 0.2)" : "rgba(255,255,255,0.1)",
                color: meeting.isLocked ? "#f44336" : "#fff",
                "&:hover": { bgcolor: meeting.isLocked ? "rgba(244, 67, 54, 0.3)" : "rgba(255,255,255,0.2)" },
              }}
            >
              {meeting.isLocked ? <PiLockBold size={22} /> : <PiLockOpenBold size={22} />}
            </IconButton>
          </Tooltip>
        )}

        {/* Leave */}
        <Tooltip title="Leave meeting">
          <IconButton
            onClick={handleLeave}
            sx={{
              width: 56, height: 48, borderRadius: 6,
              bgcolor: "#f44336",
              color: "#fff",
              ml: 2,
              "&:hover": { bgcolor: "#d32f2f" },
            }}
          >
            <PiPhoneDisconnectBold size={24} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ─── Side panels ──────────────────────────────────── */}
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={meeting.chatMessages}
        onSend={meeting.sendChatMessage}
        myUserId={userId}
      />
      <ParticipantsPanel
        open={participantsOpen}
        onClose={() => setParticipantsOpen(false)}
        participants={meeting.participants}
        localUserName={userName}
        isHost={Number(meeting.meetingInfo?.host_id) === Number(userId)}
        onMuteAll={meeting.muteAll}
        onRemove={meeting.removeParticipant}
        spotlightSocketId={meeting.spotlightSocketId}
        onSpotlight={meeting.spotlight}
      />
    </Box>
  );
};

export default MeetingRoom;
