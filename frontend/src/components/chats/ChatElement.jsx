import { alpha, Avatar, Box, Menu, MenuItem, ListItemIcon, ListItemText, Stack, Typography, useTheme } from "@mui/material";
import React, { useCallback, useMemo, useState } from "react";
import { PiBellSlashBold, PiBellBold, PiPushPinBold, PiPushPinSlashBold, PiPushPinFill } from "react-icons/pi";
import { FiPaperclip } from "react-icons/fi";
import { IoCheckmark, IoCheckmarkDone } from "react-icons/io5";
import {
  LuLink,
  LuClock3,
  LuCodeXml,
  LuImage,
  LuVideo,
  LuMusic2,
} from "react-icons/lu";
import { BeatLoader } from "react-spinners";
import { formatThreadTimestamp } from "../../utils/chatSelectors.js";
import { getInitials } from "../../utils/initials.js";
import {
  extractFilesFromDataTransfer,
  isFileDropEvent,
} from "../../utils/fileDropUtils.js";
import { useTypingIndicator } from "../../contexts/TypingIndicatorContext.jsx";
import { usePresence } from "../../contexts/PresenceProvider.jsx";
import { agentSelfId } from "../../data/CommonData.js";
import {
  formatSystemEventLabel,
  isSystemEventMessage,
  normalizeMessage,
} from "../conversation/messages/helpers.js";

const SELF_THREAD_ID = "thread-self";
const READ_STATUS_COLOR = "#3AA00B";

export const statusBorder = (theme, status = "") => {
  const normalised = status.toLowerCase();
  switch (normalised) {
    case "online":
      return "4px solid green";
    case "idle":
      return "4px solid #84c3e7"; // Gray for idle
    case "away":
      return "4px solid #6f3ae7"; // Gray for idle
    case "neverlogged":
      return "4px solid transparent";
    default: // Offline or any other status
      return "4px solid transparent";
  }
};

const normalizeMessageKind = (value = "") => {
  const normalised = value.toLowerCase().trim();
  if (!normalised) return "";
  const contains = (needle) => normalised.includes(needle);
  if (
    ["attachment", "file", "document", "pdf", "doc", "ppt", "xls"].some(
      contains
    )
  ) {
    return "file";
  }
  if (["image", "photo", "picture", "media"].some(contains)) {
    return "image";
  }
  if (["video", "clip", "movie"].some(contains)) {
    return "video";
  }
  if (["audio", "voice", "voicenote"].some(contains)) {
    return "audio";
  }
  if (["code", "snippet"].some(contains)) {
    return "code";
  }
  if (["url", "link"].some(contains)) {
    return "link";
  }
  return normalised;
};

export const messageTypeIcon = (messageType, color) => {
  const kind = normalizeMessageKind(messageType || "");
  switch (kind) {
    case "link":
      return <LuLink size={12} color={color} />;
    case "file":
      return <FiPaperclip size={12} color={color} />;
    case "image":
      return <LuImage size={12} color={color} />;
    case "video":
      return <LuVideo size={12} color={color} />;
    case "audio":
      return <LuMusic2 size={12} color={color} />;
    case "code":
      return <LuCodeXml size={12} color={color} />;
    default:
      return null;
  }
};

export const readStatusIcon = (status, color) => {
  switch ((status || "").toLowerCase()) {
    case "read":
      return <IoCheckmarkDone size={14} color={READ_STATUS_COLOR} />;
    case "delivered":
      return <IoCheckmarkDone size={14} color={color} />;
    case "sent":
      return <IoCheckmark size={14} color={color} />;
    case "pending":
    case "queued":
    case "undelivered":
    case "unsent":
      return <LuClock3 size={12} color={color} />;
    default:
      return null;
  }
};

export const pickNonEmptyString = (...values) => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
};

export const TEXT_FIELDS = [
  "text",
  "body",
  "message",
  "content",
  "summary",
  "preview",
  "title",
  "description",
];

export const extractTextLike = (value) => {
  if (!value) return "";
  const stack = Array.isArray(value) ? [...value] : [value];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    if (typeof current === "string") {
      const trimmed = current.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (typeof current === "object") {
      for (const key of TEXT_FIELDS) {
        if (key in current) {
          stack.push(current[key]);
        }
      }
    }
  }
  return "";
};

