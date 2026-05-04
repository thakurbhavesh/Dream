import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Avatar,
  Badge,
  Box,
  Checkbox,
  CircularProgress,
  Collapse,
  Divider,
  Fade,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  MdOutlineKeyboardDoubleArrowDown,
  MdRefresh,
  MdTextFields,
} from "react-icons/md";
import CustomScrollbars from "../../Scrollbar.jsx";
import MessageItem from "../messages/MessageItem.jsx";
import useStickyScroll from "../../../hooks/useStickyScroll.js";
import { getInitials } from "../../../utils/initials.js";
import { BeatLoader } from "react-spinners";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BsCalendarEvent,
  BsFileEarmarkText,
  BsGeoAlt,
  BsImage,
  BsLink45Deg,
  BsPlayFill,
  BsSearch,
  BsSoundwave,
  BsCodeSlash,
} from "react-icons/bs";
import { PiXBold } from "react-icons/pi";
import { FaRegFrownOpen } from "react-icons/fa";
import { RiChatSearchFill } from "react-icons/ri";
import { searchMessages as apiSearchMessages, smartSearchMessages, semanticSearchMessages } from "../../../services/chatApi.js";
import { PiMagicWandBold, PiBrainBold } from "react-icons/pi";

const EMPTY_SELECTION = Object.freeze(new Set());
const DATE_FILTERS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "thisYear", label: "This Year" },
  { value: "lastYear", label: "Last Year" },
  { value: "all", label: "All Dates" },
  { value: "range", label: "Date Range" },
];

const TYPE_FILTERS = [
  { key: "text", icon: MdTextFields, label: "Text" },
  { key: "image", icon: BsImage, label: "Image" },
  { key: "video", icon: BsPlayFill, label: "Video" },
  { key: "file", icon: BsFileEarmarkText, label: "File" },
  { key: "link", icon: BsLink45Deg, label: "Link" },
  { key: "audio", icon: BsSoundwave, label: "Audio" },
  { key: "location", icon: BsGeoAlt, label: "Location" },
  { key: "code", icon: BsCodeSlash, label: "Code" },
];

const normalizeSearchValue = (value = "") =>
  String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const DayDivider = ({ label }) => {
  const theme = useTheme();
  return (
    <Divider
      sx={{
        "&::before, &::after": {
          borderColor: theme.palette.divider,
        },
      }}
    >
      <Typography
        variant="caption"
        color={theme.palette.common.black}
        sx={{
          px: 2,
          py: 0.5,
          borderRadius: 999,
          bgcolor: theme.palette.common.white,
        }}
      >
        {label}
      </Typography>
    </Divider>
  );
};

const bubbleStyles = (theme) => ({
  px: 1.25,
  py: 0.75,
  borderRadius: "18px 18px 18px 6px",
  backgroundColor:
    theme.palette.mode === "light"
      ? "rgba(236,245,218,0.9)"
      : theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow:
    theme.palette.mode === "light"
      ? "0 4px 14px rgba(0,0,0,0.08)"
      : "0 4px 14px rgba(0,0,0,0.5)",
});

const TypingIndicator = ({
  participants = [],
  threadId,
  theme,
  isGroupConversation,
}) => {
  const showAvatars = isGroupConversation && participants.length > 1;
  if (!showAvatars) {
    return (
      <Box sx={{ width: "100%", display: "flex" }}>
        <Box sx={bubbleStyles(theme)}>
          <BeatLoader
            size={6}
            speedMultiplier={0.9}
            color={theme.palette.primary.main}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ width: "100%" }}
    >
      <Stack direction="row" spacing={-0.75}>
        {participants.slice(0, 2).map((participant) => (
          <Avatar
            key={`${participant.id}-${threadId}`}
            src={participant.avatar ?? undefined}
            sx={{
              width: 32,
              height: 32,
              border: `2px solid ${theme.palette.background.paper}`,
              fontSize: 12,
              fontWeight: 600,
              bgcolor: participant.avatar
                ? "transparent"
                : theme.palette.primary.light,
            }}
          >
            {!participant.avatar
              ? getInitials(participant.name || "Member")
              : null}
          </Avatar>
        ))}
      </Stack>
      <Box sx={bubbleStyles(theme)}>
        <BeatLoader
          size={6}
          speedMultiplier={0.9}
          color={theme.palette.primary.main}
        />
      </Box>
    </Stack>
  );
};

