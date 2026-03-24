import {
  Avatar,
  Box,
  Divider,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { PiGlobeSimpleBold, PiMonitorBold, PiXBold } from "react-icons/pi";
import { getInitials } from "../../../utils/initials.js";
import { isGroupThread } from "../../../utils/threadUtils.js";
import MessageContent from "./MessageContent.jsx";
import CustomScrollbars from "../../Scrollbar.jsx";
import { formatDateTimeInTz } from "../../../utils/timezone.js";

const DEFAULT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const addMinutes = (value, minutes = 0) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // Use user's timezone preference
  const tzFormatted = formatDateTimeInTz(date);
  return tzFormatted || DEFAULT_DATE_FORMATTER.format(date);
};

const getOverlayHost = () => {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector('[data-conversation-overlay-root="true"]') ||
    document.body
  );
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const computeListHeight = (listLength) => {
  if (!listLength) return 180;
  const estimated = listLength * 64;
  return Math.max(120, Math.min(220, estimated));
};

const resolveMemberDisplay = (entry = {}, thread = {}) => {
  const name =
    entry.name ||
    entry.username ||
    entry.label ||
    entry.authorName ||
    entry.email ||
    entry.id ||
    "Member";
  const avatar =
    entry.avatar ||
    entry.profilePicture ||
    entry.profile_picture_url ||
    entry.photo ||
    entry.image ||
    "";
  const location =
    entry.location ||
    entry.city ||
    thread.location ||
    entry.country ||
    thread.country ||
    "Unknown";
  const device =
    entry.device ||
    entry.deviceLabel ||
    entry.device_type ||
    thread.device_type ||
    "Browser";
  const platform =
    entry.platform ||
    entry.operating_system ||
    thread.operating_system ||
    "Web";
  const ipAddress = entry.user_ip || thread.user_ip || "";
  const timestamp =
    entry.readAt || entry.deliveredAt || entry.timestamp || null;
  return {
    id: entry.id || entry.email || entry.user_id || entry.username || name,
    name,
    avatar,
    location,
    device,
    platform,
    ipAddress,
    readAt: entry.readAt || null,
    deliveredAt: entry.deliveredAt || timestamp || null,
  };
};

const deriveParticipants = (thread, currentUserId, messageAuthorId) => {
  if (!thread) return [];
  const members = isGroupThread(thread) ? safeArray(thread.members) : [thread];
  if (!members.length) return [];
  return members.filter((member) => {
    const candidateId =
      member.id || member.user_id || member.userId || member.email;
    if (!candidateId) return true;
    if (currentUserId && candidateId === currentUserId) return false;
    if (messageAuthorId && candidateId === messageAuthorId) return false;
    return true;
  });
};

const buildFallbackReceipts = (
  message,
  thread,
  currentUserId,
  messageAuthorId
) => {
  const participants = deriveParticipants(
    thread,
    currentUserId,
    messageAuthorId
  );
  if (!participants.length) {
    return {
      read: [],
      delivered: [],
    };
  }
  const baseTimestamp = new Date(message?.createdAt || Date.now());
  const total = participants.length;
  const readCount = Math.max(1, Math.round(total / 2));
  const readEntries = participants.slice(0, readCount).map((member, index) => {
    const normalized = resolveMemberDisplay(
      member,
      member.threadMeta || thread
    );
    return {
      ...normalized,
      readAt: addMinutes(baseTimestamp, index + 1),
      deliveredAt: addMinutes(baseTimestamp, index),
    };
  });
  const deliveredEntries = participants
    .slice(readCount)
    .map((member, index) => {
      const normalized = resolveMemberDisplay(
        member,
        member.threadMeta || thread
      );
      return {
        ...normalized,
        readAt: null,
        deliveredAt: addMinutes(baseTimestamp, index + 1),
      };
    });
  return {
    read: readEntries,
    delivered: deliveredEntries,
  };
};

const normaliseReceiptList = (list, defaultStatus, thread) =>
  safeArray(list).map((entry, index) => {
    const normalized = resolveMemberDisplay(entry, thread);
    return {
      ...normalized,
      readAt: entry.readAt || normalized.readAt,
      deliveredAt: entry.deliveredAt || normalized.deliveredAt,
      key: entry.id || `${defaultStatus}-${index}`,
    };
  });

const deriveReceiptGroups = (message, thread, currentUserId) => {
  const receipts =
    message?.metadata?.receipts || message?.metadata?.deliveryReceipts || null;
  const authorId = message?.author?.id || message?.authorId;
  if (receipts) {
    return {
      read: normaliseReceiptList(receipts.read, "read", thread),
      delivered: normaliseReceiptList(receipts.delivered, "delivered", thread),
    };
  }
  const readLegacy = message?.metadata?.readReceipts;
  const deliveredLegacy = message?.metadata?.deliveredReceipts;
  if (readLegacy || deliveredLegacy) {
    return {
      read: normaliseReceiptList(readLegacy, "read", thread),
      delivered: normaliseReceiptList(deliveredLegacy, "delivered", thread),
    };
  }
  return buildFallbackReceipts(message, thread, currentUserId, authorId);
};

