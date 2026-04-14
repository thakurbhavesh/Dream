import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Popover,
  Snackbar,
  Stack,
} from "@mui/material";
import {
  PiPlusBold,
  PiShareFatBold,
  PiUsersThreeBold,
  PiXBold,
  PiVideoCameraBold,
} from "react-icons/pi";
import GroupMembersDialog from "./GroupMembersDialog.jsx";
import BroadcastDialog from "./BroadcastDialog.jsx";
import MeetingDialog from "../meeting/MeetingDialog.jsx";
import MeetingRoom from "../meeting/MeetingRoom.jsx";
import { useMeetingContext } from "../../contexts/MeetingContext.jsx";
import useCurrentUser from "../../hooks/useCurrentUser.js";
import { useSocket } from "../../contexts/SocketContext.jsx";

const ChatListActionsMenu = ({
  members = [],
  currentUser = null,
  organizationId = null,
  threads = [],
  disabled = false,
  onCreateGroup,
}) => {
  const authUser = useCurrentUser();
  const socket = useSocket();
  const roleId = authUser ? Number(authUser.role || authUser.role_id || 3) : 3;
  const isOwner = roleId === 1;
  const isUser = roleId >= 4;
  const [anchorEl, setAnchorEl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingRoomOpen, setMeetingRoomOpen] = useState(false);
  const meeting = useMeetingContext();
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const open = Boolean(anchorEl);
  const sortedMembers = useMemo(() => {
    if (!Array.isArray(members)) return [];
    const selfEntry =
      currentUser && currentUser.id
        ? {
            id: currentUser.id,
            label: currentUser.label || currentUser.name || "You",
            name: currentUser.name || currentUser.label || "You",
            email: currentUser.email || "",
            avatar: currentUser.avatar || "",
            profilePicture: currentUser.avatar || "",
            isSelf: true,
          }
        : null;
    const withoutSelf = members.filter(
      (member) => member?.id !== currentUser?.id
    );
    const sorted = [...withoutSelf].sort((a, b) =>
      String(a?.label || a?.name || "")
        .toLowerCase()
        .localeCompare(String(b?.label || b?.name || "").toLowerCase())
    );
    return selfEntry ? [selfEntry, ...sorted] : sorted;
  }, [currentUser, members]);

  const handleOpenMenu = (event) => {
    if (disabled) return;
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleOpenCreateGroup = () => {
    setDialogOpen(true);
    handleCloseMenu();
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleBroadcast = () => {
    setBroadcastOpen(true);
    handleCloseMenu();
  };

  const handleOpenMeeting = () => {
    setMeetingDialogOpen(true);
    handleCloseMenu();
  };

  // Listen for sidebar meeting button
  useEffect(() => {
    const openHandler = () => setMeetingDialogOpen(true);
    window.addEventListener("teamchatx:openMeeting", openHandler);
    return () => window.removeEventListener("teamchatx:openMeeting", openHandler);
  }, []);

  const handleMeetingCreated = (meetingData, action) => {
    const userName = authUser?.first_name
      ? `${authUser.first_name} ${authUser.last_name || ""}`.trim()
      : authUser?.name || "User";

    // Send invite notifications + DM messages for all meeting types
    const sendInvites = (data) => {
      if (!socket) return;
      const participantIds = (data.participants || [])
        .map((p) => p.user_id)
        .filter((id) => id && String(id) !== String(authUser?.id || authUser?.user_id));
      if (participantIds.length > 0) {
        socket.emit("meeting:invite", {
          targetUserIds: participantIds,
          meetingId: data.meeting_id,
          meetingTitle: data.title,
          hostName: userName,
          scheduledAt: data.scheduled_at || null,
        });
      }
    };

    if (action === "instant" || action === "join-now" || action === "join") {
      meeting.joinMeeting({
        meetingRoomId: meetingData.meeting_id,
        meetingData,
        userName,
        enableVideo: true,
        enableAudio: true,
      });
      setMeetingRoomOpen(true);
      setMeetingDialogOpen(false);

      if (action === "instant") sendInvites(meetingData);
    } else if (action === "scheduled") {
      sendInvites(meetingData);
      setMeetingDialogOpen(false);
      setToast({ open: true, message: "Meeting scheduled!", severity: "success" });
    }
  };

  const handleBroadcastSend = ({ contactIds = [], groupIds = [], message, messageType = "text", metadata = null }) => {
    return new Promise((resolve) => {
      if (!socket) return resolve({ error: "Not connected" });
      socket.emit("broadcast:send", { contactIds, groupIds, message, messageType, metadata }, resolve);
    });
  };
  const handleCreateGroup = async (payload = {}) => {
    const trimmed = String(payload.name || "").trim();
    if (!trimmed) {
      setToast({
        open: true,
        message: "Group name is required",
        severity: "error",
      });
      return false;
    }
    const selected = Array.isArray(payload.members)
      ? payload.members
      : [];
    if (selected.length === 0) {
      setToast({
        open: true,
        message: "Select at least one member",
        severity: "error",
      });
      return false;
    }
    try {
      const created = await onCreateGroup?.({
        name: trimmed,
        description: payload.description || "",
        members: selected,
        avatar: payload.avatar || "",
      });
      if (created === false) {
        setToast({
          open: true,
          message: "Unable to create group",
          severity: "error",
        });
        return false;
      }
      setDialogOpen(false);
      setToast({
        open: true,
        message: "Group created",
        severity: "success",
      });
      return true;
    } catch {
      setToast({
        open: true,
        message: "Unable to create group",
        severity: "error",
      });
      return false;
    }
  };

  // Listen for meeting invite join events
  const handleInviteJoin = useCallback((e) => {
    const meetingData = e.detail;
    if (meetingData) {
      handleMeetingCreated(meetingData, "join");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, authUser, socket]);

  useEffect(() => {
    window.addEventListener("meeting:join-from-invite", handleInviteJoin);
    return () => window.removeEventListener("meeting:join-from-invite", handleInviteJoin);
  }, [handleInviteJoin]);

  // FAB visible for all roles (Users can create groups & meetings)

  return (
    <>
      <Box sx={{ position: "absolute", right: 32, bottom: 32, zIndex: 10 }}>
        <IconButton
          onClick={handleOpenMenu}
          disabled={disabled}
          sx={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            cursor: "pointer",
            boxShadow: 6,
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              transition: "transform 0.2s ease",
              transform: open ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            {open ? <PiXBold size={20} /> : <PiPlusBold size={20} />}
          </Box>
        </IconButton>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        transitionDuration={200}
      >
        <Stack sx={{ p: 1 }} spacing={0.5}>
          <Button
            onClick={handleOpenCreateGroup}
            startIcon={<PiUsersThreeBold size={16} />}
            sx={{ justifyContent: "flex-start", color: "text.primary" }}
          >
            Create Group
          </Button>
          <Button
            onClick={handleOpenMeeting}
            startIcon={<PiVideoCameraBold size={16} />}
            sx={{ justifyContent: "flex-start", color: "text.primary" }}
          >
            Meeting
          </Button>
          <Button
            onClick={handleBroadcast}
            startIcon={<PiShareFatBold size={16} />}
            sx={{ justifyContent: "flex-start", color: "text.primary" }}
          >
            Broadcast
          </Button>
        </Stack>
      </Popover>

      <GroupMembersDialog
        open={dialogOpen}
        mode="create"
        members={sortedMembers}
        currentUser={currentUser}
        initialSelected={currentUser?.id ? [currentUser] : []}
        onClose={handleCloseDialog}
        onSubmit={handleCreateGroup}
        submitLabel="Create"
      />

      <BroadcastDialog
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        contacts={sortedMembers.filter((m) => !m.isSelf)}
        threads={threads}
        onSend={handleBroadcastSend}
      />

      <MeetingDialog
        open={meetingDialogOpen}
        onClose={() => setMeetingDialogOpen(false)}
        members={sortedMembers}
        organizationId={organizationId}
        onMeetingCreated={handleMeetingCreated}
      />

      {meetingRoomOpen && (
        <MeetingRoom
          userName={
            authUser?.first_name
              ? `${authUser.first_name} ${authUser.last_name || ""}`.trim()
              : authUser?.name || "User"
          }
          userId={authUser?.id || authUser?.user_id}
          onLeave={() => setMeetingRoomOpen(false)}
        />
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ChatListActionsMenu;