// Scrollable message history surface. Delegates scroll math to useStickyScroll.
const VirtualizedMessageList = ({
  groups = [],
  currentUserId,
  onMenuToggle,
  onContextMenu,
  onReact,
  onAction,
  onAuthorAction,
  onReplyJump,
  isGroupConversation = false,
  threadId,
  hasMore = false,
  onLoadPrevious,
  itemsVersion,
  scrollToBottomSignal = 0,
  typingState = null,
  typingScrollSignal = 0,
  multiCopyContext = null,
  showSearchBar = false,
  onSearchClose,
}) => {
  const theme = useTheme();
  const [searchValue, setSearchValue] = useState("");
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [exactMatch, setExactMatch] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [typeFilters, setTypeFilters] = useState(new Set());
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [dateMenuAnchor, setDateMenuAnchor] = useState(null);

  const [apiSearchResults, setApiSearchResults] = useState(null);
  const [apiSearchLoading, setApiSearchLoading] = useState(false);
  const apiSearchTimerRef = useRef(null);
  const [smartSearchMode, setSmartSearchMode] = useState(false);
  const [smartSearchIntent, setSmartSearchIntent] = useState("");
  const [semanticSearchMode, setSemanticSearchMode] = useState(false);
  const [semanticInterpretation, setSemanticInterpretation] = useState("");

  const searchQuery = searchValue.trim();
  const hasDateRange =
    dateFilter === "range" && (dateRange.from || dateRange.to);
  const dateFilterActive =
    dateFilter !== "all" && (dateFilter !== "range" || hasDateRange);
  const searchEnabled = Boolean(showSearchBar);
  const searchFiltersActive =
    searchEnabled &&
    (Boolean(searchQuery) ||
      selectedUsers.size > 0 ||
      typeFilters.size > 0 ||
      dateFilterActive);
  const effectiveHasMore = searchFiltersActive ? false : hasMore;

  // Backend search: debounced API call when text query or type/date filters active
  const typeFiltersKey = useMemo(() => [...typeFilters].sort().join(","), [typeFilters]);
  useEffect(() => {
    if (apiSearchTimerRef.current) clearTimeout(apiSearchTimerRef.current);
    const hasTextQuery = searchQuery.length >= 2;
    const hasTypeFilter = typeFilters.size > 0;
    if (!searchEnabled || (!hasTextQuery && !hasTypeFilter)) {
      setApiSearchResults(null);
      setApiSearchLoading(false);
      setSmartSearchIntent("");
      setSemanticInterpretation("");
      return;
    }
    setApiSearchLoading(true);
    let cancelled = false;
    apiSearchTimerRef.current = setTimeout(() => {
      if (semanticSearchMode && hasTextQuery) {
        // AI Semantic Search — search by meaning
        semanticSearchMessages(searchQuery, { threadId, limit: 100 })
          .then((data) => {
            if (cancelled) return;
            const results = (data?.results ?? []).map((r) => ({ ...r, id: String(r.id), _apiResult: true }));
            setApiSearchResults(results);
            setSemanticInterpretation(data?.interpretation || "");
            setSmartSearchIntent("");
          })
          .catch((err) => {
            if (cancelled) return;
            console.error("[semantic-search] error:", err?.message);
            setApiSearchResults([]);
            setSemanticInterpretation("");
          })
          .finally(() => { if (!cancelled) setApiSearchLoading(false); });
      } else if (smartSearchMode && hasTextQuery) {
        // AI Smart Search — natural language query
        smartSearchMessages(searchQuery, { threadId, limit: 100 })
          .then((data) => {
            if (cancelled) return;
            const results = (data?.results ?? []).map((r) => ({ ...r, id: String(r.id), _apiResult: true }));
            setApiSearchResults(results);
            setSmartSearchIntent(data?.filters?.intent || "");
            setSemanticInterpretation("");
          })
          .catch((err) => {
            if (cancelled) return;
            console.error("[smart-search] error:", err?.message);
            setApiSearchResults([]);
            setSmartSearchIntent("");
          })
          .finally(() => { if (!cancelled) setApiSearchLoading(false); });
      } else {
        // Normal search
        const typesArray = hasTypeFilter ? [...typeFilters] : undefined;
        apiSearchMessages(hasTextQuery ? searchQuery : "", { threadId, limit: 100, types: typesArray })
          .then((data) => {
            if (cancelled) return;
            const results = (data?.results ?? []).map((r) => ({ ...r, id: String(r.id), _apiResult: true }));
            setApiSearchResults(results);
            setSmartSearchIntent("");
          })
          .catch((err) => {
            if (cancelled) return;
            console.error("[search] API error:", err?.message);
            setApiSearchResults([]);
          })
          .finally(() => { if (!cancelled) setApiSearchLoading(false); });
      }
    }, (smartSearchMode || semanticSearchMode) ? 600 : 400);
    return () => {
      cancelled = true;
      if (apiSearchTimerRef.current) clearTimeout(apiSearchTimerRef.current);
    };
  }, [searchQuery, searchEnabled, threadId, currentUserId, typeFiltersKey, smartSearchMode, semanticSearchMode]);

  const [olderToast, setOlderToast] = useState("");

  const onLoadPreviousWithToast = useCallback(async () => {
    if (typeof onLoadPrevious !== "function") return;
    const loaded = await onLoadPrevious();
    if (!loaded) {
      setOlderToast("No more messages");
    }
  }, [onLoadPrevious]);

  const noMoreToastRef = useRef(false);
  const onNoMore = useCallback(() => {
    if (noMoreToastRef.current) return; // debounce — show once per scroll session
    noMoreToastRef.current = true;
    setOlderToast("No more messages");
    setTimeout(() => { noMoreToastRef.current = false; }, 3000);
  }, []);

  const {
    scrollRef,
    handleScroll,
    handleUpdate,
    loadingOlder,
    showScrollToBottom,
    scrollToBottom,
    pendingNewCount,
  } = useStickyScroll({
    threadId,
    hasMore: effectiveHasMore,
    onLoadPrevious: onLoadPreviousWithToast,
    onNoMore,
    itemsVersion,
  });
  const prevSearchOpenRef = useRef(showSearchBar);
  const prevSearchActiveRef = useRef(searchFiltersActive);

  useEffect(() => {
    if (showSearchBar) return;
    clearSearchFilters();
  }, [showSearchBar]);

  useLayoutEffect(() => {
    const searchToggled = prevSearchOpenRef.current !== showSearchBar;
    const filtersToggled =
      prevSearchActiveRef.current !== searchFiltersActive;
    prevSearchOpenRef.current = showSearchBar;
    prevSearchActiveRef.current = searchFiltersActive;
    if (!searchToggled && !filtersToggled) return;
    const frame = requestAnimationFrame(() => {
      scrollToBottom();
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollToBottom, searchFiltersActive, showSearchBar]);

  useEffect(() => {
    if (!scrollToBottomSignal) return;
    scrollToBottom();
  }, [scrollToBottomSignal, scrollToBottom]);

  useEffect(() => {
    if (!typingScrollSignal) return;
    scrollToBottom();
  }, [typingScrollSignal, scrollToBottom]);

  const measurementCacheRef = useRef(new Map());
  const multiCopyActive = Boolean(multiCopyContext?.active);
  const selectedIds = multiCopyContext?.selectedIds ?? EMPTY_SELECTION;
  const multiCopyToggle = multiCopyContext?.onToggle;

  const availableUsers = useMemo(() => {
    const userMap = new Map();
    groups.forEach((group) => {
      group.messages.forEach((message) => {
        const author =
          message?.author ||
          message?.metadata?.author ||
          message?.metadata?.sender ||
          null;
        const authorId =
          author?.id ||
          message?.sender_id ||
          message?.senderId ||
          message?.authorId ||
          message?.metadata?.senderId ||
          message?.metadata?.sender_id ||
          "";
        const authorName =
          author?.name ||
          message?.authorName ||
          message?.senderName ||
          message?.metadata?.senderName ||
          "Member";
        const avatar =
          author?.avatar ||
          author?.profilePicture ||
          author?.photo ||
          message?.avatar ||
          message?.metadata?.avatar ||
          null;
        if (!authorId && !authorName) return;
        const key = authorId || authorName;
        if (!userMap.has(key)) {
          userMap.set(key, {
            id: authorId || key,
            name: authorName,
            avatar,
          });
        }
      });
    });
    return Array.from(userMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [groups]);

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleTypeFilter = (filterKey) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filterKey)) {
        next.delete(filterKey);
      } else {
        next.add(filterKey);
      }
      return next;
    });
  };

  const clearSearchFilters = () => {
    setSearchValue("");
    setSelectedUsers(new Set());
    setExactMatch(false);
    setDateFilter("all");
    setDateRange({ from: "", to: "" });
    setTypeFilters(new Set());
    setApiSearchResults(null);
    setApiSearchLoading(false);
    setSmartSearchIntent("");
  };

  const getMessageType = (message) => {
    const rawType = message?.type?.toLowerCase?.() ?? "";
    const mimeType = message?.content?.mimeType?.toLowerCase?.() ?? "";
    if (["text", "message", "emoji"].includes(rawType)) return "text";
    if (["image", "photo"].includes(rawType)) return "image";
    if (["video"].includes(rawType)) return "video";
    if (["file", "pdf", "doc", "document"].includes(rawType)) return "file";
    if (["audio", "voice"].includes(rawType)) return "audio";
    if (["link", "url"].includes(rawType)) return "link";
    if (["code", "snippet"].includes(rawType)) return "code";
    if (["location"].includes(rawType)) return "location";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType) return "file";
    return rawType || "text";
  };

  const getMessageSearchText = (message) => {
    const content = message?.content ?? {};
    const meta = message?.metadata ?? {};
    return normalizeSearchValue(
      [
        content.text,
        content.caption,
        content.captionHtml,
        content.html,
        content.title,
        content.description,
        content.fileName,
        content.fileType,
        content.url,
        content.code,
        message?.text,
        message?.message,
        message?.body,
        message?.preview,
        message?.title,
        meta?.title,
        meta?.fileName,
        meta?.caption,
        meta?.description,
        meta?.url,
        meta?.displayHost,
        meta?.code,
        meta?.language,
        meta?.filename,
      ]
        .filter(Boolean)
        .join(" ")
    );
  };

  const buildDateRange = () => {
    const now = new Date();
    const startOfDay = (date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = (date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    if (dateFilter === "today") {
      return { start: startOfDay(now), end: endOfDay(now) };
    }
    if (dateFilter === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    if (dateFilter === "last7") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    if (dateFilter === "last30") {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    if (dateFilter === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    if (dateFilter === "thisYear") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    if (dateFilter === "lastYear") {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    if (dateFilter === "range") {
      const start = dateRange.from
        ? startOfDay(new Date(dateRange.from))
        : null;
      const end = dateRange.to ? endOfDay(new Date(dateRange.to)) : null;
      return { start, end };
    }
    return { start: null, end: null };
  };

  const filteredGroups = useMemo(() => {
    if (!searchFiltersActive) return groups;

    const { start, end } = buildDateRange();
    const hasUserFilter = selectedUsers.size > 0;
    const hasTypeFilter = typeFilters.size > 0;

    // If we have API search results (text query >= 2 chars OR type filter active), merge them
    const hasApiResults = apiSearchResults !== null && (searchQuery.length >= 2 || hasTypeFilter);

    const query = normalizeSearchValue(searchQuery).toLowerCase();
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isSingleWordQuery = Boolean(query) && /^\w+$/.test(query);
    const exactRegex =
      exactMatch && isSingleWordQuery && escaped
        ? new RegExp(`\\b${escaped}\\b`, "i")
        : null;

    // Build merged source: API results (full DB) + local matches (loaded cache)
    // Deduplicate by message ID — prefer local version (richer data)
    const seenIds = new Set();
    const sourceMessages = [];

    // First: add local matches (they have full message data with formatting etc.)
    if (query) {
      groups.forEach((g) => g.messages.forEach((message) => {
        const text = getMessageSearchText(message);
        const normalizedText = normalizeSearchValue(text).toLowerCase();
        let matches = false;
        if (exactRegex) {
          matches = exactRegex.test(normalizedText);
        } else {
          matches = normalizedText.includes(query);
        }
        if (matches && message?.id) {
          seenIds.add(String(message.id));
          sourceMessages.push(message);
        }
      }));
    } else {
      // No text query — just use local messages (user/date/type filters only)
      groups.forEach((g) => g.messages.forEach((m) => {
        if (m?.id) seenIds.add(String(m.id));
        sourceMessages.push(m);
      }));
    }

    // Then: add API results that are NOT already in local (messages from full DB)
    if (hasApiResults) {
      for (const apiMsg of apiSearchResults) {
        if (!seenIds.has(String(apiMsg.id))) {
          seenIds.add(String(apiMsg.id));
          sourceMessages.push(apiMsg);
        }
      }
    }

    // Sort by timestamp (newest last)
    sourceMessages.sort((a, b) => {
      const ta = new Date(a?.createdAt || a?.timestamp || 0).getTime();
      const tb = new Date(b?.createdAt || b?.timestamp || 0).getTime();
      return ta - tb;
    });

    const filtered = sourceMessages.filter((message) => {
      if (hasUserFilter) {
        const authorId =
          message?.author?.id ||
          message?.sender_id ||
          message?.senderId ||
          message?.authorId ||
          message?.metadata?.senderId ||
          message?.metadata?.sender_id ||
          "";
        const authorName =
          message?.author?.name ||
          message?.authorName ||
          message?.senderName ||
          message?.metadata?.senderName ||
          "";
        const key = authorId || authorName;
        if (!key || !selectedUsers.has(key)) return false;
      }
      if (hasTypeFilter) {
        const messageType = getMessageType(message);
        if (!typeFilters.has(messageType)) return false;
      }
      if (start || end) {
        const createdAt = message?.createdAt || message?.timestamp;
        const messageDate = createdAt ? new Date(createdAt) : null;
        if (!messageDate || Number.isNaN(messageDate.getTime()))
          return false;
        if (start && messageDate < start) return false;
        if (end && messageDate > end) return false;
      }
      return true;
    });

    // Group by date for display
    const groupMap = new Map();
    filtered.forEach((msg) => {
      const ts = msg?.createdAt || msg?.timestamp;
      const date = ts ? new Date(ts) : new Date();
      const label = date.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      if (!groupMap.has(label)) groupMap.set(label, { label, messages: [] });
      groupMap.get(label).messages.push(msg);
    });
    return Array.from(groupMap.values());
  }, [
    apiSearchResults,
    dateFilter,
    dateRange.from,
    dateRange.to,
    exactMatch,
    groups,
    searchFiltersActive,
    searchQuery,
    selectedUsers,
    typeFilters,
  ]);

  const displayGroups = searchFiltersActive ? filteredGroups : groups;

  const flatRows = useMemo(() => {
    const rows = [];
    displayGroups.forEach((group, groupIndex) => {
      const groupKey = `${group.label}-${group.messages[0]?.id ?? groupIndex}`;
      rows.push({
        type: "divider",
        key: `divider-${groupKey}`,
        label: group.label,
        groupIndex,
      });
      group.messages.forEach((message, messageIndex) => {
        rows.push({
          type: "message",
          key: `message-${message.id}`,
          message,
          groupIndex,
          messageIndex,
        });
      });
    });
    if (typingState && !searchFiltersActive) {
      rows.push({
        type: "typing",
        key: `typing-${threadId}`,
        typing: typingState,
      });
    }
    return rows;
  }, [displayGroups, searchFiltersActive, threadId, typingState]);

  useEffect(() => {
    const cache = measurementCacheRef.current;
    const validKeys = new Set(flatRows.map((row) => row.key));
    cache.forEach((_, key) => {
      if (!validKeys.has(key)) {
        cache.delete(key);
      }
    });
  }, [flatRows]);

  const estimateMessageHeight = (message = {}) => {
    const type = message.type?.toLowerCase?.() ?? "";
    if (type === "image" || type === "video" || type === "media") {
      return 320;
    }
    if (type === "file" || type === "audio") {
      return 220;
    }
    const content = message.content ?? {};
    const emojiOnly = Boolean(content.isEmojiOnly || type === "emoji");
    if (emojiOnly) {
      const emojiCount = content.emojiCount ?? 1;
      const rows = Math.max(1, Math.ceil(emojiCount / 6));
      return 120 + rows * 56;
    }
    const textLength =
      content.text?.length ??
      content.caption?.length ??
      content.captionHtml?.length ??
      0;
    const approxLines = Math.max(1, Math.ceil(textLength / 42));
    const replyBonus = message?.metadata?.replyTo ? 72 : 0;
    const captionBonus =
      content.caption || content.captionHtml
        ? Math.min(approxLines, 4) * 14
        : 0;
    return 96 + approxLines * 18 + replyBonus + captionBonus;
  };

  const estimateSize = useCallback(
    (index) => {
      const item = flatRows[index];
      if (!item) return 120;
      if (item.type === "divider") return 64;
      if (item.type === "typing") return 88;
      const cached = measurementCacheRef.current.get(item.key);
      if (cached) return cached;
      return estimateMessageHeight(item.message);
    },
    [flatRows]
  );

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current?.getView?.() ?? null,
    estimateSize,
    overscan: 8,
    getItemKey: (index) => flatRows[index]?.key ?? index,
  });

  const measureVirtualRow = useCallback(
    (node) => {
      if (!node) return;
      const index = Number(node.getAttribute("data-index"));
      const row = Number.isNaN(index) ? null : flatRows[index];
      if (row?.key) {
        const height = node.getBoundingClientRect().height;
        if (height) {
          measurementCacheRef.current.set(row.key, height);
        }
      }
      virtualizer.measureElement(node);
    },
    [flatRows, virtualizer]
  );

  // Scroll to a message by ID using the virtualizer (handles off-screen messages)
  const handleReplyJumpInternal = useCallback(
    (messageId) => {
      if (!messageId) return;
      const targetIndex = flatRows.findIndex(
        (row) => row.type === "message" && String(row.message?.id) === String(messageId)
      );
      if (targetIndex >= 0) {
        virtualizer.scrollToIndex(targetIndex, { align: "center", behavior: "smooth" });
        // After scroll settles, let parent's jiggle handler find the now-rendered element
        setTimeout(() => onReplyJump?.(messageId), 350);
      } else {
        onReplyJump?.(messageId);
      }
    },
    [flatRows, virtualizer, onReplyJump]
  );

  const renderRow = useCallback(
    (item) => {
      if (item.type === "divider") {
        return (
          <Box sx={{ mt: item.groupIndex === 0 ? 0 : 3 }}>
            <DayDivider label={item.label} />
          </Box>
        );
      }
      if (item.type === "typing") {
        return (
          <Box sx={{ mt: 3 }}>
            <TypingIndicator
              participants={item.typing.participants}
              threadId={threadId}
              theme={theme}
              isGroupConversation={isGroupConversation}
            />
          </Box>
        );
      }
      const marginTop = item.messageIndex === 0 ? 2 : 2.5;
      return (
        <Box sx={{ mt: marginTop }}>
          <MessageItem
            message={item.message}
            currentUserId={currentUserId}
            onMenuToggle={onMenuToggle}
            onContextMenu={onContextMenu}
            onReact={onReact}
            onAction={onAction}
            onAuthorAction={onAuthorAction}
            onReplyJump={handleReplyJumpInternal}
            isGroupConversation={isGroupConversation}
            multiCopyActive={multiCopyActive}
            multiCopySelected={
              multiCopyActive ? selectedIds.has(item.message.id) : false
            }
            onMultiCopyToggle={multiCopyToggle}
          />
        </Box>
      );
    },
    [
      currentUserId,
      isGroupConversation,
      multiCopyActive,
      multiCopyToggle,
      onAction,
      onAuthorAction,
      onContextMenu,
      onMenuToggle,
      onReact,
      handleReplyJumpInternal,
      selectedIds,
      theme,
      threadId,
    ]
  );

  return (
    <Box sx={{ position: "relative", height: "100%" }}>
      <Collapse in={showSearchBar} timeout={220} appear>
        <Stack
          spacing={1}
          sx={{
            p: 1.5,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            width: "100%",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              placeholder="Search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BsSearch size={14} />
                  </InputAdornment>
                ),
              }}
            />
            <Box>
              <TextField
                size="small"
                value={
                  selectedUsers.size
                    ? `${selectedUsers.size} Users`
                    : "All Users"
                }
                onClick={(event) => setUserMenuAnchor(event.currentTarget)}
                InputProps={{ readOnly: true }}
                sx={{ minWidth: 160 }}
              />
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={() => setUserMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { minWidth: 220, p: 0.5 } } }}
              >
                {availableUsers.length === 0 ? (
                  <MenuItem disabled>No users available</MenuItem>
                ) : (
                  availableUsers.map((user) => (
                    <MenuItem
                      key={user.id}
                      onClick={() => toggleUserSelection(user.id)}
                    >
                      <Checkbox
                        size="small"
                        checked={selectedUsers.has(user.id)}
                        sx={{ p: 0, mr: 1 }}
                      />
                      <Avatar
                        src={user.avatar ?? undefined}
                        alt={user.name}
                        sx={{
                          width: 28,
                          height: 28,
                          mr: 1,
                          fontSize: 12,
                          bgcolor: user.avatar
                            ? "transparent"
                            : theme.palette.primary.light,
                        }}
                      >
                        {!user.avatar ? getInitials(user.name) : null}
                      </Avatar>
                      <Typography variant="body2">{user.name}</Typography>
                    </MenuItem>
                  ))
                )}
              </Menu>
            </Box>
            <Box>
              <TextField
                size="small"
                value={
                  DATE_FILTERS.find((filter) => filter.value === dateFilter)
                    ?.label ?? "All Dates"
                }
                onClick={(event) => setDateMenuAnchor(event.currentTarget)}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <BsCalendarEvent size={14} />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 150 }}
              />
              <Menu
                anchorEl={dateMenuAnchor}
                open={Boolean(dateMenuAnchor)}
                onClose={() => setDateMenuAnchor(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                slotProps={{ paper: { sx: { minWidth: 220, p: 0.5 } } }}
              >
                {DATE_FILTERS.map((filter) => (
                  <MenuItem
                    key={filter.value}
                    onClick={() => {
                      setDateFilter(filter.value);
                      if (filter.value !== "range") {
                        setDateRange({ from: "", to: "" });
                        setDateMenuAnchor(null);
                      }
                    }}
                  >
                    {filter.label}
                  </MenuItem>
                ))}
                {dateFilter === "range" ? (
                  <Box sx={{ px: 2, pb: 1, pt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Date Range
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      <TextField
                        size="small"
                        type="date"
                        value={dateRange.from}
                        onChange={(event) =>
                          setDateRange((prev) => ({
                            ...prev,
                            from: event.target.value,
                          }))
                        }
                      />
                      <TextField
                        size="small"
                        type="date"
                        value={dateRange.to}
                        onChange={(event) =>
                          setDateRange((prev) => ({
                            ...prev,
                            to: event.target.value,
                          }))
                        }
                      />
                    </Stack>
                  </Box>
                ) : null}
              </Menu>
            </Box>

            <IconButton onClick={() => onSearchClose?.()}>
              <PiXBold size={16} />
            </IconButton>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              {TYPE_FILTERS.map((filter) => {
                const FilterIcon = filter.icon;
                const active = typeFilters.has(filter.key);
                return (
                  <Tooltip key={filter.key} title={filter.label} arrow>
                    <IconButton
                      size="small"
                      onClick={() => toggleTypeFilter(filter.key)}
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        border: `1px solid ${theme.palette.divider}`,
                        bgcolor: active ? "primary.main" : "transparent",
                        color: active
                          ? theme.palette.primary.contrastText
                          : theme.palette.text.secondary,
                        "&:hover": {
                          bgcolor: active
                            ? theme.palette.primary.main
                            : theme.palette.action.hover,
                        },
                      }}
                    >
                      <FilterIcon size={16} />
                    </IconButton>
                  </Tooltip>
                );
              })}
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {!smartSearchMode ? (
                <Tooltip title="Exact word match" arrow>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ cursor: "pointer" }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      exact
                    </Typography>
                    <Switch
                      size="small"
                      checked={exactMatch}
                      onChange={(event) => setExactMatch(event.target.checked)}
                    />
                  </Stack>
                </Tooltip>
              ) : null}
              <Tooltip title={smartSearchMode ? "AI Smart Search: ON — Search using natural language" : "AI Smart Search: OFF — Click to enable"} arrow>
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  onClick={() => { setSmartSearchMode((prev) => !prev); if (!smartSearchMode) setSemanticSearchMode(false); }}
                  sx={{ cursor: "pointer", userSelect: "none" }}
                >
                  <PiMagicWandBold
                    size={14}
                    color={smartSearchMode ? theme.palette.primary.main : theme.palette.text.secondary}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: smartSearchMode ? theme.palette.primary.main : theme.palette.text.secondary,
                    }}
                  >
                    Smart
                  </Typography>
                  <Switch
                    size="small"
                    checked={smartSearchMode}
                    onChange={(event) => { setSmartSearchMode(event.target.checked); if (event.target.checked) setSemanticSearchMode(false); }}
                    sx={smartSearchMode ? {
                      "& .MuiSwitch-switchBase.Mui-checked": { color: theme.palette.primary.main },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: theme.palette.primary.main },
                    } : {}}
                  />
                </Stack>
              </Tooltip>
              <Tooltip title={semanticSearchMode ? "AI Semantic Search: ON — Search by meaning" : "AI Semantic Search: OFF — Click to enable"} arrow>
                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  onClick={() => { setSemanticSearchMode((prev) => !prev); if (!semanticSearchMode) setSmartSearchMode(false); }}
                  sx={{ cursor: "pointer", userSelect: "none" }}
                >
                  <PiBrainBold
                    size={14}
                    color={semanticSearchMode ? "#7b1fa2" : theme.palette.text.secondary}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: semanticSearchMode ? "#7b1fa2" : theme.palette.text.secondary,
                    }}
                  >
                    Semantic
                  </Typography>
                  <Switch
                    size="small"
                    checked={semanticSearchMode}
                    onChange={(event) => { setSemanticSearchMode(event.target.checked); if (event.target.checked) setSmartSearchMode(false); }}
                    sx={semanticSearchMode ? {
                      "& .MuiSwitch-switchBase.Mui-checked": { color: "#7b1fa2" },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#7b1fa2" },
                    } : {}}
                  />
                </Stack>
              </Tooltip>
              <Tooltip title="Clear all filters" arrow>
                <IconButton onClick={clearSearchFilters}>
                  <MdRefresh size={16} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </Collapse>
      <CustomScrollbars
        ref={scrollRef}
        style={{ height: "100%" }}
        onScroll={handleScroll}
        onUpdate={handleUpdate}
      >
        <Box sx={{ minHeight: "100%" }}>
          {!searchFiltersActive && loadingOlder ? (
            <Stack
              alignItems="center"
              sx={{ py: 1, position: "sticky", top: 0, zIndex: 5, bgcolor: "background.paper" }}
              direction={"row"}
              justifyContent="center"
              spacing={1}
            >
              <CircularProgress size={18} />
              <Typography variant="caption" color="text.secondary">
                Loading earlier messages...
              </Typography>
            </Stack>
          ) : null}
          <Box sx={{ position: "relative", py: 1, px: 2, minHeight: "100%" }}>
            {searchFiltersActive && (apiSearchLoading || flatRows.length === 0) ? (
              <Stack
                alignItems="center"
                justifyContent="center"
                spacing={1}
                sx={{ minHeight: 320, color: "text.primary" }}
              >
                {apiSearchLoading ? (
                  <>
                    <CircularProgress size={32} sx={{ color: theme.palette.primary.main }} />
                    <Typography variant="body2" color="text.secondary">
                      {smartSearchMode ? "AI is searching..." : "Searching..."}
                    </Typography>
                  </>
                ) : searchQuery ? (
                  <FaRegFrownOpen size={62} />
                ) : (
                  <RiChatSearchFill size={62} />
                )}

                {!apiSearchLoading && (
                  <Typography variant="body2">
                    {searchQuery
                      ? "No messages match your search."
                      : "Enter characters to search"}
                  </Typography>
                )}
              </Stack>
            ) : (
              <Box
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = flatRows[virtualRow.index];
                  return (
                    <Box
                      key={item?.key ?? virtualRow.key}
                      ref={measureVirtualRow}
                      data-index={virtualRow.index}
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                      }}
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {item ? renderRow(item) : null}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>
      </CustomScrollbars>
      <Fade in={showScrollToBottom} unmountOnExit>
        <IconButton
          size="medium"
          onClick={scrollToBottom}
          sx={{
            position: "absolute",
            right: 24,
            bottom: 24,
            bgcolor: "background.paper",
            boxShadow: 5,
            "&:hover": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
            },
          }}
        >
          <Badge
            color="primary"
            badgeContent={
              pendingNewCount > 99 ? "99+" : pendingNewCount || null
            }
            overlap="circular"
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            invisible={!pendingNewCount}
          >
            <MdOutlineKeyboardDoubleArrowDown size={24} />
          </Badge>
        </IconButton>
      </Fade>

      {/* Toast for older messages load status */}
      <Snackbar
        open={Boolean(olderToast)}
        autoHideDuration={1500}
        onClose={() => setOlderToast("")}
        message={olderToast}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ position: "absolute", top: 8 }}
      />
    </Box>
  );
};

export default VirtualizedMessageList;
