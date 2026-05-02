import {
  Avatar,
  Box,
  Alert,
  Button,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Popover,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Slide,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchThreadMedia } from "../../../services/chatApi.js";
import {
  PiArrowLeftBold,
  PiCheckBold,
  PiCopySimpleBold,
  PiImageBold,
  PiLinkSimpleBold,
  PiMagnifyingGlass,
  PiPencilSimple,
  PiTrashSimpleBold,
  PiUserPlus,
  PiDotsThreeOutlineVertical,
  PiUsersThreeBold,
  PiXBold,
  PiInfoBold,
  PiClockBold,
  PiGearSixBold,
  PiPushPinBold,
} from "react-icons/pi";
import { getInitials } from "../../../utils/initials.js";
import CustomScrollbars from "../../Scrollbar.jsx";
import GroupElement from "../../chats/GroupElement.jsx";
import GroupMembersDialog from "../../chats/GroupMembersDialog.jsx";
import FileAttachmentTile from "../files/FileAttachmentTile.jsx";
import FilePreviewOverlay from "../messages/FilePreviewOverlay.jsx";
import { agentSelfId } from "../../../data/CommonData.js";
import {
  formatTime,
  getMessagePlainText,
  normalizeMessage,
} from "../messages/helpers.js";

const DEFAULT_LABEL = "Conversation";

const getTimestamp = (value) => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const byRecent = (a, b) =>
  getTimestamp(b?.createdAt) - getTimestamp(a?.createdAt);

const buildMessageSnippet = (message) => {
  if (!message) return "";
  if (message.type === "link") {
    return message.content?.title || message.content?.url || "Shared link";
  }
  if (message.type === "file") {
    return message.content?.fileName || "File attachment";
  }
  if (message.type === "image") {
    return message.content?.fileName || "Image";
  }
  if (message.type === "video") {
    return message.content?.fileName || "Video";
  }
  if (message.type === "audio") {
    return message.content?.fileName || "Audio";
  }
  if (message.type === "code") {
    return message.content?.filename || "Code snippet";
  }
  const text = getMessagePlainText(message);
  if (text) return text;
  return message.content?.caption || "Message";
};

const buildAuthorLabel = (message) =>
  message?.author?.name ||
  message?.authorName ||
  message?.sender_name ||
  message?.senderName ||
  "Member";

const formatDetailValue = (value) => {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "number") return String(value);
  const trimmed = String(value).trim();
  return trimmed ? trimmed : "N/A";
};

const isGroupThread = (thread) => {
  const type = thread?.type || thread?.threadType || thread?.conversationType;
  if (!type) return Boolean(thread?.members || thread?.participants);
  return String(type).toLowerCase() === "group";
};

const getGroupTitle = (thread) =>
  thread?.groupName || thread?.label || thread?.name || DEFAULT_LABEL;

const getGroupDescription = (thread) =>
  thread?.description ||
  thread?.groupDescription ||
  thread?.topic ||
  "No description set.";

const getGroupCreator = (thread) => {
  const createdBy = thread?.createdBy ?? thread?.created_by ?? null;
  const createdById =
    createdBy?.id || thread?.createdBy?.id || thread?.created_by?.id || createdBy;
  if (createdById === agentSelfId) return "You";
  const resolvedName =
    createdBy?.name ||
    createdBy?.label ||
    (typeof createdBy === "string" ? createdBy : null) ||
    thread?.createdBy?.name ||
    thread?.createdBy?.label ||
    thread?.created_by?.name ||
    thread?.created_by ||
    thread?.createdBy ||
    "Unknown";
  if (String(resolvedName).trim().toLowerCase() === "myself") {
    return "You";
  }
  return resolvedName;
};

const resolveMemberRoleLabel = (member, thread) =>
  member?.role ||
  member?.designation ||
  member?.title ||
  (thread?.isSelfThread || member?.id === thread?.user_id ? "You" : "Member");

const isAdminRole = (value) => {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("admin") || normalized.includes("owner");
};

