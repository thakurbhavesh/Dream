import { alpha, Avatar, Box, Stack, Typography, useTheme } from "@mui/material";
import React, { useCallback, useMemo, useState } from "react";
import { BeatLoader } from "react-spinners";
import {
  pickNonEmptyString,
  extractTextLike,
  getEntryTimestamp,
  pickTimestampIso,
  formatDirectTimeValue,
} from "./ChatElement.jsx";
import { getInitials } from "../../utils/initials.js";
import { formatThreadTimestamp } from "../../utils/chatSelectors.js";
import {
  extractFilesFromDataTransfer,
  isFileDropEvent,
} from "../../utils/fileDropUtils.js";
import {
  HiOutlineUserGroup,
  HiOutlineArrowRightOnRectangle,
  HiOutlineUserMinus,
  HiOutlineNoSymbol,
} from "react-icons/hi2";

const INACTIVE_STATUS_META = {
  left:   { text: "You left this group",             Icon: HiOutlineArrowRightOnRectangle },
  kicked: { text: "You were removed from this group", Icon: HiOutlineUserMinus },
  removed:{ text: "You were removed from this group", Icon: HiOutlineUserMinus },
  banned: { text: "You were banned from this group",  Icon: HiOutlineNoSymbol },
};

const resolveInactiveMeta = (thread) => {
  const raw = String(thread?.membershipStatus || "").toLowerCase();
  if (INACTIVE_STATUS_META[raw]) return INACTIVE_STATUS_META[raw];
  if (thread?.hasLeft) return INACTIVE_STATUS_META.left;
  return null;
};
import { useTypingIndicator } from "../../contexts/TypingIndicatorContext.jsx";
import {
  formatSystemEventLabel,
  isSystemEventMessage,
  normalizeMessage,
} from "../conversation/messages/helpers.js";

