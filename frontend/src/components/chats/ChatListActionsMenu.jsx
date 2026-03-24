import React, { useMemo, useState } from "react";
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
} from "react-icons/pi";
import GroupMembersDialog from "./GroupMembersDialog.jsx";
import useCurrentUser from "../../hooks/useCurrentUser.js";

const ChatListActionsMenu = ({
  members = [],
  currentUser = null,
  disabled = false,
  onCreateGroup,
}) => {
  const authUser = useCurrentUser();
  const roleId = authUser ? Number(authUser.role || authUser.role_id || 3) : 3;
  const isOwner = roleId === 1;
  const isUser = roleId >= 4;
  const [anchorEl, setAnchorEl] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
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
    setToast({
      open: true,
      message: "Broadcast coming soon",
      severity: "info",
    });
    handleCloseMenu();
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

  // Hide FAB entirely for User role (no menu items for them)
  if (isUser) return null;

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
          {!isUser && (
            <Button
              onClick={handleOpenCreateGroup}
              startIcon={<PiUsersThreeBold size={16} />}
              sx={{ justifyContent: "flex-start", color: "text.primary" }}
            >
              Create Group
            </Button>
          )}
          {isOwner && (
            <Button
              onClick={handleBroadcast}
              startIcon={<PiShareFatBold size={16} />}
              sx={{ justifyContent: "flex-start", color: "text.primary" }}
            >
              Broadcast
            </Button>
          )}
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