const isGroupAdmin = (thread) => {
  if (typeof window !== "undefined") {
    const role = window.localStorage.getItem("role");
    if (role === "1") return true;
  }
  if (thread?.isAdmin || thread?.isGroupAdmin || thread?.isOwner) return true;
  if (thread?.createdBy?.id === agentSelfId) return true;
  const members = Array.isArray(thread?.members) ? thread.members : [];
  return members.some(
    (member) => member?.id === agentSelfId && isAdminRole(member?.role)
  );
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ConversationInfoSidebar = ({
  thread,
  messages,
  onLeaveGroup,
  onDeleteGroup,
  onHideGroupThread,
  onGroupEvent,
  onMemberViewProfile,
  onMemberDirectMessage,
  onUpdateGroup,
  availableMembers = [],
  commonGroups = [],
  onOpenGroup,
  activeThreadId,
  open,
  onClose,
  width = 360,
  order,
}) => {
  const theme = useTheme();
  const [viewMode, setViewMode] = useState("default");
  const [mediaTab, setMediaTab] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewActiveId, setPreviewActiveId] = useState(null);
  const [copyToast, setCopyToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [activeMemberProfile, setActiveMemberProfile] = useState(null);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupDescriptionDraft, setGroupDescriptionDraft] = useState("");
  const [groupDescriptionDisplay, setGroupDescriptionDisplay] = useState("");
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [actionToast, setActionToast] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    action: null,
  });
  const [groupAvatarPreview, setGroupAvatarPreview] = useState("");
  const [groupAvatarRemoved, setGroupAvatarRemoved] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberMenuAnchor, setMemberMenuAnchor] = useState(null);
  const [memberMenuTarget, setMemberMenuTarget] = useState(null);
  const [editMembersOpen, setEditMembersOpen] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [groupTab, setGroupTab] = useState(0);
  const avatarInputRef = useRef(null);
  const avatarObjectUrlRef = useRef("");
  const isGroup = isGroupThread(thread);
  const isAdmin = isGroup && isGroupAdmin(thread);
  const canManageGroup = isGroup; // All members can add/edit members
  const canEditDescription = isGroup;
  const canDeleteGroup = Boolean(isAdmin); // Only admin can delete

  const profilePicture =
    thread?.profilePicture ??
    thread?.avatar ??
    thread?.contact?.avatar ??
    thread?.contact?.profilePicture ??
    null;

  const displayLabel =
    thread?.label ||
    thread?.username ||
    thread?.fullName ||
    thread?.name ||
    DEFAULT_LABEL;

  const initials =
    thread?.initialsOverride?.slice?.(0, 2)?.toUpperCase?.() ||
    getInitials(displayLabel);

  const groupTitle = groupNameDraft || getGroupTitle(thread);
  const groupDescription =
    groupDescriptionDisplay.trim() || "No description set.";
  const groupCreator = getGroupCreator(thread);
  const groupCreatedOn = formatDateTime(
    thread?.createdAt || thread?.created_at
  );
  const groupDescriptionValue =
    thread?.description || thread?.groupDescription || thread?.topic || "";
  const members = useMemo(() => {
    const base = Array.isArray(thread?.members)
      ? thread.members
      : Array.isArray(thread?.participants)
        ? thread.participants.map((value, index) => ({
            id: `member-${index}`,
            name: String(value),
          }))
        : [];
    // If backend returned members (have real IDs), don't add "You" — user already in the list
    if (base.length > 0) return base;
    return [{ id: agentSelfId, name: "You", role: "You" }];
  }, [thread?.members, thread?.participants]);

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      const name = String(
        member?.name ||
          member?.label ||
          member?.username ||
          member?.email ||
          ""
      )
        .toLowerCase()
        .trim();
      return name.includes(query);
    });
  }, [memberSearch, members]);

  useEffect(() => {
    setGroupNameDraft("");
    setGroupDescriptionDraft("");
    setEditingGroupName(false);
    setDescriptionDialogOpen(false);
    setShowFullDescription(false);
    setActiveMemberProfile(null);
    setGroupAvatarPreview("");
    setGroupAvatarRemoved(false);
    setMemberSearch("");
    setMemberMenuAnchor(null);
    setMemberMenuTarget(null);
    setEditMembersOpen(false);
    setConfirmDialog({ open: false, action: null });
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = "";
    }
  }, [thread?.id]);

  useEffect(() => {
    setGroupDescriptionDisplay(groupDescriptionValue);
  }, [thread?.id, groupDescriptionValue]);

  const memberDisplayName = useMemo(() => {
    if (!activeMemberProfile) return "";
    const name =
      activeMemberProfile?.name ||
      activeMemberProfile?.label ||
      activeMemberProfile?.username ||
      activeMemberProfile?.email ||
      "Member";
    const resolvedName = String(name).trim();
    if (!resolvedName) return "Member";
    return resolvedName.toLowerCase() === "myself" ? "You" : resolvedName;
  }, [activeMemberProfile]);

  const memberProfileAvatar =
    activeMemberProfile?.avatar ||
    activeMemberProfile?.profilePicture ||
    activeMemberProfile?.photo ||
    "";

  const memberProfileSubtitle =
    activeMemberProfile?.company ||
    activeMemberProfile?.organizationLabel ||
    activeMemberProfile?.domain_name ||
    activeMemberProfile?.designation ||
    activeMemberProfile?.title ||
    activeMemberProfile?.role ||
    activeMemberProfile?.status ||
    "Active";

  const memberPersonalDetails = [
    { label: "Email", value: activeMemberProfile?.email },
    { label: "Mobile", value: activeMemberProfile?.mobile || activeMemberProfile?.phone },
  ];

  const memberBusinessDetails = [
    { label: "Designation", value: activeMemberProfile?.designation || activeMemberProfile?.title },
    { label: "Department", value: activeMemberProfile?.department },
    { label: "Location", value: activeMemberProfile?.location },
  ];

  const hasMemberPersonalDetails = memberPersonalDetails.some(
    (entry) =>
      entry.value !== null &&
      entry.value !== undefined &&
      `${entry.value}`.trim()
  );

  const hasMemberBusinessDetails = memberBusinessDetails.some(
    (entry) =>
      entry.value !== null &&
      entry.value !== undefined &&
      `${entry.value}`.trim()
  );

  const normalizedMessages = useMemo(() => {
    if (!Array.isArray(messages)) return [];
    return messages
      .map((message) =>
        message?.__normalized ? message : normalizeMessage(message)
      )
      .filter(Boolean);
  }, [messages]);

  // ─── API-based media/links/docs/pinned (full DB, not just loaded chat) ──
  const [apiMedia, setApiMedia] = useState({ images: [], media: [], links: [], docs: [], pinned: [] });
  const [apiCounts, setApiCounts] = useState({ images: 0, media: 0, links: 0, docs: 0, pinned: 0 });
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const mediaThreadRef = useRef(null);

  const loadThreadMedia = useCallback(async (tid) => {
    if (!tid) return;
    try {
      const [imgRes, mediaRes, linkRes, docRes, pinRes] = await Promise.all([
        fetchThreadMedia(tid, "images"),
        fetchThreadMedia(tid, "media"),
        fetchThreadMedia(tid, "links"),
        fetchThreadMedia(tid, "docs"),
        fetchThreadMedia(tid, "pinned"),
      ]);
      setApiMedia({
        images: (imgRes.messages || []).map((m) => m.__normalized ? m : normalizeMessage(m)).filter(Boolean),
        media: (mediaRes.messages || []).map((m) => m.__normalized ? m : normalizeMessage(m)).filter(Boolean),
        links: (linkRes.messages || []).map((m) => m.__normalized ? m : normalizeMessage(m)).filter(Boolean),
        docs: (docRes.messages || []).map((m) => m.__normalized ? m : normalizeMessage(m)).filter(Boolean),
        pinned: (pinRes.messages || []).map((m) => m.__normalized ? m : normalizeMessage(m)).filter(Boolean),
      });
      setApiCounts(imgRes.counts || { images: 0, media: 0, links: 0, docs: 0, pinned: 0 });
      setMediaLoaded(true);
    } catch (err) {
      console.warn("[sidebar] media API error:", err?.message);
      setMediaLoaded(false);
    }
  }, []);

  const messagesLength = Array.isArray(messages) ? messages.length : 0;
  useEffect(() => {
    const tid = activeThreadId || thread?.id;
    if (!open || !tid) return;
    // Reload when thread changes or new messages arrive while sidebar is open
    if (mediaThreadRef.current === tid && mediaLoaded && !messagesLength) return;
    if (mediaThreadRef.current !== tid) {
      mediaThreadRef.current = tid;
      setMediaLoaded(false);
    }
    loadThreadMedia(tid);
  }, [open, activeThreadId, thread?.id, loadThreadMedia]);

  // Fetch group timeline when sidebar opens for a group
  useEffect(() => {
    if (!open || !isGroup) { setTimeline([]); return; }
    const groupId = thread?.group_id || thread?.id?.replace?.("group-", "");
    if (!groupId) return;
    let cancelled = false;
    setTimelineLoading(true);
    import("../../../services/chatApi.js").then(({ fetchGroupTimeline }) => {
      fetchGroupTimeline(groupId, { limit: 50 })
        .then((data) => { if (!cancelled) setTimeline(Array.isArray(data) ? data : []); })
        .catch(() => { if (!cancelled) setTimeline([]); })
        .finally(() => { if (!cancelled) setTimelineLoading(false); });
    });
    return () => { cancelled = true; };
  }, [open, isGroup, thread?.id, thread?.group_id]);

  // Use API data if loaded, otherwise fall back to local filtering
  const pinnedMessages = useMemo(() => {
    if (mediaLoaded) return apiMedia.pinned.sort(byRecent);
    return normalizedMessages.filter((m) => m?.metadata?.pinned).sort(byRecent);
  }, [mediaLoaded, apiMedia.pinned, normalizedMessages]);

  const imageMessages = useMemo(() => {
    if (mediaLoaded) return apiMedia.images.sort(byRecent);
    return normalizedMessages.filter((m) => m?.type === "image").sort(byRecent);
  }, [mediaLoaded, apiMedia.images, normalizedMessages]);

  const mediaOnlyMessages = useMemo(() => {
    if (mediaLoaded) return apiMedia.media.sort(byRecent);
    return normalizedMessages.filter((m) => ["video", "audio"].includes(m?.type)).sort(byRecent);
  }, [mediaLoaded, apiMedia.media, normalizedMessages]);

  const mediaMessages = useMemo(
    () => [...imageMessages, ...mediaOnlyMessages],
    [imageMessages, mediaOnlyMessages]
  );

  const linkMessages = useMemo(() => {
    if (mediaLoaded) return apiMedia.links.sort(byRecent);
    return normalizedMessages.filter((m) => m?.type === "link").sort(byRecent);
  }, [mediaLoaded, apiMedia.links, normalizedMessages]);

  const fileMessages = useMemo(() => {
    if (mediaLoaded) return apiMedia.docs.sort(byRecent);
    return normalizedMessages.filter((m) => ["file", "code"].includes(m?.type)).sort(byRecent);
  }, [mediaLoaded, apiMedia.docs, normalizedMessages]);

  const totalAssets = mediaLoaded
    ? (apiCounts.images + apiCounts.media + apiCounts.links + apiCounts.docs)
    : (mediaMessages.length + linkMessages.length + fileMessages.length);

  const personalDetails = [
    { label: "Email", value: thread?.email },
    { label: "Mobile", value: thread?.mobile },
  ];

  const businessDetails = [
    { label: "Designation", value: thread?.designation },
    { label: "Department", value: thread?.department },
    { label: "Location", value: thread?.location },
  ];

  const hasPersonalDetails = personalDetails.some(
    (entry) =>
      entry.value !== null &&
      entry.value !== undefined &&
      `${entry.value}`.trim()
  );
  const hasBusinessDetails = businessDetails.some(
    (entry) =>
      entry.value !== null &&
      entry.value !== undefined &&
      `${entry.value}`.trim()
  );

  const closeCopyToast = () => {
    setCopyToast((prev) => ({ ...prev, open: false }));
  };

  const closeActionToast = () => {
    setActionToast((prev) => ({ ...prev, open: false }));
  };

  const handleGroupNameEditStart = () => {
    if (!canManageGroup) return;
    setGroupNameDraft(getGroupTitle(thread));
    setEditingGroupName(true);
  };

  const handleGroupNameEditCancel = () => {
    setEditingGroupName(false);
    setGroupNameDraft("");
  };

  const handleGroupNameSave = () => {
    if (!canManageGroup) return;
    const trimmed = groupNameDraft.trim();
    if (!trimmed) {
      setActionToast({
        open: true,
        message: "Group name cannot be empty",
        severity: "error",
      });
      return;
    }
    const previousName = getGroupTitle(thread);
    if (trimmed !== previousName) {
      onGroupEvent?.(thread, {
        action: "group_renamed",
        groupName: trimmed,
      });
    }
    setGroupNameDraft(trimmed);
    setEditingGroupName(false);
    setActionToast({
      open: true,
      message: "Group name updated",
      severity: "success",
    });
  };

  const handleOpenDescriptionDialog = () => {
    setGroupDescriptionDraft(groupDescriptionDisplay);
    setDescriptionDialogOpen(true);
  };

  const handleCloseDescriptionDialog = () => {
    setGroupDescriptionDraft(groupDescriptionDisplay);
    setDescriptionDialogOpen(false);
  };

  const handleDescriptionSave = () => {
    if (!canManageGroup) {
      setActionToast({
        open: true,
        message: "Only admins can update description",
        severity: "error",
      });
      return;
    }
    const trimmed = groupDescriptionDraft.trim();
    const previousDescription = groupDescriptionDisplay.trim();
    if (trimmed !== previousDescription) {
      onGroupEvent?.(thread, {
        action: "group_description_updated",
      });
    }
    setGroupDescriptionDisplay(trimmed);
    setDescriptionDialogOpen(false);
    setActionToast({
      open: true,
      message: "Description updated",
      severity: "success",
    });
  };

  const handleAvatarEditClick = () => {
    if (!canManageGroup) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = (event) => {
    if (!canManageGroup) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = "";
    }
    const objectUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = objectUrl;
    setGroupAvatarPreview(objectUrl);
    setGroupAvatarRemoved(false);
    event.target.value = "";
    onGroupEvent?.(thread, {
      action: "group_photo_updated",
      text: "You updated the group photo",
    });
  };

  const handleAvatarDelete = () => {
    if (!canManageGroup) return;
    if (!groupAvatarPreview && !profilePicture && !groupAvatarRemoved) {
      setActionToast({
        open: true,
        message: "No avatar to remove",
        severity: "info",
      });
      return;
    }
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = "";
    }
    setGroupAvatarPreview("");
    setGroupAvatarRemoved(true);
    setActionToast({
      open: true,
      message: "Group photo removed",
      severity: "success",
    });
    onGroupEvent?.(thread, {
      action: "group_photo_updated",
      text: "You removed the group photo",
    });
  };

  const handleOpenConfirm = (action) => {
    setConfirmDialog({ open: true, action });
  };

  const handleCloseConfirm = () => {
    setConfirmDialog({ open: false, action: null });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.action) return;
    const action = confirmDialog.action;
    handleCloseConfirm();
    const handler = action === "delete" ? onDeleteGroup : onLeaveGroup;
    if (!handler) return;
    try {
      const result = await handler(thread);
      if (result === false) {
        setActionToast({
          open: true,
          message:
            action === "delete"
              ? "Unable to delete group"
              : "Unable to leave group",
          severity: "error",
        });
        return;
      }
      setActionToast({
        open: true,
        message:
          action === "delete" ? "Group deleted" : "You left the group",
        severity: "success",
      });
    } catch {
      setActionToast({
        open: true,
        message:
          action === "delete"
            ? "Unable to delete group"
            : "Unable to leave group",
        severity: "error",
      });
    }
  };

  const handleOpenMemberMenu = (event, member) => {
    setMemberMenuAnchor(event.currentTarget);
    setMemberMenuTarget(member);
  };

  const handleCloseMemberMenu = () => {
    setMemberMenuAnchor(null);
    setMemberMenuTarget(null);
  };

  const handleMemberAction = (action) => {
    if (!memberMenuTarget) return;
    const targetId =
      memberMenuTarget?.id ||
      memberMenuTarget?.user_id ||
      memberMenuTarget?.userId ||
      "";
    if (
      targetId === agentSelfId ||
      String(memberMenuTarget?.name || "")
        .trim()
        .toLowerCase() === "you"
    ) {
      handleCloseMemberMenu();
      return;
    }
    if (action === "view") {
      setActiveMemberProfile(memberMenuTarget);
      setViewMode("member");
    }
    if (action === "message") {
      onMemberDirectMessage?.(memberMenuTarget);
    }
    handleCloseMemberMenu();
  };

  const handleOpenEditMembers = () => {
    if (!canManageGroup) return;
    setEditMembersOpen(true);
  };

  const handleCloseEditMembers = () => {
    setEditMembersOpen(false);
  };

  const handleSubmitGroupEdit = async (payload = {}) => {
    if (!onUpdateGroup) return false;
    const result = await onUpdateGroup(thread, payload);
    if (result !== false) {
      setEditMembersOpen(false);
    }
    return result;
  };

  const copyValue = async (value) => {
    const raw = value === null || value === undefined ? "" : String(value);
    const trimmed = raw.trim();
    if (!trimmed) {
      setCopyToast({
        open: true,
        message: "Nothing to copy",
        severity: "info",
      });
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(trimmed);
        setCopyToast({
          open: true,
          message: "Copied to clipboard",
          severity: "success",
        });
        return;
      } catch (error) {
        console.warn("Clipboard write failed", error);
      }
    }
    if (typeof document !== "undefined") {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = trimmed;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        const succeeded = document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopyToast({
          open: true,
          message: succeeded ? "Copied to clipboard" : "Unable to copy",
          severity: succeeded ? "success" : "error",
        });
        return;
      } catch (error) {
        console.warn("Clipboard fallback failed", error);
      }
    }
    setCopyToast({
      open: true,
      message: "Unable to copy",
      severity: "error",
    });
  };

  const renderDetailRow = (detail, prefix, allowCopy = true) => (
    <Stack
      key={`${prefix}-${detail.label}`}
      direction="row"
      justifyContent="space-between"
      spacing={1.5}
      alignItems="center"
    >
      <Typography variant="body2" color="text.secondary">
        {detail.label}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="body2" color="text.primary">
          {formatDetailValue(detail.value)}
        </Typography>
        {allowCopy ? (
          <IconButton
            size="small"
            onClick={() => copyValue(detail.value)}
            aria-label={`Copy ${detail.label}`}
            sx={{ p: 0.25 }}
          >
            <PiCopySimpleBold size={14} />
          </IconButton>
        ) : null}
      </Stack>
    </Stack>
  );

  const buildFileEntryFromMessage = (message) => {
    const content = message?.content || {};
    const fileName =
      content.fileName ||
      content.filename ||
      content.name ||
      content.originalName ||
      content.original_name ||
      content.caption ||
      "attachment";
    const mimeType = content.mimeType || content.type || "";
    const type = String(message?.type || "").toLowerCase();
    const isImage =
      type === "image" || String(mimeType).toLowerCase().startsWith("image/");
    const isVideo =
      type === "video" || String(mimeType).toLowerCase().startsWith("video/");
    const normalizePreviewUrl = (value) => {
      if (typeof value !== "string") return "";
      const trimmed = value.trim();
      if (!trimmed) return "";
      if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) return trimmed;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      if (/^\//.test(trimmed) || /^\.\.?\//.test(trimmed)) return trimmed;
      return "";
    };
    const resolvedUrl = content.fileUrl || content.url || content.downloadUrl || content.downloadSource || "";
    const previewCandidate = isImage
      ? content.thumbnail || content.preview || resolvedUrl || ""
      : isVideo
        ? content.thumbnail || content.poster || content.preview || ""
        : "";
    const previewUrl = normalizePreviewUrl(previewCandidate);
    return {
      fileName,
      name: fileName,
      fileSize: content.fileSize ?? content.size ?? content.rawSize ?? null,
      size: content.size ?? content.rawSize ?? content.fileSize ?? null,
      mimeType,
      url: resolvedUrl,
      previewUrl,
    };
  };

  // Build preview entries for overlay from all media types
  const previewEntries = useMemo(() => {
    const fileTypes = ["file", "image", "video", "audio", "code"];
    const pinnedFiles = pinnedMessages.filter((m) => fileTypes.includes(m?.type));
    const seenIds = new Set();
    const all = [...imageMessages, ...mediaOnlyMessages, ...fileMessages, ...pinnedFiles].filter((m) => {
      if (seenIds.has(m?.id)) return false;
      seenIds.add(m?.id);
      return true;
    });
    return all.map((message) => {
      const fileEntry = buildFileEntryFromMessage(message);
      return {
        id: message.id,
        fileName: fileEntry.fileName,
        name: fileEntry.fileName,
        originalFileName: fileEntry.fileName,
        displayName: fileEntry.fileName,
        fileSize: fileEntry.fileSize,
        mimeType: fileEntry.mimeType,
        url: fileEntry.url,
        sourceUrl: fileEntry.url,
        previewUrl: fileEntry.previewUrl,
        type: message?.type,
        createdAt: message?.createdAt || message?.timestamp,
      };
    });
  }, [imageMessages, mediaOnlyMessages, fileMessages]);

  const handleFileClick = useCallback((messageId) => {
    setPreviewActiveId(messageId);
    setPreviewOpen(true);
  }, []);

  const renderFileTiles = (items, emptyLabel) => (
    <Stack spacing={1}>
      {items.length ? (
        items.map((message) => {
          const fileEntry = buildFileEntryFromMessage(message);
          const type = String(message?.type || "").toLowerCase();
          const wantsPreviewPlaceholder =
            (type === "image" || type === "video") && !fileEntry.previewUrl;
          const previewPlaceholder = wantsPreviewPlaceholder ? (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "text.secondary",
                bgcolor: "action.hover",
              }}
            >
              <PiImageBold size={18} />
            </Box>
          ) : null;
          return (
            <FileAttachmentTile
              key={`shared-file-${message.id}`}
              file={fileEntry}
              previewUrl={fileEntry.previewUrl}
              thumbnailSlot={previewPlaceholder}
              variant="compact"
              fullWidth
              onClick={() => handleFileClick(message.id)}
            />
          );
        })
      ) : (
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      )}
    </Stack>
  );

  const handleBackToOverview = () => {
    setViewMode("default");
    setActiveMemberProfile(null);
  };

  const sharedHeaderTitle =
    viewMode === "media"
      ? `Media, Links & Docs (${totalAssets})`
      : viewMode === "member"
        ? memberDisplayName || "Profile"
        : `Pinned Messages (${pinnedMessages.length})`;

  const pinnedSnippetSx = {
    mt: 0.5,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    wordBreak: "break-word",
  };

  const resolveLinkHref = (value) => {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^mailto:/i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("/")) return trimmed;
    return `https://${trimmed}`;
  };

  const getPinnedLinkHref = (message) => {
    if (message?.type !== "link") return "";
    const content = message?.content || {};
    return resolveLinkHref(content.url || content.displayHost || "");
  };

  const renderPinnedSnippet = (message) => {
    const href = getPinnedLinkHref(message);
    if (href) {
      return (
        <Typography
          variant="body2"
          sx={pinnedSnippetSx}
          component="a"
          href={href}
          target="_blank"
          rel="noreferrer"
          color="text.primary"
          style={{ textDecoration: "none" }}
        >
          {buildMessageSnippet(message)}
        </Typography>
      );
    }
    return (
      <Typography variant="body2" sx={pinnedSnippetSx}>
        {buildMessageSnippet(message)}
      </Typography>
    );
  };

  const renderPinnedList = () => {
    const fileTypes = ["file", "image", "video", "audio", "code"];
    return (
      <Stack spacing={1}>
        {pinnedMessages.length ? (
          pinnedMessages.map((message) => {
            const isFile = fileTypes.includes(message?.type);
            return (
              <Box
                key={`pinned-all-${message.id}`}
                onClick={isFile ? () => handleFileClick(message.id) : undefined}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  bgcolor: theme.palette.action.hover,
                  ...(isFile ? { cursor: "pointer", "&:hover": { bgcolor: theme.palette.action.selected } } : {}),
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {buildAuthorLabel(message)} - {formatTime(message.createdAt)}
                </Typography>
                {renderPinnedSnippet(message)}
              </Box>
            );
          })
        ) : (
          <Typography variant="body2" color="text.secondary">
            No pinned messages yet.
          </Typography>
        )}
      </Stack>
    );
  };


  const renderLinkList = (items, emptyLabel) => (
    <Stack spacing={1}>
      {items.length ? (
        items.map((message) => {
          const content = message?.content || {};
          const href = content.url || content.displayHost || "";
          const label = href || "Shared link";
          return (
            <Stack
              key={`link-${message.id}`}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                p: 1,
                bgcolor: theme.palette.action.hover,
              }}
              component={href ? "a" : "div"}
              href={href || undefined}
              target={href ? "_blank" : undefined}
              rel={href ? "noreferrer" : undefined}
            >
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  color: theme.palette.text.secondary,
                }}
              >
                <PiLinkSimpleBold size={14} />
              </Box>
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                  color: "text.primary",
                }}
              >
                {label}
              </Typography>
            </Stack>
          );
        })
      ) : (
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      )}
    </Stack>
  );

  return (
    <>
      <Slide in={open} direction="left" mountOnEnter unmountOnExit>
        <Box
          sx={{
            width,
            height: "100%",
            borderLeft: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.primary.light, 0.04),
            display: "flex",
            flexDirection: "column",
            order,
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              px: 1,
              py: 2.5,
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}
          >
            {viewMode === "default" ? (
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600 }}
                color="text.primary"
              >
                Profile
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton onClick={handleBackToOverview} size="small">
                  <PiArrowLeftBold size={16} />
                </IconButton>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }} color="text.secondary">
                  {sharedHeaderTitle}
                </Typography>
              </Stack>
            )}
            <IconButton onClick={onClose} size="small">
              <PiXBold size={16} />
            </IconButton>
          </Stack>

          <Box sx={{ flex: 1, minHeight: 0 }}>
            {viewMode === "media" ? (
              <Box
                sx={{
                  px: 1,
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                <Stack spacing={2} sx={{ flexShrink: 0 }}>
                  <Tabs
                    value={mediaTab}
                    onChange={(_, nextValue) => setMediaTab(nextValue)}
                    variant="fullWidth"
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{ minHeight: 36 }}
                  >
                    <Tab
                      label={`Images (${imageMessages.length})`}
                      sx={{ minHeight: 36, py: 0.5, px: 1.25 }}
                    />
                    <Tab
                      label={`Media (${mediaOnlyMessages.length})`}
                      sx={{ minHeight: 36, py: 0.5, px: 1.25 }}
                    />
                    <Tab
                      label={`Links (${linkMessages.length})`}
                      sx={{ minHeight: 36, py: 0.5, px: 1.25 }}
                    />
                    <Tab
                      label={`Docs (${fileMessages.length})`}
                      sx={{ minHeight: 36, py: 0.5, px: 1.25 }}
                    />
                  </Tabs>
                </Stack>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <CustomScrollbars>
                    <Box sx={{ p: 1 }}>
                      {mediaTab === 0
                        ? renderFileTiles(imageMessages, "No images shared.")
                        : null}
                      {mediaTab === 1
                        ? renderFileTiles(mediaOnlyMessages, "No media shared.")
                        : null}
                      {mediaTab === 2
                        ? renderLinkList(linkMessages, "No links shared.")
                        : null}
                      {mediaTab === 3
                        ? renderFileTiles(fileMessages, "No files shared.")
                        : null}
                    </Box>
                  </CustomScrollbars>
                </Box>
              </Box>
            ) : (
              <CustomScrollbars style={isGroup && viewMode === "default" ? { overflow: "hidden" } : undefined}>
                <Box sx={{ p: isGroup && viewMode === "default" ? 0 : 2, height: isGroup && viewMode === "default" ? "100%" : "auto", display: isGroup && viewMode === "default" ? "flex" : "block", flexDirection: "column" }}>
                  {viewMode === "pinned" ? (
                    <Stack spacing={2}>{renderPinnedList()}</Stack>
                  ) : null}
                  {viewMode === "member" ? (
                    <Stack spacing={1}>
                      {activeMemberProfile ? (
                        <>
                          <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                          >
                            <Avatar
                              src={memberProfileAvatar || undefined}
                              alt={memberDisplayName || "Member"}
                              sx={{
                                width: 52,
                                height: 52,
                                bgcolor: memberProfileAvatar
                                  ? "transparent"
                                  : "primary.main",
                                color: memberProfileAvatar
                                  ? "inherit"
                                  : "primary.contrastText",
                                fontWeight: 600,
                              }}
                            >
                              {!memberProfileAvatar
                                ? getInitials(memberDisplayName || "Member")
                                : null}
                            </Avatar>
                            <Box>
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 600 }}
                                color="text.primary"
                              >
                                {memberDisplayName || "Member"}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {memberProfileSubtitle}
                              </Typography>
                            </Box>
                          </Stack>

                          <Divider />

                          <Box>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, mb: 1 }}
                              color="text.secondary"
                            >
                              Personal Details
                            </Typography>
                            <Stack spacing={0.75} m={1}>
                              {hasMemberPersonalDetails ? (
                                memberPersonalDetails.map((detail) =>
                                  renderDetailRow(detail, "member-personal")
                                )
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  No personal details available.
                                </Typography>
                              )}
                            </Stack>
                          </Box>

                          <Divider />

                          <Box>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, mb: 1 }}
                              color="text.secondary"
                            >
                              Business Details
                            </Typography>
                            <Stack spacing={0.75} m={1}>
                              {hasMemberBusinessDetails ? (
                                memberBusinessDetails.map((detail) =>
                                  renderDetailRow(detail, "member-business", false)
                                )
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  No business details available.
                                </Typography>
                              )}
                            </Stack>
                          </Box>

                          <Divider />

                          {commonGroups.length > "0" && (
                            <>
                              <Box>
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600, mb: 1 }}
                                  color="text.secondary"
                                >
                                  Groups in common
                                </Typography>
                                <Stack spacing={1}>
                                  {commonGroups.length ? (
                                    commonGroups.map((group) => (
                                      <GroupElement
                                        key={group.id}
                                        thread={group}
                                        isActive={group.id === activeThreadId}
                                        onSelect={onOpenGroup}
                                      />
                                    ))
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      textAlign="center"
                                      p={1}
                                    >
                                      No groups in common.
                                    </Typography>
                                  )}
                                </Stack>
                              </Box>
                              <Divider />
                            </>
                          )}

                          {pinnedMessages.length ? (
                            <Box>
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ mb: 1 }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600 }}
                                  color="text.secondary"
                                >
                                  Pinned Messages ({pinnedMessages.length})
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  sx={{ fontWeight: 600, cursor: "pointer" }}
                                  onClick={() => setViewMode("pinned")}
                                >
                                  View all
                                </Typography>
                              </Stack>
                              <Stack spacing={1}>
                                {pinnedMessages.slice(0, 3).map((message) => (
                                  <Box
                                    key={`pinned-${message.id}`}
                                    sx={{
                                      p: 1,
                                      borderRadius: 1,
                                      bgcolor: theme.palette.action.hover,
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {buildAuthorLabel(message)} -{" "}
                                      {formatTime(message.createdAt)}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={pinnedSnippetSx}
                                      color="text.primary"
                                      component={
                                        message?.type === "link" ? "a" : "div"
                                      }
                                      href={
                                        message?.type === "link"
                                          ? getPinnedLinkHref(message)
                                          : undefined
                                      }
                                      target={
                                        message?.type === "link"
                                          ? "_blank"
                                          : undefined
                                      }
                                      rel={
                                        message?.type === "link"
                                          ? "noreferrer"
                                          : undefined
                                      }
                                      style={
                                        message?.type === "link"
                                          ? {
                                              textDecoration: "none",
                                              color: "inherit",
                                            }
                                          : undefined
                                      }
                                    >
                                      {buildMessageSnippet(message)}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>
                              <Divider />
                            </Box>
                          ) : null}

                          {totalAssets ? (
                            <Box>
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ mb: 1 }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600 }}
                                  color="text.secondary"
                                >
                                  Media, Links & Docs ({totalAssets})
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  sx={{ fontWeight: 600, cursor: "pointer" }}
                                  onClick={() => setViewMode("media")}
                                >
                                  View all
                                </Typography>
                              </Stack>
                              <Stack spacing={1.5}>
                                {linkMessages.length ? (
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Links ({linkMessages.length})
                                    </Typography>
                                    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                      {renderLinkList(
                                        linkMessages.slice(0, 3),
                                        "No links shared."
                                      )}
                                    </Stack>
                                  </Box>
                                ) : null}
                                {mediaMessages.length ? (
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Media ({mediaMessages.length})
                                    </Typography>
                                    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                      {renderFileTiles(
                                        mediaMessages.slice(0, 3),
                                        "No media shared."
                                      )}
                                    </Stack>
                                  </Box>
                                ) : null}

                                {fileMessages.length ? (
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Files ({fileMessages.length})
                                    </Typography>
                                    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                      {renderFileTiles(
                                        fileMessages.slice(0, 3),
                                        "No files shared."
                                      )}
                                    </Stack>
                                  </Box>
                                ) : null}
                              </Stack>
                            </Box>
                          ) : null}
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No profile selected.
                        </Typography>
                      )}
                    </Stack>
                  ) : null}
                  {viewMode === "default" ? (
                    <Stack spacing={1} sx={{ flex: 1, minHeight: 0 }}>
                      {isGroup ? (
                        <Stack sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                          {/* ─── Group Header ─── */}
                          <Stack spacing={1} px={1.5} py={1.25} alignItems="center" direction="row" sx={{ flexShrink: 0 }}>
                            <Box sx={{ position: "relative", "&:hover .group-avatar-overlay": { opacity: 1, pointerEvents: "auto" } }}>
                              <Avatar src={groupAvatarRemoved ? undefined : groupAvatarPreview || profilePicture || undefined} alt={groupTitle}
                                sx={{ width: 52, height: 52, bgcolor: (groupAvatarPreview || profilePicture) ? "transparent" : "primary.main", color: (groupAvatarPreview || profilePicture) ? "inherit" : "primary.contrastText" }}>
                                {!groupAvatarPreview && !profilePicture && !groupAvatarRemoved ? <PiUsersThreeBold size={20} color="#ddd" /> : null}
                              </Avatar>
                              {isAdmin && (
                                <Box className="group-avatar-overlay" sx={{ position: "absolute", inset: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.35)", opacity: 0, pointerEvents: "none", transition: "opacity 0.2s" }}>
                                  <IconButton size="small" onClick={handleAvatarEditClick} sx={{ bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "#fff" } }}><PiPencilSimple size={11} /></IconButton>
                                </Box>
                              )}
                              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                            </Box>
                            <Stack spacing={0.15} flex={1} sx={{ minWidth: 0 }}>
                              {editingGroupName ? (
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <TextField value={groupNameDraft} onChange={(e) => setGroupNameDraft(e.target.value)} size="small" autoFocus sx={{ flex: 1 }} />
                                  <IconButton size="small" onClick={handleGroupNameSave}><PiCheckBold size={14} /></IconButton>
                                  <IconButton size="small" onClick={handleGroupNameEditCancel}><PiXBold size={14} /></IconButton>
                                </Stack>
                              ) : (
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>{groupTitle}</Typography>
                                  {isAdmin && <IconButton size="small" onClick={handleGroupNameEditStart} sx={{ p: 0.25 }}><PiPencilSimple size={11} /></IconButton>}
                                </Stack>
                              )}
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>{members.length} members</Typography>
                            </Stack>
                          </Stack>

                          {/* ─── Tab Bar ─── */}
                          <Tabs value={groupTab} onChange={(_, v) => setGroupTab(v)} variant="fullWidth" textColor="primary" indicatorColor="primary"
                            sx={{ flexShrink: 0, minHeight: 36, borderBottom: 1, borderColor: "divider", "& .MuiTab-root": { minHeight: 36, py: 0 } }}>
                            <Tab icon={<PiInfoBold size={15} />} aria-label="Info" sx={{ minWidth: 0 }} />
                            <Tab icon={<PiUsersThreeBold size={15} />} aria-label="Members" sx={{ minWidth: 0 }} />
                            <Tab icon={<PiClockBold size={15} />} aria-label="Timeline" sx={{ minWidth: 0 }} />
                            <Tab icon={<PiPushPinBold size={15} />} aria-label="Pinned" sx={{ minWidth: 0 }} />
                            <Tab icon={<PiGearSixBold size={15} />} aria-label="Settings" sx={{ minWidth: 0 }} />
                          </Tabs>

                          {/* ─── Scrollable Tab Content ─── */}
                          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", "&::-webkit-scrollbar": { width: 4 }, "&::-webkit-scrollbar-thumb": { bgcolor: theme.palette.divider, borderRadius: 4 } }}>

                            {/* ── Tab 0: Info ── */}
                            {groupTab === 0 && (
                              <Stack spacing={1.5} p={1.5}>
                                <Typography variant="body2" color="text.secondary" sx={showFullDescription ? undefined : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                  {groupDescription}
                                </Typography>
                                {String(groupDescription).length > 100 && (
                                  <Typography variant="caption" color="primary" sx={{ cursor: "pointer", fontWeight: 600 }} onClick={() => setShowFullDescription((p) => !p)}>
                                    {showFullDescription ? "Show less" : "Read more"}
                                  </Typography>
                                )}
                                <Box sx={{ p: 1.25, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.04), border: 1, borderColor: "divider" }}>
                                  <Stack spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Created by</Typography><Typography variant="caption" fontWeight={600}>{formatDetailValue(groupCreator)}</Typography></Stack>
                                    <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Created on</Typography><Typography variant="caption" fontWeight={600}>{groupCreatedOn}</Typography></Stack>
                                    <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Members</Typography><Typography variant="caption" fontWeight={600}>{members.length}</Typography></Stack>
                                    <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">Airtime</Typography><Typography variant="caption" fontWeight={600}>{thread?.is_airtime ? "Enabled" : "Disabled"}</Typography></Stack>
                                  </Stack>
                                </Box>
                              </Stack>
                            )}

                            {/* ── Tab 1: Members ── */}
                            {groupTab === 1 && (
                              <Stack spacing={1} p={1.5}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <TextField value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search..." variant="outlined" size="small" fullWidth
                                    InputProps={{ startAdornment: <InputAdornment position="start"><PiMagnifyingGlass size={13} /></InputAdornment> }}
                                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, height: 34 } }} />
                                  {canManageGroup && <IconButton size="small" onClick={handleOpenEditMembers} sx={{ border: 1, borderColor: "divider", borderRadius: 1.5 }}><PiUserPlus size={15} /></IconButton>}
                                </Stack>
                                <Stack spacing={0.25}>
                                  {filteredMembers.length ? filteredMembers.map((member, index) => {
                                    const name = member?.name || member?.label || member?.username || `Member ${index + 1}`;
                                    const displayName = String(name).trim().toLowerCase() === "myself" ? "You" : name;
                                    const role = resolveMemberRoleLabel(member, thread);
                                    const avatar = member?.avatar || member?.profilePicture || "";
                                    return (
                                      <Stack key={member?.id || index} direction="row" alignItems="center" spacing={1}
                                        sx={{ py: 0.6, px: 0.5, borderRadius: 1.5, transition: "background 0.15s", "&:hover": { bgcolor: "action.hover" } }}>
                                        <Avatar src={avatar || undefined} sx={{ width: 34, height: 34, bgcolor: avatar ? "transparent" : "primary.main", color: avatar ? "inherit" : "primary.contrastText", fontSize: 11, fontWeight: 600 }}>
                                          {!avatar ? getInitials(displayName) : null}
                                        </Avatar>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                          <Typography variant="body2" noWrap fontWeight={500} sx={{ fontSize: 13 }}>{displayName}</Typography>
                                          {isAdminRole(role) ? (
                                            <Typography variant="caption" noWrap sx={{ color: "primary.main", fontWeight: 600, bgcolor: (t) => alpha(t.palette.primary.main, 0.08), px: 0.6, py: 0.1, borderRadius: 0.5, display: "inline-block", fontSize: 9 }}>{role}</Typography>
                                          ) : (
                                            <Typography variant="caption" color="text.disabled" noWrap sx={{ fontSize: 9 }}>{role}</Typography>
                                          )}
                                        </Box>
                                        <IconButton size="small" onClick={(e) => handleOpenMemberMenu(e, member)} sx={{ p: 0.25 }}><PiDotsThreeOutlineVertical size={13} /></IconButton>
                                      </Stack>
                                    );
                                  }) : <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>No members found</Typography>}
                                </Stack>
                              </Stack>
                            )}

                            {/* ── Tab 2: Timeline ── */}
                            {groupTab === 2 && (
                              <Box sx={{ p: 1.5 }}>
                                {timelineLoading ? (
                                  <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>Loading...</Typography>
                                ) : timeline.length ? (
                                  <Stack spacing={0}>
                                    {timeline.map((event, idx) => (
                                      <Stack key={event.timeline_id || idx} direction="row" spacing={1.25}>
                                        <Stack alignItems="center" sx={{ width: 16, flexShrink: 0 }}>
                                          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main", mt: 0.5, zIndex: 1 }} />
                                          {idx < timeline.length - 1 && <Box sx={{ width: 1.5, flex: 1, bgcolor: "divider" }} />}
                                        </Stack>
                                        <Box sx={{ pb: 1.5, minWidth: 0 }}>
                                          <Typography variant="body2" sx={{ fontSize: 11.5, lineHeight: 1.35 }}>{event.event_description}</Typography>
                                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 9.5 }}>
                                            {new Date(event.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}{", "}
                                            {new Date(event.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                          </Typography>
                                        </Box>
                                      </Stack>
                                    ))}
                                  </Stack>
                                ) : <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>No events yet</Typography>}
                              </Box>
                            )}

                            {/* ── Tab 3: Pinned ── */}
                            {groupTab === 3 && (
                              <Stack spacing={1} p={1.5}>
                                {pinnedMessages.length > 0 ? (
                                  <>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Pinned ({pinnedMessages.length})</Typography>
                                      <Typography variant="caption" color="primary" sx={{ fontWeight: 600, cursor: "pointer" }} onClick={() => setViewMode("pinned")}>View all</Typography>
                                    </Stack>
                                    <Stack spacing={0.5}>
                                      {pinnedMessages.map((message) => (
                                        <Box key={`pin-${message.id}`} sx={{ p: 1, borderRadius: 1.5, bgcolor: "action.hover", transition: "background 0.15s", "&:hover": { bgcolor: "action.selected" } }}>
                                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{buildAuthorLabel(message)} · {formatTime(message.createdAt)}</Typography>
                                          <Typography variant="body2" sx={{ ...pinnedSnippetSx, fontSize: 12 }}>{buildMessageSnippet(message)}</Typography>
                                        </Box>
                                      ))}
                                    </Stack>
                                  </>
                                ) : <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>No pinned messages</Typography>}
                              </Stack>
                            )}

                            {/* ── Tab 4: Settings (Media + Actions) ── */}
                            {groupTab === 4 && (
                              <Stack spacing={1.5} p={1.5}>
                                {totalAssets > 0 && (
                                  <>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>Media & Files ({totalAssets})</Typography>
                                      <Typography variant="caption" color="primary" sx={{ fontWeight: 600, cursor: "pointer" }} onClick={() => setViewMode("media")}>View all</Typography>
                                    </Stack>
                                    <Stack spacing={0.75}>
                                      {mediaMessages.slice(0, 3).map((msg) => renderFileTiles([msg], ""))}
                                      {linkMessages.slice(0, 2).map((msg, i) => renderLinkList([msg], ""))}
                                    </Stack>
                                    <Divider />
                                  </>
                                )}
                              </Stack>
                            )}
                          </Box>

                          {/* ─── Sticky Bottom: contextual actions ─── */}
                          {(() => {
                            const membershipStatus = String(thread?.membershipStatus || "").toLowerCase();
                            const isInactiveMember =
                              Boolean(thread?.hasLeft) ||
                              ["left", "kicked", "removed", "banned"].includes(membershipStatus);

                            if (isInactiveMember) {
                              // User is no longer an active member — only local-side "Delete Chat"
                              return (
                                <Stack spacing={1} sx={{ flexShrink: 0, p: 1.5, borderTop: 1, borderColor: "divider" }}>
                                  <Button
                                    variant="contained"
                                    color="error"
                                    size="small"
                                    fullWidth
                                    onClick={() => onHideGroupThread?.(thread)}
                                    sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                                  >
                                    Delete Chat
                                  </Button>
                                </Stack>
                              );
                            }

                            // Active member — Exit always; Delete Group only for admins
                            return (
                              <Stack spacing={1} sx={{ flexShrink: 0, p: 1.5, borderTop: 1, borderColor: "divider" }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  fullWidth
                                  onClick={() => onLeaveGroup?.(thread)}
                                  sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                                >
                                  Exit Group
                                </Button>
                                {isAdmin && (
                                  <Button
                                    variant="contained"
                                    color="error"
                                    size="small"
                                    fullWidth
                                    onClick={() => onDeleteGroup?.(thread)}
                                    sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
                                  >
                                    Delete Group
                                  </Button>
                                )}
                              </Stack>
                            );
                          })()}
                        </Stack>
                      ) : null}

                      {!isGroup ? (
                        <>
                          <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                          >
                            <Avatar
                              src={profilePicture ?? undefined}
                              alt={displayLabel}
                              sx={{
                                width: 52,
                                height: 52,
                                bgcolor: profilePicture
                                  ? "transparent"
                                  : "primary.main",
                                color: profilePicture
                                  ? "inherit"
                                  : "primary.contrastText",
                                fontWeight: 600,
                              }}
                            >
                              {!profilePicture ? initials : null}
                            </Avatar>
                            <Box>
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 600 }}
                                color="text.primary"
                              >
                                {displayLabel}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {thread?.company ||
                                  thread?.organizationLabel ||
                                  thread?.domain_name ||
                                  thread?.designation ||
                                  thread?.status ||
                                  "Active"}
                              </Typography>
                            </Box>
                          </Stack>

                          <Divider />

                          <Box>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, mb: 1 }}
                              color="text.secondary"
                            >
                              Personal Details
                            </Typography>
                            <Stack spacing={0.75} m={1}>
                              {hasPersonalDetails ? (
                                personalDetails.map((detail) =>
                                  renderDetailRow(detail, "personal")
                                )
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  No personal details available.
                                </Typography>
                              )}
                            </Stack>
                          </Box>

                          <Divider />

                          <Box>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, mb: 1 }}
                              color="text.secondary"
                            >
                              Business Details
                            </Typography>
                            <Stack spacing={0.75} m={1}>
                              {hasBusinessDetails ? (
                                businessDetails.map((detail) =>
                                  renderDetailRow(detail, "business", false)
                                )
                              ) : (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  No business details available.
                                </Typography>
                              )}
                            </Stack>
                          </Box>

                          <Divider />

                          {commonGroups.length > "0" && (
                            <>
                              <Box>
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600, mb: 1 }}
                                  color="text.secondary"
                                >
                                  Groups in common
                                </Typography>
                                <Stack spacing={1}>
                                  {commonGroups.length ? (
                                    commonGroups.map((group) => (
                                      <GroupElement
                                        key={group.id}
                                        thread={group}
                                        isActive={group.id === activeThreadId}
                                        onSelect={onOpenGroup}
                                      />
                                    ))
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      textAlign="center"
                                      p={1}
                                    >
                                      No groups in common.
                                    </Typography>
                                  )}
                                </Stack>
                              </Box>
                              <Divider />
                            </>
                          )}

                          {pinnedMessages.length ? (
                            <Box>
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ mb: 1 }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600 }}
                                  color="text.secondary"
                                >
                                  Pinned Messages ({pinnedMessages.length})
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  sx={{ fontWeight: 600, cursor: "pointer" }}
                                  onClick={() => setViewMode("pinned")}
                                >
                                  View all
                                </Typography>
                              </Stack>
                              <Stack spacing={1}>
                                {pinnedMessages.slice(0, 3).map((message) => (
                                  <Box
                                    key={`pinned-${message.id}`}
                                    sx={{
                                      p: 1,
                                      borderRadius: 1,
                                      bgcolor: theme.palette.action.hover,
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {buildAuthorLabel(message)} -{" "}
                                      {formatTime(message.createdAt)}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={pinnedSnippetSx}
                                      color="text.primary"
                                      component={
                                        message?.type === "link" ? "a" : "div"
                                      }
                                      href={
                                        message?.type === "link"
                                          ? getPinnedLinkHref(message)
                                          : undefined
                                      }
                                      target={
                                        message?.type === "link"
                                          ? "_blank"
                                          : undefined
                                      }
                                      rel={
                                        message?.type === "link"
                                          ? "noreferrer"
                                          : undefined
                                      }
                                      style={
                                        message?.type === "link"
                                          ? {
                                              textDecoration: "none",
                                              color: "inherit",
                                            }
                                          : undefined
                                      }
                                    >
                                      {buildMessageSnippet(message)}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>
                              <Divider />
                            </Box>
                          ) : null}

                          {totalAssets ? (
                            <Box>
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="space-between"
                                sx={{ mb: 1 }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 600 }}
                                  color="text.secondary"
                                >
                                  Media, Links & Docs ({totalAssets})
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="primary"
                                  sx={{ fontWeight: 600, cursor: "pointer" }}
                                  onClick={() => setViewMode("media")}
                                >
                                  View all
                                </Typography>
                              </Stack>
                              <Stack spacing={1.5}>
                                {linkMessages.length ? (
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Links ({linkMessages.length})
                                    </Typography>
                                    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                      {renderLinkList(
                                        linkMessages.slice(0, 3),
                                        "No links shared."
                                      )}
                                    </Stack>
                                  </Box>
                                ) : null}
                                {mediaMessages.length ? (
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Media ({mediaMessages.length})
                                    </Typography>
                                    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                      {renderFileTiles(
                                        mediaMessages.slice(0, 3),
                                        "No media shared."
                                      )}
                                    </Stack>
                                  </Box>
                                ) : null}

                                {fileMessages.length ? (
                                  <Box>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Files ({fileMessages.length})
                                    </Typography>
                                    <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                                      {renderFileTiles(
                                        fileMessages.slice(0, 3),
                                        "No files shared."
                                      )}
                                    </Stack>
                                  </Box>
                                ) : null}
                              </Stack>
                            </Box>
                          ) : null}
                        </>
                      ) : null}
                    </Stack>
                  ) : null}

                          {/* Exit/Delete buttons moved to sticky bottom in group tab layout */}
                  
                </Box>
                
              </CustomScrollbars>
            )}
          </Box>
        </Box>
      </Slide>
      <Dialog
        open={descriptionDialogOpen}
        onClose={handleCloseDescriptionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{fontSize: 16, fontWeight: 600}}>Group Description</DialogTitle>
        <DialogContent>
          <TextField
            value={groupDescriptionDraft}
            onChange={(event) => setGroupDescriptionDraft(event.target.value)}
            placeholder="Add a description"
            fullWidth
            multiline
            minRows={4}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDescriptionDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleDescriptionSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <Popover
        open={Boolean(memberMenuAnchor)}
        anchorEl={memberMenuAnchor}
        onClose={handleCloseMemberMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack sx={{ p: 0.5 }}>
          <MenuItem onClick={() => handleMemberAction("view")}>
            View Profile
          </MenuItem>
          <MenuItem onClick={() => handleMemberAction("message")}>
            Direct Message
          </MenuItem>
        </Stack>
      </Popover>
      <GroupMembersDialog
        open={editMembersOpen}
        mode="edit"
        title="Edit Group"
        members={availableMembers}
        currentUser={{
          id: agentSelfId,
          name: "You",
        }}
        initialSelected={members}
        initialName={getGroupTitle(thread)}
        initialDescription={
          thread?.description || thread?.groupDescription || thread?.topic || ""
        }
        initialAvatar={groupAvatarPreview || profilePicture || ""}
        onClose={handleCloseEditMembers}
        onSubmit={handleSubmitGroupEdit}
        submitLabel="Submit"
      />
      <Dialog
        open={confirmDialog.open}
        onClose={handleCloseConfirm}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 16, fontWeight: 600 }}>
          {confirmDialog.action === "delete"
            ? "Delete group?"
            : "Exit group?"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmDialog.action === "delete"
              ? "This will remove the group for everyone."
              : "You will no longer receive messages from this group."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirm}>Cancel</Button>
          <Button
            variant="contained"
            color={confirmDialog.action === "delete" ? "error" : "primary"}
            onClick={handleConfirmAction}
          >
            {confirmDialog.action === "delete" ? "Delete" : "Exit"}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={actionToast.open}
        autoHideDuration={2000}
        onClose={closeActionToast}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={closeActionToast}
          severity={actionToast.severity}
          sx={{ width: "100%" }}
        >
          {actionToast.message}
        </Alert>
      </Snackbar>
      <Snackbar
        open={copyToast.open}
        autoHideDuration={2000}
        onClose={closeCopyToast}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={closeCopyToast}
          severity={copyToast.severity}
          sx={{ width: "100%" }}
        >
          {copyToast.message}
        </Alert>
      </Snackbar>
      <FilePreviewOverlay
        open={previewOpen}
        entries={previewEntries}
        activeId={previewActiveId}
        onSelect={(nextId) => setPreviewActiveId(nextId)}
        onClose={() => { setPreviewOpen(false); setPreviewActiveId(null); }}
      />
    </>
  );
};

export default React.memo(ConversationInfoSidebar);

