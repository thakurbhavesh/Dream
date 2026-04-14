import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Avatar,
  useTheme,
} from "@mui/material";
import { PiVideoCameraBold, PiXBold } from "react-icons/pi";
import { useSocket } from "../../contexts/SocketContext.jsx";
import { showSystemNotification, ensureNotificationPermission } from "../../utils/notificationBridge";

const MeetingInviteDialog = ({ onJoin }) => {
  const socket = useSocket();
  const theme = useTheme();
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const onInvited = (data) => {
      setInvite(data);
      try {
        showSystemNotification({
          title: "Meeting Invitation",
          body: `${data?.hostName || "Someone"} invited you to "${data?.meetingTitle || "a meeting"}"`,
          tag: "meeting-invite",
          requireInteraction: true,
        });
      } catch {}
      // Auto dismiss after 30s
      setTimeout(() => setInvite(null), 30000);
    };

    ensureNotificationPermission().catch(() => {});
    socket.on("meeting:invited", onInvited);
    return () => socket.off("meeting:invited", onInvited);
  }, [socket]);

  if (!invite) return null;

  const handleJoin = () => {
    onJoin?.({ meeting_id: invite.meetingId, title: invite.meetingTitle });
    setInvite(null);
  };

  return (
    <Dialog open maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: "center", pt: 3 }}>
        Meeting Invitation
      </DialogTitle>
      <DialogContent sx={{ textAlign: "center" }}>
        <Avatar
          sx={{
            width: 56, height: 56, mx: "auto", mb: 2,
            bgcolor: theme.palette.primary.main, fontSize: 24,
          }}
        >
          {(invite.hostName || "H").charAt(0)}
        </Avatar>
        <Typography variant="subtitle1" fontWeight={600}>
          {invite.hostName || "Someone"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          invited you to join a meeting
        </Typography>
        <Typography variant="h6" color="primary" fontWeight={700}>
          {invite.meetingTitle || "Meeting"}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 3, gap: 1 }}>
        <Button
          variant="contained"
          color="success"
          startIcon={<PiVideoCameraBold />}
          onClick={handleJoin}
        >
          Join
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<PiXBold />}
          onClick={() => setInvite(null)}
        >
          Decline
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MeetingInviteDialog;