export const normaliseTimestamp = (value) => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
};

export const getEntryTimestamp = (entry) => {
  if (!entry) return 0;
  const candidates = [
    entry.lastMessageAt,
    entry.lastActivityAt,
    entry.updatedAt,
    entry.createdAt,
    entry.timestamp,
    entry.time,
  ];
  for (const candidate of candidates) {
    const normalised = normaliseTimestamp(candidate);
    if (normalised) return normalised;
  }
  return 0;
};

export const pickTimestampIso = (...values) => {
  for (const value of values) {
    if (!value) continue;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "number" && Number.isFinite(value)) {
      const iso = new Date(value).toISOString();
      if (!Number.isNaN(Date.parse(iso))) return iso;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
    }
  }
  return "";
};

export const formatDirectTimeValue = (value) => {
  if (value === null || value === undefined) return "";
  const normalised = normaliseTimestamp(value);
  if (normalised) {
    return formatThreadTimestamp(new Date(normalised).toISOString());
  }
  return typeof value === "string" ? value : "";
};

const ensureNormalizedMessage = (message) => {
  if (!message) return null;
  return message.__normalized ? message : normalizeMessage(message);
};

const buildAttachmentPreviewLabel = (content = {}) => {
  const files = Array.isArray(content.files)
    ? content.files.filter(Boolean)
    : [];
  const primaryName = pickNonEmptyString(
    content.fileName,
    content.filename,
    content.name,
    files[0]?.fileName,
    files[0]?.name
  );
  if (!primaryName && !files.length) {
    return "Attachment";
  }
  if (files.length > 1) {
    return `${primaryName || "Attachment"} (+${files.length - 1})`;
  }
  return primaryName || "Attachment";
};

const buildMediaPreviewLabel = (type, content = {}) => {
  const baseLabel =
    type === "video" ? "Video" : type === "audio" ? "Audio" : "Photo";
  const fileName = pickNonEmptyString(
    content.fileName,
    content.filename,
    content.name
  );
  return fileName ? `${baseLabel}: ${fileName}` : baseLabel;
};

const buildCodePreviewLabel = (content = {}) => {
  const fileName = pickNonEmptyString(
    content.filename,
    content.fileName,
    content.name
  );
  return fileName || "Code snippet";
};

const buildLinkPreviewLabel = (content = {}) => {
  return (
    pickNonEmptyString(
      content.title,
      content.caption,
      content.displayHost,
      content.url
    ) || "Link"
  );
};

const describeNormalizedMessagePreview = (message) => {
  if (!message) return "";
  const content = message.content || {};
  const kind = normalizeMessageKind(message.type || "");
  switch (kind) {
    case "link":
      return buildLinkPreviewLabel(content);
    case "file":
      return buildAttachmentPreviewLabel(content);
    case "image":
    case "video":
    case "audio":
      return buildMediaPreviewLabel(kind, content);
    case "code":
      return buildCodePreviewLabel(content);
    default:
      return (
        extractTextLike([
          content.text,
          message.message,
          content.caption,
          content.description,
        ]) || ""
      );
  }
};

const deriveThreadPreviewText = (
  metaPreview,
  threadPreview,
  normalizedLastMessage
) => {
  if (isSystemEventMessage(normalizedLastMessage)) {
    return formatSystemEventLabel(normalizedLastMessage);
  }
  const kind = normalizeMessageKind(normalizedLastMessage?.type || "");
  if (kind === "code") {
    const codeLabel = buildCodePreviewLabel(normalizedLastMessage?.content);
    if (codeLabel) return codeLabel;
  }
  const existingPreview = extractTextLike([metaPreview, threadPreview]);
  if (existingPreview) return existingPreview;
  if (normalizedLastMessage) {
    const messagePreview = describeNormalizedMessagePreview(
      normalizedLastMessage
    );
    if (messagePreview) return messagePreview;
  }
  return "";
};

