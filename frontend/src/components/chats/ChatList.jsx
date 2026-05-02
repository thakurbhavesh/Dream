import {
  Box,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Skeleton } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { PiMagnifyingGlass, PiX } from "react-icons/pi";
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
  useEffect,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import CustomScrollbars from "../Scrollbar.jsx";
import ChatElement, {
  getEntryTimestamp,
  normaliseTimestamp,
} from "./ChatElement.jsx";
import GroupElement from "./GroupElement.jsx";
import { isGroupThread } from "../../utils/threadUtils.js";
import {
  MdOutlineKeyboardDoubleArrowUp,
  MdOutlineMarkChatRead,
  MdOutlineMarkUnreadChatAlt,
  MdOutlineGroups,
} from "react-icons/md";

const ChatSkeleton = React.memo(() => {
  const theme = useTheme();
  return (
    <Stack spacing={2}>
      {[...Array(8)].map((_, index) => (
        <Box
          key={index}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            px: 2,
            py: 1.5,
            borderRadius: 2,
            bgcolor:
              theme.palette.mode === "light"
                ? "rgba(0,0,0,0.04)"
                : theme.palette.background.paper,
          }}
        >
          <Skeleton variant="circular" width={40} height={40} />
          <Stack spacing={0.75} sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" width="60%" height={18} />
            <Skeleton variant="text" width="80%" height={16} />
          </Stack>
          <Skeleton variant="text" width={36} height={16} />
        </Box>
      ))}
    </Stack>
  );
});

const MemoizedChatElement = React.memo(ChatElement);
const MemoizedGroupElement = React.memo(GroupElement);

const getMessageTimestamp = (message) => {
  if (!message) return 0;
  const candidates = [
    message.updatedAt,
    message.createdAt,
    message.timestamp,
    message.time,
  ];
  return candidates.reduce((latest, candidate) => {
    const parsed = normaliseTimestamp(candidate);
    return parsed > latest ? parsed : latest;
  }, 0);
};

const resolveThreadActivityTimestamp = (thread) => {
  if (!thread) return 0;
  const ownTimestamp = getEntryTimestamp(thread);
  const lastMessageTimestamp = getMessageTimestamp(thread.lastMessage);
  const nestedTimestamp = Array.isArray(thread.threads)
    ? thread.threads.reduce((latest, nestedThread) => {
        const nestedValue = resolveThreadActivityTimestamp(nestedThread);
        return nestedValue > latest ? nestedValue : latest;
      }, 0)
    : 0;
  return Math.max(ownTimestamp, lastMessageTimestamp, nestedTimestamp);
};

