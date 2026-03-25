import {
  Avatar,
  Box,
  Button,
  Fade,
  IconButton,
  MenuItem,
  Popover,
  Slide,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { BeatLoader } from "react-spinners";
import { getInitials } from "../../utils/initials.js";
import { agentSelfId } from "../../data/CommonData.js";
import { useTypingIndicator } from "../../contexts/TypingIndicatorContext.jsx";
import { usePresence } from "../../contexts/PresenceProvider.jsx";
import { useScreenShareContext } from "../../contexts/ScreenShareContext.jsx";
import { closeSidebar, openSidebar } from "../../redux/slices/app.js";
import {
  PiCopySimple,
  PiShareFat,
  PiTrashSimple,
  PiXBold,
  PiDotsThreeOutlineVertical,
  PiUserCircle,
  PiMonitor,
  PiUsersThreeBold,
} from "react-icons/pi";
import { BsSearch } from "react-icons/bs";
import {
  FaAndroid,
  FaApple,
  FaDesktop,
  FaRegWindowMaximize,
} from "react-icons/fa";
import { resolveLatestDeviceIndicator } from "../../utils/deviceDetect.js";

const SELF_THREAD_ID = "thread-self";
const SELF_INITIALS = "MY";
const DEVICE_ICON_BY_KEY = {
  desktop: FaDesktop,
  browser: FaRegWindowMaximize,
  ios: FaApple,
  android: FaAndroid,
};

const ConversationHeader = ({
  thread,
  selectionActive = false,
  selectionCount = 0,
  selectionForwardDisabled = false,
  onSelectionCopy,
  onSelectionForward,
  onSelectionDelete,
  onSelectionCancel,
  onSearchToggle,
  searchOpen = false,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const sidebarOpen = useSelector((state) => state.app.sidebar.open);
  const { status: presenceStatus } = usePresence();
  const { requestScreenShare, status: screenShareStatus } = useScreenShareContext();
  const { isActive: isTyping, summary: typingSummary } = useTypingIndicator(
    thread?.id
  );

  const displayLabel =
    thread?.label && thread.label.trim()
      ? thread.label
      : "Static Conversation Header";

  const profilePicture = useMemo(() => {
    const candidates = [
      thread?.profilePicture,
      thread?.avatar,
      thread?.contact?.avatar,
      thread?.contact?.profilePicture,
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return value;
    }
    return null;
  }, [thread]);

  const typingLoaderColor =
    theme.palette.mode === "dark"
      ? theme.palette.primary.light
      : theme.palette.primary.main;

  const isSelfThread = Boolean(
    thread?.isSelfThread ||
      thread?.id === SELF_THREAD_ID ||
      thread?.user_id === agentSelfId
  );

  const isGroupThread = useMemo(() => {
    const type = thread?.type || thread?.threadType || thread?.conversationType;
    if (!type) return Boolean(thread?.members || thread?.participants);
    return String(type).toLowerCase() === "group";
  }, [thread]);

  const groupMemberCount = useMemo(() => {
    if (Array.isArray(thread?.members)) return thread.members.length;
    if (Array.isArray(thread?.participants)) return thread.participants.length;
    return 0;
  }, [thread]);

  const initials = useMemo(() => {
    if (thread?.initialsOverride) {
      return thread.initialsOverride.slice(0, 2).toUpperCase();
    }
    if (isSelfThread) {
      return SELF_INITIALS;
    }
    return getInitials(displayLabel);
  }, [thread?.initialsOverride, isSelfThread, displayLabel]);

  const statusLabel = isSelfThread
    ? presenceStatus || "Online"
    : (thread?.status ?? "Online");

  const deviceIndicator = useMemo(
    () => resolveLatestDeviceIndicator(thread),
    [thread]
  );
  const DeviceIcon =
    DEVICE_ICON_BY_KEY[deviceIndicator.key] || DEVICE_ICON_BY_KEY.browser;
  const statusText = statusLabel;

  const handleSelectionAction = (handler) => {
    if (!selectionCount) return;
    handler?.();
  };

  const [deleteAnchorEl, setDeleteAnchorEl] = useState(null);
  const deleteConfirmOpen = Boolean(deleteAnchorEl);

  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const menuOpen = Boolean(menuAnchorEl);

  const handleOpenSidebar = useCallback(() => {
    if (isSelfThread) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("selectedTab", "3");
      }
      navigate("/app/settings");
      return;
    }
    if (sidebarOpen) {
      dispatch(closeSidebar());
      return;
    }
    dispatch(openSidebar("CONTACT"));
  }, [dispatch, sidebarOpen, isSelfThread, navigate]);

  const openDeleteConfirm = (event) => {
    if (!selectionCount) return;
    setDeleteAnchorEl(event.currentTarget);
  };

  const closeDeleteConfirm = () => {
    setDeleteAnchorEl(null);
  };

  const openMenu = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const closeMenu = () => {
    setMenuAnchorEl(null);
  };

  const canScreenShare =
    !isSelfThread &&
    !isGroupThread &&
    screenShareStatus === "idle" &&
    thread?.id?.startsWith?.("dm-");

  const handleMenuAction = (label) => {
    if (label === "View Profile") {
      handleOpenSidebar();
    } else if (label === "Screen Share" && canScreenShare) {
      const targetUserId = thread.id.replace("dm-", "");
      requestScreenShare(targetUserId);
    }
    closeMenu();
  };

  const handleConfirmDelete = () => {
    closeDeleteConfirm();
    handleSelectionAction(onSelectionDelete);
  };

  useEffect(() => {
    if (!selectionActive || !selectionCount) {
      closeDeleteConfirm();
    }
  }, [selectionActive, selectionCount]);

  const selectionToolbar = (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontWeight: 600 }}
      >
        {selectionCount} selected
      </Typography>
      <Tooltip title="Copy" placement="bottom">
        <IconButton
          disableRipple
          onClick={() => handleSelectionAction(onSelectionCopy)}
          sx={{
            color: theme.palette.text.primary,
            "&:hover": {
              backgroundColor: "transparent",
              color: theme.palette.primary.main,
            },
          }}
        >
          <PiCopySimple size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Forward" placement="bottom">
        <IconButton
          disableRipple
          onClick={() => handleSelectionAction(onSelectionForward)}
          disabled={selectionForwardDisabled}
          sx={{
            color: theme.palette.text.primary,
            "&:hover": {
              backgroundColor: "transparent",
              color: theme.palette.primary.main,
            },
            "&.Mui-disabled": {
              color: theme.palette.text.disabled,
            },
          }}
        >
          <PiShareFat size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete" placement="bottom">
        <IconButton
          disableRipple
          onClick={openDeleteConfirm}
          sx={{
            color: theme.palette.text.primary,
            "&:hover": {
              backgroundColor: "transparent",
              color: theme.palette.primary.main,
            },
          }}
        >
          <PiTrashSimple size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Cancel selection" placement="bottom">
        <IconButton
          disableRipple
          onClick={() => {
            closeDeleteConfirm();
            onSelectionCancel?.();
          }}
          sx={{
            color: theme.palette.text.primary,
            "&:hover": {
              backgroundColor: "transparent",
              color: theme.palette.primary.main,
            },
          }}
        >
          <PiXBold size={18} />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: 1,
        borderColor: "divider",
        background: theme.palette.background.default,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2} sx={{ flex: 1 }}>
        <Box sx={{ position: "relative" }}>
          <Avatar
            src={profilePicture ?? undefined}
            alt={displayLabel}
            onClick={handleOpenSidebar}
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              cursor: "pointer",
              bgcolor: profilePicture ? "transparent" : "primary.main",
              color: profilePicture ? "inherit" : "primary.contrastText",
              fontWeight: 500,
            }}
          >
            {!profilePicture ? (
              isGroupThread ? <PiUsersThreeBold size={20} /> : initials
            ) : null}
          </Avatar>
          {!isGroupThread && (thread?.isGlobalMember || thread?.isGlobal || thread?.is_global) && (
            <Box sx={{ position: "absolute", bottom: 0, right: 0, width: 12, height: 12, borderRadius: "50%", bgcolor: "#FFB020", border: `2px solid ${theme.palette.background.paper}` }} />
          )}
        </Box>
        <Box onClick={handleOpenSidebar} sx={{ cursor: "pointer" }}>
          <Typography
            variant="subtitle2"
            sx={{
              color: theme.palette.mode === "light" ? "#333" : "#fff",
            }}
          >
            {displayLabel}
          </Typography>
          <Typography
            variant="caption"
            component="div"
            sx={{
              fontStyle: "italic",
              fontSize: "14px",
              color: theme.palette.text.secondary,
            }}
          >
            {isTyping && typingSummary ? (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <BeatLoader
                  size={6}
                  speedMultiplier={0.9}
                  color={typingLoaderColor}
                />
                <Box component="span" fontStyle={"italic"}>
                  {typingSummary}
                </Box>
              </Stack>
            ) : (
              isGroupThread ? (
                <Box component="span">{groupMemberCount} members</Box>
              ) : (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Tooltip title={deviceIndicator.label} placement="right" arrow>
                    <Box
                      component="span"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        color: theme.palette.text.secondary,
                      }}
                    >
                      <DeviceIcon size={14} />
                    </Box>
                  </Tooltip>
                  <Box component="span">{statusText}</Box>
                </Stack>
              )
            )}
          </Typography>
        </Box>
      </Stack>
      {/* actions when user select a message */}
      {selectionActive ? (
        selectionToolbar
      ) : (
        // render all elements in header right side by default
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Press Ctrl+F" placement="bottom">
            <IconButton
              onClick={() => onSearchToggle?.()}
              sx={{
                color: searchOpen
                  ? theme.palette.primary.main
                  : theme.palette.text.primary,
              }}
            >
              <BsSearch size={18} />
            </IconButton>
          </Tooltip>
          <IconButton onClick={openMenu}>
            <PiDotsThreeOutlineVertical size={18} />
          </IconButton>
        </Stack>
      )}
      
      {/* threedot pr open hone wala menu popover */}
      <Popover
        open={menuOpen}
        anchorEl={menuAnchorEl}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        TransitionComponent={Fade}
        TransitionProps={{ direction: "top" }}
        PaperProps={{
          sx: {
            mt: 1,
            borderRadius: 1.5,
            boxShadow: theme.shadows[6],
            minWidth: 150,
          },
        }}
      >
        <Stack>
          <MenuItem onClick={() => handleMenuAction("View Profile")}>
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", mr: 1 }}
            >
              <PiUserCircle size={16} />
            </Box>
            View Profile
          </MenuItem>
          <MenuItem
            onClick={() => handleMenuAction("Screen Share")}
            disabled={!canScreenShare}
          >
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center", mr: 1 }}
            >
              <PiMonitor size={16} />
            </Box>
            Screen Share
          </MenuItem>
        </Stack>
      </Popover>

      <Popover
        open={deleteConfirmOpen}
        anchorEl={deleteAnchorEl}
        onClose={closeDeleteConfirm}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        TransitionComponent={Slide}
        TransitionProps={{ direction: "left" }}
        PaperProps={{
          sx: {
            mt: 3,
            borderRadius: 1.5,
            boxShadow: theme.shadows[6],
          },
        }}
      >
        <Stack spacing={1.25} sx={{ p: 1.5, minWidth: 240 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Delete selected messages?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            This action cannot be undone.
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={closeDeleteConfirm}>
              Cancel
            </Button>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </Stack>
  );
};

export default ConversationHeader;
