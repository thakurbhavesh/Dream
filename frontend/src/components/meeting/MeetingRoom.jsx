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
} from "@mui/material";
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
} from "react-icons/pi";
import { useMeetingContext } from "../../contexts/MeetingContext.jsx";

// ─── Video tile for a single participant ──────────────────────────
const VideoTile = ({ stream, userName, isMuted, isVideoOff, isLocal, isScreenShare, isPinned, onPin, handRaised }) => {
  const videoRef = useRef(null);
  const theme = useTheme();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

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
            objectFit: "cover",
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
const ParticipantsPanel = ({ open, onClose, participants, localUserName }) => {
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
      <Divider />
      <Stack sx={{ px: 2, py: 1, gap: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
          <Avatar sx={{ width: 28, height: 28, fontSize: 14, bgcolor: "primary.main" }}>
            {(localUserName || "Y").charAt(0)}
          </Avatar>
          <Typography variant="body2">{localUserName} (You)</Typography>
        </Stack>
        {participants.map((p) => (
          <Stack key={p.socketId} direction="row" alignItems="center" spacing={1} sx={{ py: 0.75 }}>
            <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>
              {(p.userName || "U").charAt(0)}
            </Avatar>
            <Typography variant="body2" sx={{ flex: 1 }}>{p.userName}</Typography>
            {!p.audio && <PiMicrophoneSlashBold size={14} color="#f44336" />}
            {p.handRaised && <Box component="span" sx={{ fontSize: 14 }}>&#9995;</Box>}
          </Stack>
        ))}
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

  // Auto-close when meeting ends (status becomes idle)
  useEffect(() => {
    if (meeting.status === "idle") {
      onLeave?.();
    }
  }, [meeting.status, onLeave]);

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

  // Determine grid layout
  const totalParticipants = meeting.participants.length + 1; // +1 for local
  const getGridCols = () => {
    if (meeting.pinnedSocketId || meeting.viewMode === "speaker") return 1;
    if (totalParticipants <= 1) return 1;
    if (totalParticipants <= 4) return 2;
    if (totalParticipants <= 9) return 3;
    return 4;
  };

  const gridCols = getGridCols();
  const showingPinned = meeting.pinnedSocketId && meeting.viewMode !== "gallery";

  // Build tiles array
  const pinnedParticipant = meeting.participants.find((p) => p.socketId === meeting.pinnedSocketId);

  const reactionEmojis = [
    { key: "thumbs-up", label: "\uD83D\uDC4D" },
    { key: "clap", label: "\uD83D\uDC4F" },
    { key: "heart", label: "\u2764\uFE0F" },
    { key: "laugh", label: "\uD83D\uDE02" },
    { key: "fire", label: "\uD83D\uDD25" },
  ];
  const [showReactions, setShowReactions] = useState(false);

  // If meeting is idle, don't render
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
        {showingPinned && pinnedParticipant ? (
          // Pinned / Speaker view
          <Stack direction="row" sx={{ width: "100%", height: "100%", gap: 1 }}>
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <VideoTile
                stream={pinnedParticipant.stream}
                userName={pinnedParticipant.userName}
                isMuted={!pinnedParticipant.audio}
                isVideoOff={!pinnedParticipant.video}
                isScreenShare={pinnedParticipant.screenShare}
                isPinned
                handRaised={pinnedParticipant.handRaised}
              />
            </Box>
            <Stack sx={{ width: 200, gap: 1, overflow: "auto" }}>
              <VideoTile
                stream={meeting.isScreenSharing ? meeting.screenStream : meeting.localStream}
                userName={userName}
                isMuted={meeting.isMuted}
                isVideoOff={meeting.isVideoOff && !meeting.isScreenSharing}
                isLocal
                isScreenShare={meeting.isScreenSharing}
                onPin={() => meeting.pinParticipant(null)}
              />
              {meeting.participants.filter((p) => p.socketId !== meeting.pinnedSocketId).map((p) => (
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
                isPinned={meeting.pinnedSocketId === p.socketId}
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
      />
    </Box>
  );
};

export default MeetingRoom;