const ChatList = ({
  threads = [],
  activeThreadId,
  onSelect,
  loading = false,
  isLocked = false,
  onDropFiles,
  isThreadMuted,
  onMuteThread,
  onUnmuteThread,
  pinnedThreads = {},
  onPinThread,
}) => {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState("");
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showGroupsOnly, setShowGroupsOnly] = useState(false);
  const scrollRef = useRef(null);
  const [scrollElement, setScrollElement] = useState(null);
  const scrollViewRef = useRef(null);
  const scrollRafRef = useRef(null);

  const hasUnreadFilterActive = showUnreadOnly;
  const deferredSearch = useDeferredValue(searchTerm);

  useEffect(() => {
    const view = scrollElement;
    if (!view) return undefined;
    const handleScroll = () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        setShowScrollToTop(view.scrollTop > 24);
      });
    };
    view.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      view.removeEventListener("scroll", handleScroll);
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [scrollElement]);

  const spacingPx = useMemo(() => {
    const spacingValue = theme.spacing(1.5);
    const parsed = Number(
      typeof spacingValue === "string"
        ? spacingValue.replace("px", "")
        : spacingValue
    );
    return Number.isNaN(parsed) ? 12 : parsed;
  }, [theme]);

  const sortedThreads = useMemo(() => {
    if (!Array.isArray(threads) || threads.length === 0) return [];
    const enriched = threads.map((thread, index) => {
      const pinnedAtIso = pinnedThreads?.[thread?.id];
      const pinnedAt = pinnedAtIso ? new Date(pinnedAtIso).getTime() : 0;
      return {
        thread,
        index,
        isPinned: Boolean(pinnedAt) || Boolean(thread?.isPinned),
        pinnedAt,
        activity: resolveThreadActivityTimestamp(thread),
      };
    });
    enriched.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      if (a.isPinned && b.isPinned && a.pinnedAt !== b.pinnedAt) {
        return b.pinnedAt - a.pinnedAt;
      }
      if (a.activity !== b.activity) {
        return b.activity - a.activity;
      }
      return a.index - b.index;
    });
    return enriched.map((entry) => ({ ...entry.thread, isPinned: entry.isPinned }));
  }, [threads, pinnedThreads]);

  const filteredThreads = useMemo(() => {
    const trimmedQuery = deferredSearch.trim().toLowerCase();
    return sortedThreads.filter((thread) => {
      const label = thread.label?.toLowerCase() || "";
      const matchesSearch = !trimmedQuery || label.includes(trimmedQuery);
      const hasUnread = (thread.unreadCount ?? 0) > 0;
      const matchesUnread = !showUnreadOnly || hasUnread;
      const matchesGroup = !showGroupsOnly || isGroupThread(thread);
      return matchesSearch && matchesUnread && matchesGroup;
    });
  }, [sortedThreads, deferredSearch, showUnreadOnly, showGroupsOnly]);

  const noUnreadVisible =
    hasUnreadFilterActive && !loading && filteredThreads.length === 0;

  const handleScrollToTop = useCallback(() => {
    scrollRef.current?.scrollToTop();
    setShowScrollToTop(false);
  }, []);

  const handleThreadSelect = useCallback(
    (thread) => {
      if (isLocked) return;
      onSelect?.(thread);
    },
    [onSelect, isLocked]
  );

  const handleThreadFilesDrop = useCallback(
    (thread, files) => {
      if (isLocked) return;
      if (!files?.length) return;
      onDropFiles?.(thread, files);
    },
    [isLocked, onDropFiles]
  );

  const estimatedItemSize = 88 + spacingPx;
  const virtualizer = useVirtualizer({
    count: filteredThreads.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimatedItemSize,
    overscan: 8,
    paddingStart: spacingPx,
    paddingEnd: spacingPx,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalVirtualHeight =
    virtualizer.getTotalSize() || filteredThreads.length * estimatedItemSize || 0;

  const handleScrollRef = useCallback((instance) => {
    scrollRef.current = instance;
    const view = instance?.getView?.() ?? null;
    if (scrollViewRef.current !== view) {
      scrollViewRef.current = view;
      setScrollElement(view);
    }
  }, []);

  return (
    <Stack sx={{ height: "100%" }}>
      <Stack spacing={1.5} sx={{ p: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            backgroundColor:
              theme.palette.mode === "light"
                ? "#f0f0f0"
                : theme.palette.background.default,
            borderRadius: "4px",
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              autoComplete="off"
              sx={{
                
                padding: "0px 0px !important",
                "& .MuiOutlinedInput-root": {
                  borderRadius: 1,
                  "& fieldset": {
                    border: "none",
                  },
                  "&:hover fieldset": {
                    border: "none",
                  },
                  "&.Mui-focused fieldset": {
                    border: "none",
                  },
                  "& .MuiOutlinedInput-input": {
                    padding: "10px 8px",
                    paddingLeft: 0,
                  },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PiMagnifyingGlass
                      size={25}
                      style={{
                        color:
                          theme.palette.mode === "light"
                            ? theme.palette.text.secondary
                            : "#ddd",
                      }}
                    />
                  </InputAdornment>
                ),
                // Show clear button only when search has a value
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Clear search"
                      size="small"
                      onClick={() => setSearchTerm("")}
                      edge="end"
                      sx={{
                        color:
                          theme.palette.mode === "light"
                            ? theme.palette.text.secondary
                            : "#ddd",
                      }}
                    >
                      <PiX size={16} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>

          <Tooltip
            title={showUnreadOnly ? "Show all chats" : "Show unread chats"}
            arrow
          >
            <IconButton
              aria-label="Toggle unread chats"
              size="small"
              onClick={() => setShowUnreadOnly((prev) => !prev)}
              sx={{
                mx: 0.5,
                borderRadius: 1,
                backgroundColor: showUnreadOnly
                  ? theme.palette.primary.main
                  : theme.palette.background.paper,
                color: showUnreadOnly
                  ? theme.palette.primary.contrastText
                  : theme.palette.text.secondary,
                border: `1px solid ${theme.palette.divider}`,
                transition: "background-color 0.2s ease",
                "&:hover": {
                  backgroundColor: showUnreadOnly
                    ? theme.palette.primary.dark
                    : theme.palette.action.hover,
                },
              }}
            >
              <MdOutlineMarkUnreadChatAlt size={18} />
            </IconButton>
          </Tooltip>

          <Tooltip
            title={showGroupsOnly ? "Show all chats" : "Show group chats only"}
            arrow
          >
            <IconButton
              aria-label="Toggle group chats"
              size="small"
              onClick={() => setShowGroupsOnly((prev) => !prev)}
              sx={{
                mx: 0.5,
                borderRadius: 1,
                backgroundColor: showGroupsOnly
                  ? theme.palette.primary.main
                  : theme.palette.background.paper,
                color: showGroupsOnly
                  ? theme.palette.primary.contrastText
                  : theme.palette.text.secondary,
                border: `1px solid ${theme.palette.divider}`,
                transition: "background-color 0.2s ease",
                "&:hover": {
                  backgroundColor: showGroupsOnly
                    ? theme.palette.primary.dark
                    : theme.palette.action.hover,
                },
              }}
            >
              <MdOutlineGroups size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>

      <Divider
        sx={{
          my: 0.5,
          borderColor: theme.palette.mode === "light" ? "#9f9f9f" : "#9d9d9d",
        }}
      />

      <Box sx={{ flexGrow: 1, minHeight: 0, position: "relative" }}>
        <CustomScrollbars
          ref={handleScrollRef}
          style={{
            filter: noUnreadVisible ? "blur(3px)" : "none",
            pointerEvents: noUnreadVisible ? "none" : "auto",
            transition: "filter 0.2s ease",
          }}
        >
          <Box sx={{ px: 1 }}>
            {loading ? (
              <ChatSkeleton />
            ) : filteredThreads.length ? (
              <Box sx={{ position: "relative", height: totalVirtualHeight }}>
                <Box
                  sx={{
                    position: "absolute",
                    width: "100%",
                    height: totalVirtualHeight,
                  }}
                >
                  {virtualItems.map((virtualRow) => {
                    const thread = filteredThreads[virtualRow.index];
                    const ThreadComponent = isGroupThread(thread)
                      ? MemoizedGroupElement
                      : MemoizedChatElement;
                    const threadKey =
                      thread?.id ??
                      thread?.threadId ??
                      thread?.channelId ??
                      `${thread?.label ?? "thread"}-${virtualRow.index}`;
                    return (
                      <Box
                        key={threadKey}
                        ref={virtualizer.measureElement}
                        data-index={virtualRow.index}
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          transform: `translateY(${virtualRow.start}px)`,
                          paddingBottom: `${spacingPx}px`,
                        }}
                      >
                        <ThreadComponent
                          thread={thread}
                          isActive={thread?.id === activeThreadId}
                          onSelect={handleThreadSelect}
                          disabled={isLocked}
                          isLocked={isLocked}
                          onDropFiles={handleThreadFilesDrop}
                          isMuted={isThreadMuted?.(thread?.id)}
                          onMute={onMuteThread}
                          onUnmute={onUnmuteThread}
                          isPinned={!!pinnedThreads?.[thread?.id]}
                          onPin={onPinThread}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ) : hasUnreadFilterActive ? null : (() => {
              const isSearching = deferredSearch.trim().length > 0;
              const emptyTitle = isSearching
                ? (showGroupsOnly ? "No Group found" : "No User found")
                : (showGroupsOnly ? "No groups yet" : "No conversations yet");
              const emptyHint = isSearching
                ? "Try a different search term."
                : (showGroupsOnly
                  ? "Create a group to start collaborating."
                  : "Start a new chat to see it appear here.");
              return (
                <Stack
                  alignItems="center"
                  justifyContent="center"
                  spacing={0.5}
                  sx={{
                    height: "70vh",
                    color: theme.palette.text.secondary,
                    textAlign: "center",
                    px: 3,
                  }}
                >
                  <Box
                    sx={{
                      width: 250,
                      height: 250,
                      borderRadius: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img style={{ flex: 1 }} src="/illustrations/no-user-found.png" alt="" />
                  </Box>
                  <Typography variant="subtitle1">{emptyTitle}</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    {emptyHint}
                  </Typography>
                </Stack>
              );
            })()}
          </Box>
        </CustomScrollbars>

        {noUnreadVisible ? (
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{
              position: "absolute",
              inset: 0,
              px: 3,
              textAlign: "center",
              color: theme.palette.text.secondary,
            }}
          >
            <Box
              sx={{
                width: 50,
                height: 50,
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MdOutlineMarkChatRead
                size={36}
                color={theme.palette.success.main}
              />
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              All caught up
            </Typography>
            <Typography variant="caption">
              No unread messages left. <br /> Toggle unread off to see all
              chats.
            </Typography>
          </Stack>
        ) : null}

        {/* Display scroll-to-top control once the user has scrolled */}
        {showScrollToTop ? (
          <IconButton
            size="medium"
            onClick={handleScrollToTop}
            sx={{
              position: "absolute",
              top: 8,
              right: 16,
              bgcolor: theme.palette.background.default,
              color: theme.palette.text.primary,
              boxShadow: "0px 4px 12px rgba(0,0,0,0.3)",
              "&:hover": {
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
              },
            }}
            aria-label="Scroll to top"
          >
            <MdOutlineKeyboardDoubleArrowUp size={18} />
          </IconButton>
        ) : null}
      </Box>
    </Stack>
  );
};

export default ChatList;