const ChatElement = ({
  thread,
  isActive,
  onSelect,
  disabled = false,
  isLocked = false,
  onDropFiles,
  isMuted = false,
  onMute,
  onUnmute,
  isPinned = false,
  onPin,
}) => {
  const theme = useTheme();
  const { status: presenceStatus } = usePresence();
  const threadsArray = thread?.threads;
  const [isDragOver, setIsDragOver] = useState(false);
  const [ctxMenu, setCtxMenu] = useState(null);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    setCtxMenu({ mouseX: e.clientX, mouseY: e.clientY });
  }, []);

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
  const initialsOverride = pickNonEmptyString(
    metaSource?.initialsOverride,
    thread?.initialsOverride
  );

  const label =
    pickNonEmptyString(
      thread?.label,
      thread?.contact?.name,
      metaSource?.label,
      metaSource?.contact?.name
    ) || "Untitled chat";

  const initials = useMemo(() => {
    if (initialsOverride) {
      return initialsOverride.slice(0, 2).toUpperCase();
    }
    return getInitials(label);
  }, [initialsOverride, label]);

  const profilePicture =
    thread?.profilePicture ??
    thread?.avatar ??
    thread?.contact?.avatar ??
    thread?.contact?.profilePicture ??
    metaSource?.profilePicture ??
    metaSource?.avatar ??
    null;

  const handleSelect = () => {
    if (disabled) return;
    onSelect?.(thread);
  };

  const normalizedLastMessage = useMemo(
    () => ensureNormalizedMessage(metaSource?.lastMessage),
    [metaSource?.lastMessage]
  );

  const previewText = useMemo(
    () =>
      deriveThreadPreviewText(
        metaSource?.preview,
        thread?.preview,
        normalizedLastMessage
      ),
    [metaSource?.preview, thread?.preview, normalizedLastMessage]
  );

  const fallbackPreview = pickNonEmptyString(
    thread?.email,
    thread?.contact?.email,
    metaSource?.email,
    metaSource?.contact?.email
  );

  const { isActive: isTyping, summary: typingSummary } = useTypingIndicator(
    thread?.id
  );

  const shouldShowThreadMeta =
    !isLocked && (Boolean(previewText) || isTyping || Boolean(fallbackPreview));
  const displayPreview = isTyping
    ? fallbackPreview
    : previewText || fallbackPreview;

  const isSelfThread = Boolean(
    thread?.isSelfThread ||
      thread?.id === SELF_THREAD_ID ||
      thread?.user_id === agentSelfId
  );

  const fallbackStatus =
    pickNonEmptyString(thread?.status, metaSource?.status) || "Offline";
  const status = isSelfThread
    ? (presenceStatus ?? fallbackStatus)
    : fallbackStatus;

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

  const messageType =
    pickNonEmptyString(
      normalizedLastMessage?.type,
      metaSource?.messageType,
      metaSource?.message_type,
      thread?.messageType,
      thread?.message_type
    ) || "message";

  // Tick status: only for outgoing messages (sent by current user)
  const lastMsgDirection = pickNonEmptyString(
    metaSource?.lastMessageDirection,
    thread?.lastMessageDirection
  );
  const isLastMsgOutgoing = lastMsgDirection === "outgoing";

  const readStatus = isLastMsgOutgoing
    ? pickNonEmptyString(
        metaSource?.lastMessageStatus,
        thread?.lastMessageStatus,
        metaSource?.lastMessage?.status
      ) || "sent"
    : null;

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

  const messageIconColor = theme.palette.text.secondary;

  const readIconColor = theme.palette.text.disabled;

  const typingLoaderColor = theme.palette.primary.main;

  const displayTimeLabel = timeLabel || "";

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
      onContextMenu={handleContextMenu}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={{
        cursor: disabled ? "not-allowed" : "pointer",
        width: "100%",
        borderRadius: 0.5,
        borderLeft: statusBorder(theme, status),
        p: 0.4,
        // transition: "background-color 0.1s ease, box-shadow 0.1s ease",
        pointerEvents: disabled ? "none" : "auto",
        boxShadow:
          theme.palette.mode === "light"
            ? "0px 1px 1px rgba(0, 0, 0, 0.08)"
            : "0px 1px 1px rgba(255, 255, 255, 0.08)",
        "&:hover .avatar-hover": {
          transform: "scale(1.1)", // Scale avatar on hover
        },
        userSelect: "none",
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
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(theme.palette.primary.main, 0.2)
              : "background.paper",
          color: "text.primary",
          ...(isActive || disabled
            ? {}
            : {
                "&:hover": {
                  backgroundColor: theme.palette.background.neutral,
                },
              }),
        }}
      >
        <Box sx={{ position: "relative", display: "inline-block" }}>
          <Avatar
            className="avatar-hover"
            src={profilePicture || undefined}
            sx={{
              width: 45,
              height: 45,
              bgcolor: profilePicture
                ? "transparent"
                : theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.04)",
              color: theme.palette.text.primary,
              fontSize: 16,
              fontWeight: 500,
              border: `1px solid ${theme.palette.divider}`,
              letterSpacing: "2px",
              transition: "transform 0.3s ease-in-out",
            }}
          >
            {!profilePicture ? initials : null}
          </Avatar>
          {(thread?.isGlobalMember || thread?.isGlobal || thread?.is_global) && (
            <Box
              sx={{
                position: "absolute",
                bottom: -2,
                right: 2,
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: "#FFB020",
                border: `2px solid ${theme.palette.background.paper}`,
              }}
            />
          )}
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color:
                theme.palette.mode === "light"
                  ? "primary.main"
                  : "text.primary",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </Typography>

          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{
              minWidth: 0,
              color: theme.palette.text.secondary,
            }}
          >
            {shouldShowThreadMeta && (
              <>
                {isLastMsgOutgoing && readStatus && readStatusIcon(readStatus, readIconColor)}
                {normalizedLastMessage && messageTypeIcon(messageType, messageIconColor)}
              </>
            )}

            <Typography
              variant="caption"
              component="div"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flexGrow: 1,
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
                displayPreview
              )}
            </Typography>
          </Stack>
        </Box>

        {shouldShowThreadMeta && (
          <>
            <Stack spacing={0.75} alignItems="flex-end" height="45px">
              <Typography
                variant="caption"
                sx={{
                  opacity: isActive ? 0.9 : 0.7,
                  flexShrink: 0,
                  textWrap: "nowrap",
                }}
              >
                {displayTimeLabel}
              </Typography>
              {unreadCount > 0 ? (
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
                  {unreadCount}
                </Box>
              ) : null}
              {isMuted && (
                <PiBellSlashBold size={14} style={{ opacity: 0.5, marginTop: 2 }} />
              )}
              {isPinned && (
                <PiPushPinFill size={12} style={{ opacity: 0.7, marginTop: 2, color: theme.palette.primary.main }} />
              )}
            </Stack>
          </>
        )}
      </Stack>

      {/* Right-click context menu */}
      <Menu
        open={!!ctxMenu}
        onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
        transitionDuration={0}
        slotProps={{ paper: { sx: { borderRadius: 1, minWidth: 180 } } }}
      >
        <MenuItem
          onClick={() => { onPin?.(thread?.id, !isPinned); setCtxMenu(null); }}
        >
          <ListItemIcon>
            {isPinned ? <PiPushPinSlashBold size={16} /> : <PiPushPinBold size={16} />}
          </ListItemIcon>
          <ListItemText>{isPinned ? "Unpin chat" : "Pin chat"}</ListItemText>
        </MenuItem>
        {isMuted ? (
          <MenuItem onClick={() => { onUnmute?.(thread?.id); setCtxMenu(null); }}>
            <ListItemIcon><PiBellBold size={16} /></ListItemIcon>
            <ListItemText>Unmute</ListItemText>
          </MenuItem>
        ) : (
          [
            { label: "Mute 1 hour", duration: "1h" },
            { label: "Mute 8 hours", duration: "8h" },
            { label: "Mute 1 week", duration: "1w" },
            { label: "Mute forever", duration: "forever" },
          ].map((opt) => (
            <MenuItem key={opt.duration} onClick={() => { onMute?.(thread?.id, opt.duration); setCtxMenu(null); }}>
              <ListItemIcon><PiBellSlashBold size={16} /></ListItemIcon>
              <ListItemText>{opt.label}</ListItemText>
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  );
};

export default ChatElement;