const GroupElement = ({
  thread,
  isActive,
  onSelect,
  disabled = false,
  isLocked = false,
  onDropFiles,
}) => {
  const theme = useTheme();
  const threadsArray = thread?.threads;
  const [isDragOver, setIsDragOver] = useState(false);

  const activeNestedThread = useMemo(() => {
    if (!Array.isArray(threadsArray) || threadsArray.length === 0) {
      return null;
    }
    return threadsArray.reduce((latest, current) => {
      if (!current) return latest;
      if (!latest) return current;
      const currentTimestamp = getEntryTimestamp(current);
      const latestTimestamp = getEntryTimestamp(latest);
      if (currentTimestamp === 0 && latestTimestamp === 0) {
        return latest;
      }
      return currentTimestamp > latestTimestamp ? current : latest;
    }, null);
  }, [threadsArray]);

  const metaSource = activeNestedThread ?? thread ?? {};
  const normalizedLastMessage = useMemo(
    () => normalizeMessage(metaSource?.lastMessage),
    [metaSource?.lastMessage]
  );

  const label =
    pickNonEmptyString(
      thread?.label,
      thread?.title,
      thread?.groupName,
      metaSource?.label
    ) || "Untitled group";

  const description = pickNonEmptyString(
    thread?.description,
    thread?.topic,
    metaSource?.description
  );

  const systemPreview = isSystemEventMessage(normalizedLastMessage)
    ? formatSystemEventLabel(normalizedLastMessage)
    : "";
  const previewText =
    systemPreview ||
    extractTextLike([
      metaSource?.preview,
      metaSource?.lastMessage?.content,
      thread?.preview,
    ]);

  const fallbackPreview =
    pickNonEmptyString(description, "No recent activity") ||
    "No recent activity";

  const displayPreview = previewText || fallbackPreview;

  const lastSenderName =
    pickNonEmptyString(
      metaSource?.lastMessage?.author?.name,
      metaSource?.lastMessage?.senderName,
      metaSource?.lastSender,
      metaSource?.lastSenderName
    ) || "";

  const status =
    pickNonEmptyString(thread?.status, metaSource?.status) || "Offline";

  const rawUnread =
    metaSource?.unreadCount ??
    metaSource?.unread_count ??
    thread?.unreadCount ??
    thread?.unread_count ??
    0;
  const unreadCount = (() => {
    const numeric = Number(rawUnread);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.trunc(numeric);
  })();

  const timeLabel = (() => {
    const directTime = pickNonEmptyString(metaSource?.time, thread?.time);
    if (directTime) {
      return formatDirectTimeValue(directTime);
    }
    const iso = pickTimestampIso(
      metaSource?.lastMessageAt,
      metaSource?.lastActivityAt,
      metaSource?.updatedAt,
      metaSource?.createdAt,
      thread?.lastMessageAt,
      thread?.lastActivityAt,
      thread?.updatedAt,
      thread?.createdAt
    );
    return iso ? formatThreadTimestamp(iso) : "";
  })();
  const displayTimeLabel = timeLabel || "now";

  const secondaryColor = isActive
    ? theme.palette.primary.contrastText
    : theme.palette.text.secondary;

  const initials = useMemo(() => getInitials(label), [label]);
  const profilePicture =
    thread?.profilePicture ??
    thread?.avatar ??
    metaSource?.profilePicture ??
    metaSource?.avatar ??
    null;

  const handleSelect = () => {
    if (disabled) return;
    onSelect?.(thread);
  };

  const { isActive: isTyping, summary: typingSummary } = useTypingIndicator(
    thread?.id
  );

  const messageLine = lastSenderName
    ? `${lastSenderName}: ${displayPreview}`
    : displayPreview;

  const renderedPreview = isTyping && typingSummary ? typingSummary : messageLine;



  const typingLoaderColor = isActive
    ? theme.palette.primary.contrastText
    : theme.palette.primary.main;

  const isFileTransfer = useCallback((event) => isFileDropEvent(event), []);

  const extractFiles = useCallback(
    (event) => extractFilesFromDataTransfer(event?.dataTransfer),
    []
  );

  const handleDragOver = useCallback(
    (event) => {
      if (!isFileTransfer(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      if (!isDragOver) {
        setIsDragOver(true);
      }
    },
    [isDragOver, isFileTransfer]
  );

  const handleDragLeave = useCallback((event) => {
    if (
      event.currentTarget &&
      event.relatedTarget &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event) => {
      if (!isFileTransfer(event)) return;
      event.preventDefault();
      setIsDragOver(false);
      const files = extractFiles(event);
      if (!files.length) return;
      onDropFiles?.(thread, files);
    },
    [extractFiles, isFileTransfer, onDropFiles, thread]
  );

  return (
    <Box
      onClick={handleSelect}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        cursor: disabled ? "not-allowed" : "pointer",
        width: "100%",
        borderLeft: "5px solid transparent",
        boxShadow:
          theme.palette.mode === "light"
            ? "0px 1px 1px rgba(0, 0, 0, 0.08)"
            : "0px 1px 1px rgba(255, 255, 255, 0.08)",
        p: 0.4,
        opacity: resolveInactiveMeta(thread) ? 0.6 : 1,
        transition: "background-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
        "&:hover": resolveInactiveMeta(thread) ? { opacity: 0.85 } : undefined,
        pointerEvents: disabled ? "none" : "auto",
        userSelect: "none",
        "&:hover .avatar-hover": {
          transform: "scale(1.1)",
        },
      }}
    >
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{
          py: 1.5,
          px: 1,
          borderRadius: 1,
          
          bgcolor: isDragOver
            ? theme.palette.action.hover
            : isActive
              ? theme.palette.mode === "light"
                    ? alpha(theme.palette.primary.main,0.2) : alpha(theme.palette.primary.main,0.4)
              : "background.paper",
          color: "text.primary",
          ...(isActive || disabled
            ? {}
            : {
                "&:hover": {
                  backgroundColor:
                    theme.palette.background.neutral,
                },
              }),
        }}
      >
        <Avatar
          src={profilePicture || undefined}
          className="avatar-hover"
          sx={{
            width: 45,
            height: 45,
            bgcolor: profilePicture
                ? "transparent"
                : theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.04)",
            color: theme.palette.text.primary,
            letterSpacing: "2px",
            fontSize: 16,
              fontWeight: 500,
            border:  `1px solid ${theme.palette.divider}`,
            transition: "transform 0.1s ease-in-out",
          }}
        >
          {!profilePicture ? initials : null}
        </Avatar>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight:600,
              color: theme.palette.mode === "light" ? "primary.main" : "text.primary",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <HiOutlineUserGroup size={16} /> {label}
          </Typography>
          <Typography
            variant="caption"
            component="div"
            sx={{
              color: theme.palette.text.secondary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {(() => {
              const inactiveMeta = resolveInactiveMeta(thread);
              if (inactiveMeta) {
                const { Icon, text } = inactiveMeta;
                return (
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    component="span"
                    sx={{
                      fontStyle: "italic",
                      color: theme.palette.text.disabled,
                    }}
                  >
                    <Icon size={13} aria-hidden />
                    <Box component="span">{text}</Box>
                  </Stack>
                );
              }
              if (isTyping && typingSummary) {
                return (
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <BeatLoader
                      size={6}
                      speedMultiplier={0.9}
                      color={typingLoaderColor}
                    />
                    <Box component="span" fontStyle={"italic"}>{typingSummary}</Box>
                  </Stack>
                );
              }
              return renderedPreview;
            })()}
          </Typography>
        </Box>

        <Stack
          spacing={0.5}
          alignItems="flex-end"
          sx={{ minWidth: 72, ml: "auto" }}
        >
          <Typography variant="caption" sx={{ opacity: isActive ? 0.9 : 0.7, flexShrink: 0,textWrap: "nowrap" }}>
            {displayTimeLabel}
          </Typography>
          {unreadCount ? (
            <Box
              sx={{
                minWidth: 20,
                px: 0.75,
                height: 20,
                borderRadius: "999px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.palette.error.main,
                color: "#fff",
                fontSize: "0.7rem",
                fontWeight: 600,
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Box>
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
};

export default React.memo(GroupElement);