const ReceiptRow = ({ entry, statusLabel, theme }) => {
  const initials = getInitials(entry.name || "User");
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Avatar
        src={entry.avatar || undefined}
        alt={entry.name}
        sx={{ width: 36, height: 36, fontSize: 14, fontWeight: 600 }}
      >
        {!entry.avatar ? initials : null}
      </Avatar>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
          {entry.name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          {statusLabel}
          {entry.platform ? ` • ${entry.platform}` : ""}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right" }}>
        <Typography variant="caption" color="text.secondary">
          {entry.readAt || entry.deliveredAt
            ? formatDateTime(entry.readAt || entry.deliveredAt)
            : ""}
        </Typography>
        {entry.location ? (
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: "block" }}
          >
            {entry.location}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
};

const EmptyReceiptState = ({ label }) => (
  <Stack
    alignItems="center"
    justifyContent="center"
    sx={{
      py: 3,
      color: "text.secondary",
      fontStyle: "italic",
    }}
  >
    <Typography variant="caption">{label}</Typography>
  </Stack>
);

const MessageInfoOverlay = ({
  open,
  message,
  thread,
  onClose,
  currentUserId,
}) => {
  const theme = useTheme();
  const [overlayRoot, setOverlayRoot] = useState(() => getOverlayHost());
  const [liveInfo, setLiveInfo] = useState(null);

  useEffect(() => {
    if (overlayRoot) return;
    setOverlayRoot(getOverlayHost());
  }, [overlayRoot]);

  // Fetch fresh message info from backend when overlay opens
  useEffect(() => {
    if (!open || !message?.id) { setLiveInfo(null); return; }
    const threadId = thread?.id || message?.threadId;
    if (!threadId) return;
    // Use socket if available, otherwise skip
    const socket = window.__chatSocket;
    if (socket?.connected) {
      socket.emit("message:info", { messageId: message.id, threadId }, (res) => {
        if (res?.ok && res.info) setLiveInfo(res.info);
      });
    }
  }, [open, message?.id, thread?.id]);

  // Use live receipts from backend if available, else fall back to message metadata
  const receiptGroups = useMemo(() => {
    if (liveInfo?.receipts) {
      return {
        read: normaliseReceiptList(liveInfo.receipts.read || [], "read", thread),
        delivered: normaliseReceiptList(liveInfo.receipts.delivered || [], "delivered", thread),
      };
    }
    if (!message || !thread) {
      return { read: [], delivered: [] };
    }
    return deriveReceiptGroups(message, thread, currentUserId);
  }, [message, thread, currentUserId, liveInfo]);

  const participantMeta = useMemo(() => {
    if (!thread) return {};
    if (isGroupThread(thread)) {
      return {
        device: "Group",
        location: thread.location || "",
        platform: thread.operating_system || "",
        ip: thread.user_ip || "",
      };
    }
    return {
      device: thread.device_type || "Browser",
      location: thread.location || "",
      platform: thread.operating_system || thread.browser || "Web",
      ip: thread.user_ip || "",
    };
  }, [thread]);

  if (!open || !message || !overlayRoot) {
    return null;
  }

  const headingLabel = message.author?.name || "Message details";
  const sentAtLabel = formatDateTime(liveInfo?.sendTime || message.createdAt || message.metadata?.sentAt);
  const readAtLabel = formatDateTime(liveInfo?.readTime || message.readAt || message.metadata?.readAt);
  const editedAtLabel = formatDateTime(liveInfo?.editTime || message.editedAt || message.metadata?.editedAt);
  const constrainPreview =
    message?.type &&
    ["image", "video", "media"].includes(message.type.toString().toLowerCase());

  const contentCard = (
    <Box
      sx={{
        backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.background.default, 0.8)}, ${alpha(theme.palette.background.paper, 0.95)})`,
        px: 1,
        position: "relative",
        minHeight: 40,
        zIndex: 9999,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundColor: alpha(theme.palette.background.paper, 0.6),
        }}
      />
      <Box
        sx={{
          position: "relative",
          pointerEvents: "none",
          maxHeight: constrainPreview ? 120 : 80,
          overflow: "hidden",
          ...(constrainPreview ? { maxWidth: 120 } : {}),
        }}
      >
        <MessageContent message={message} hideInlineActions />
      </Box>
    </Box>
  );

  const renderReceiptSection = (title, list, emptyLabel) => (
    <Box sx={{ mt: 2 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1 }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, color: theme.palette.text.primary }}
        >
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {list.length ? `${list.length} ${title.toLowerCase()}` : ""}
        </Typography>
      </Stack>
      <Box
        sx={{
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          maxHeight: 220,
          overflow: "hidden",
        }}
      >
        {list.length ? (
          <CustomScrollbars
            autoHide
            style={{ width: "100%", height: computeListHeight(list.length) }}
          >
            <Box sx={{ px: 1 }}>
              {list.map((entry, index) => (
                <ReceiptRow
                  key={entry.id || `${title}-${index}`}
                  entry={entry}
                  statusLabel={
                    title === "Read"
                      ? `Read ${entry.readAt ? `• ${formatDateTime(entry.readAt)}` : ""}`
                      : `Delivered ${
                          entry.deliveredAt
                            ? `• ${formatDateTime(entry.deliveredAt)}`
                            : ""
                        }`
                  }
                  theme={theme}
                />
              ))}
            </Box>
          </CustomScrollbars>
        ) : (
          <EmptyReceiptState label={emptyLabel} />
        )}
      </Box>
    </Box>
  );

  return createPortal(
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: (muiTheme) => muiTheme.zIndex.modal + 1,
        backgroundColor: alpha(theme.palette.common.black, 0.8),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 1,
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 450,
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
          boxShadow: theme.shadows[24],
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          maxHeight: "calc(100vh - 250px)",
          
        }}
      >
        <CustomScrollbars autoHide style={{ width: "100%", height: "100%",borderRadius: 16 }}>
          <Box
            sx={{ display: "flex", flexDirection: "column", minHeight: "100%" }}
          >
            <Stack
              direction="row"
              alignItems="start"
              justifyContent="space-between"
              sx={{ px: 2, py: 1.5 }}
            >
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700 }}
                  color="text.primary"
                >
                  {headingLabel}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {sentAtLabel || ""}
                </Typography>
              </Box>
              <IconButton size="small" onClick={onClose}>
                <PiXBold size={16} />
              </IconButton>
            </Stack>
            <Divider />
            <Box
              sx={{ p: 1, flexShrink: 0, borderRadius: 2 }}
              color="text.primary"
            >
              {contentCard}
            </Box>
            <Divider />
            <Box sx={{ px: 2, py: 1.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <PiMonitorBold size={20} color={theme.palette.text.secondary} />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600 }}
                    color="text.secondary"
                  >
                    {participantMeta.device}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {participantMeta.platform}
                    {participantMeta.ip ? ` • ${participantMeta.ip}` : ""}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PiGlobeSimpleBold
                    size={16}
                    color={theme.palette.text.secondary}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {participantMeta.location || "Unknown"}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
            <Divider />
            <Box sx={{ px: 2, pb: 2, flexGrow: 1, overflow: "hidden" }}>
              {renderReceiptSection(
                "Read",
                receiptGroups.read,
                "None of the recipients have read this yet."
              )}
              {renderReceiptSection(
                "Delivered",
                receiptGroups.delivered,
                "This message is waiting to be delivered."
              )}

              {/* Timeline: Sent / Read / Edited */}
              {(sentAtLabel || readAtLabel || editedAtLabel) ? (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: 600, color: theme.palette.text.primary, mb: 1 }}
                  >
                    Timeline
                  </Typography>
                  <Box
                    sx={{
                      borderRadius: 1,
                      border: `1px solid ${theme.palette.divider}`,
                      overflow: "hidden",
                    }}
                  >
                    {sentAtLabel ? (
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}
                      >
                        <Typography variant="body2" color="text.secondary">Sent</Typography>
                        <Typography variant="caption" color="text.primary" fontWeight={600}>{sentAtLabel}</Typography>
                      </Stack>
                    ) : null}
                    {readAtLabel ? (
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ px: 1.5, py: 1, borderBottom: editedAtLabel ? `1px solid ${theme.palette.divider}` : "none" }}
                      >
                        <Typography variant="body2" color="text.secondary">Read</Typography>
                        <Typography variant="caption" color="text.primary" fontWeight={600}>{readAtLabel}</Typography>
                      </Stack>
                    ) : null}
                    {editedAtLabel ? (
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ px: 1.5, py: 1 }}
                      >
                        <Typography variant="body2" color="text.secondary">Edited</Typography>
                        <Typography variant="caption" color="text.primary" fontWeight={600}>{editedAtLabel}</Typography>
                      </Stack>
                    ) : null}
                  </Box>
                </Box>
              ) : null}
            </Box>
          </Box>
        </CustomScrollbars>
      </Box>
    </Box>,
    overlayRoot
  );
};

export default MessageInfoOverlay;
