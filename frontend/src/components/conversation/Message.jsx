import {
  Avatar,
  Box,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MessageMenu from "./messages/MessageMenu.jsx";
import chatBgPattern from "../../assets/Images/chat-bg-pattern.png";
import VirtualizedMessageList from "./lists/VirtualizedMessageList.jsx";
import useThreadMessagesState from "../../hooks/useThreadMessagesState.js";
import { isGroupThread } from "../../utils/threadUtils.js";
import { BeatLoader } from "react-spinners";
import { useTypingIndicator } from "../../contexts/TypingIndicatorContext.jsx";
import ReactionTray from "./ReactionTray.jsx";

const DEFAULT_CURRENT_USER_ID = "agent-self";
const MESSAGE_WINDOW = 30;
const createMenuState = (overrides = {}) => ({
  open: false,
  anchorEl: null,
  anchorPosition: null,
  message: null,
  ...overrides,
});

const createReactionState = (overrides = {}) => ({
  open: false,
  anchorEl: null,
  anchorPosition: null,
  message: null,
  ...overrides,
});

const REPLY_VISIBILITY_RATIO = 0.55;

const isElementMostlyVisible = (element, container) => {
  if (
    !element ||
    !container ||
    typeof element.getBoundingClientRect !== "function"
  ) {
    return false;
  }
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  if (!elementRect?.height || !containerRect?.height) {
    return false;
  }
  const visibleTop = Math.max(elementRect.top, containerRect.top);
  const visibleBottom = Math.min(elementRect.bottom, containerRect.bottom);
  const visibleHeight = Math.max(visibleBottom - visibleTop, 0);
  const visibilityRatio = visibleHeight / elementRect.height;
  return visibilityRatio >= REPLY_VISIBILITY_RATIO;
};

const EmptyThreadState = React.memo(({ wallpaperSource, label }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: "relative",
        p: 2,
        background: wallpaperSource
          ? theme.palette.mode === "light"
            ? "rgba(255,255,255,0.6)"
            : "transparent"
          : theme.palette.background.paper,
        backdropFilter: wallpaperSource ? "blur(80px)" : undefined,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <Stack
        spacing={1}
        alignItems="center"
        justifyContent="center"
        sx={{ flexGrow: 1, color: "text.secondary" }}
      >
        <img src="/illustrations/say-hello-illustration.png" />
        <Typography
          variant="h5"
          sx={{ fontWeight: 600, color: theme.palette.text.primary }}
        >
          Start the conversation
        </Typography>
        <Typography variant="body2">
          Send a quick hello to{" "}
          <b style={{ color: theme.palette.primary.main }}>{label}</b> to get
          things moving.
        </Typography>
      </Stack>
    </Box>
  );
});

  const ConversationMessage = React.memo(
  ({
    thread,
    messages = [],
    loading = false,
    currentUserId = DEFAULT_CURRENT_USER_ID,
    onAction,
    onAuthorAction,
    wallpaper,
    scrollSignal = 0,
    fetchPreviousMessages,
    initialRemoteHasMore = false,
    multiCopyState = null,
    onMultiCopyToggle,
    searchOpen = false,
    onSearchClose,
  }) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const replyHighlightTimersRef = useRef(new WeakMap());
    const replyVisibilityWatcherRef = useRef(null);
    const wallpaperSource = wallpaper || chatBgPattern;

    const { groups, totalMessages, hasMore, loadOlderMessages } =
      useThreadMessagesState({
        threadId: thread?.id ?? "thread",
        messages,
        pageSize: MESSAGE_WINDOW,
        fetchPrevious: fetchPreviousMessages,
        initialRemoteHasMore,
      });

    const isGroupConversation = useMemo(() => isGroupThread(thread), [thread]);
    const typingState = useTypingIndicator(thread?.id);
    const showGroupTyping = typingState.isActive && typingState.summary;
    const visibleTypingParticipants = typingState.participants
      .filter((participant) => participant.id !== currentUserId)
      .slice(0, 3);

    const [menuState, setMenuState] = useState(() => createMenuState());
    const [reactionState, setReactionState] = useState(() =>
      createReactionState()
    );
    const [suppressEmptyState, setSuppressEmptyState] = useState(false);
    const [typingScrollSignal, setTypingScrollSignal] = useState(0);
    const typingFingerprintRef = useRef("");

    const multiCopyActive = Boolean(
      multiCopyState?.active && multiCopyState.threadId === thread?.id
    );

    useEffect(() => {
      setSuppressEmptyState(true);
      const timer = setTimeout(() => setSuppressEmptyState(false), 200);
      return () => clearTimeout(timer);
    }, [thread?.id]);

    const closeMenu = useCallback(() => {
      setMenuState(createMenuState());
    }, []);

    const openMenu = useCallback((event, message, { context = false } = {}) => {
      const basePosition = context
        ? { anchorPosition: { top: event.clientY, left: event.clientX } }
        : { anchorEl: event.currentTarget };
      setMenuState(
        createMenuState({
          ...basePosition,
          open: true,
          message,
        })
      );
    }, []);

    const closeReactionTray = useCallback(() => {
      setReactionState(createReactionState());
    }, []);

    const openReactionTrayAt = useCallback((message, baseAnchor = {}) => {
      if (!message) return;
      const anchorConfig =
        baseAnchor.anchorPosition || baseAnchor.anchorEl
          ? baseAnchor
          : {
              anchorPosition:
                typeof window !== "undefined"
                  ? {
                      top: window.innerHeight / 2,
                      left: window.innerWidth / 2,
                    }
                  : { top: 0, left: 0 },
            };
      setReactionState(
        createReactionState({
          ...anchorConfig,
          message,
          open: true,
        })
      );
    }, []);

    const handleContextMenu = useCallback(
      (event, message) => openMenu(event, message, { context: true }),
      [openMenu]
    );

    const isEmpty = totalMessages === 0 && !loading && !suppressEmptyState;

    useEffect(() => {
      const fingerprint = showGroupTyping
        ? `${typingState.summary}-${visibleTypingParticipants
            .map((participant) => participant.id)
            .join(",")}`
        : "";
      if (fingerprint && fingerprint !== typingFingerprintRef.current) {
        typingFingerprintRef.current = fingerprint;
        setTypingScrollSignal((prev) => prev + 1);
      }
      if (!fingerprint && typingFingerprintRef.current) {
        typingFingerprintRef.current = "";
      }
    }, [showGroupTyping, typingState.summary, visibleTypingParticipants]);

    const handleMenuAction = useCallback(
      (actionKey, actionMessage, meta = {}) => {
        if (actionKey === "quick-react") {
          const fallbackAnchor = menuState.anchorPosition
            ? { anchorPosition: menuState.anchorPosition }
            : menuState.anchorEl
              ? { anchorEl: menuState.anchorEl }
              : {};
          openReactionTrayAt(actionMessage, fallbackAnchor);
          return;
        }
        onAction?.(actionKey, actionMessage, {
          ...meta,
          threadId: thread?.id,
        });
      },
      [menuState, onAction, openReactionTrayAt, thread?.id]
    );

    const handleReactionSelect = useCallback(
      (emoji) => {
        if (!emoji || !reactionState.message) return;
        onAction?.("react", reactionState.message, {
          emoji,
          threadId: thread?.id,
        });
        closeReactionTray();
      },
      [closeReactionTray, onAction, reactionState.message, thread?.id]
    );

    const handleInlineReaction = useCallback(
      (reactionMessage, emoji, meta = {}) => {
        if (!reactionMessage) return;
        if (!emoji) {
          const anchorConfig = meta.anchorPosition
            ? { anchorPosition: meta.anchorPosition }
            : meta.anchorEl
              ? { anchorEl: meta.anchorEl }
              : undefined;
          if (anchorConfig) {
            openReactionTrayAt(reactionMessage, anchorConfig);
          } else {
            openReactionTrayAt(reactionMessage);
          }
          return;
        }
        onAction?.("react", reactionMessage, {
          emoji,
          threadId: thread?.id,
        });
      },
      [onAction, openReactionTrayAt, thread?.id]
    );

    const triggerReplyHighlight = useCallback((node) => {
      if (!node) return;
      const bubble =
        node.querySelector?.('[data-message-bubble="true"]') ?? node;
      if (!bubble) return;
      const timers = replyHighlightTimersRef.current;
      const existingTimer = timers.get(bubble);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      bubble.classList.remove("reply-jiggle");
      // Force reflow so successive clicks replay the animation.
      void bubble.offsetWidth;
      bubble.classList.add("reply-jiggle");
      const timerId = setTimeout(() => {
        bubble.classList.remove("reply-jiggle");
        timers.delete(bubble);
      }, 700);
      timers.set(bubble, timerId);
    }, []);

    const watchReplyTargetVisibility = useCallback(
      (target) => {
        const root = containerRef.current;
        if (!target || !root) return;
        const hasAnimationFrame =
          typeof window !== "undefined" &&
          typeof window.requestAnimationFrame === "function" &&
          typeof window.cancelAnimationFrame === "function";
        if (!hasAnimationFrame) {
          triggerReplyHighlight(target);
          return;
        }
        if (replyVisibilityWatcherRef.current) {
          window.cancelAnimationFrame(replyVisibilityWatcherRef.current);
          replyVisibilityWatcherRef.current = null;
        }
        let attempts = 0;
        const maxAttempts = 180;
        const checkVisibility = () => {
          if (!target.isConnected) {
            replyVisibilityWatcherRef.current = null;
            return;
          }
          const visible = isElementMostlyVisible(target, root);
          if (visible || attempts >= maxAttempts) {
            triggerReplyHighlight(target);
            replyVisibilityWatcherRef.current = null;
            return;
          }
          attempts += 1;
          replyVisibilityWatcherRef.current =
            window.requestAnimationFrame(checkVisibility);
        };
        replyVisibilityWatcherRef.current =
          window.requestAnimationFrame(checkVisibility);
      },
      [triggerReplyHighlight]
    );

    const handleReplyJump = useCallback(
      (messageId) => {
        if (!messageId) return;
        const root = containerRef.current;
        if (!root) return;
        const target = root.querySelector(
          `[data-message-id="message-${messageId}"]`
        );
        if (!target) return;
        const alreadyVisible = isElementMostlyVisible(target, root);
        if (!alreadyVisible && target.scrollIntoView) {
          target.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        if (alreadyVisible) {
          triggerReplyHighlight(target);
        } else {
          watchReplyTargetVisibility(target);
        }
      },
      [triggerReplyHighlight, watchReplyTargetVisibility]
    );

    useEffect(() => {
      closeReactionTray();
    }, [thread?.id, closeReactionTray]);

    useEffect(() => {
      return () => {
        if (
          replyVisibilityWatcherRef.current &&
          typeof window !== "undefined" &&
          typeof window.cancelAnimationFrame === "function"
        ) {
          window.cancelAnimationFrame(replyVisibilityWatcherRef.current);
        }
      };
    }, []);

    return (
      <Box
        ref={containerRef}
        sx={{
          position: "relative",
          flexGrow: 1,
          overflow: "hidden",
          borderRadius: 0,
          background: theme.palette.background.paper,
        }}
      >
        {wallpaperSource ? (
          <Box
            sx={(theme) => ({
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${wallpaperSource})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              opacity: theme.palette.mode === "dark" ? 0.8 : 1,
              // overlay only in dark mode
              ...(theme.palette.mode === "dark" && {
                "&::after": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.4)",
                },
              }),
            })}
          />
        ) : null}

        {isEmpty ? (
          <EmptyThreadState
            wallpaperSource={wallpaperSource}
            label={thread?.label ?? "your teammate"}
          />
        ) : (
          <Box sx={{ position: "relative", height: "100%" }}>
            <VirtualizedMessageList
              groups={groups}
              currentUserId={currentUserId}
              onMenuToggle={openMenu}
              onContextMenu={handleContextMenu}
              onReact={handleInlineReaction}
              onAction={handleMenuAction}
              onAuthorAction={onAuthorAction}
              onReplyJump={handleReplyJump}
              isGroupConversation={isGroupConversation}
              threadId={thread?.id ?? "thread"}
              hasMore={hasMore}
              onLoadPrevious={loadOlderMessages}
              itemsVersion={totalMessages}
              scrollToBottomSignal={scrollSignal}
              showSearchBar={searchOpen}
              onSearchClose={onSearchClose}
              typingState={
                typingState.isActive && typingState.summary
                  ? {
                      participants: visibleTypingParticipants,
                      summary: typingState.summary,
                    }
                  : null
              }
              typingScrollSignal={typingScrollSignal}
              multiCopyContext={{
                active: multiCopyActive,
                selectedIds: multiCopyState?.selected ?? new Set(),
                onToggle: onMultiCopyToggle,
              }}
            />
          </Box>
        )}

        {loading ? (
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{
              position: "absolute",
              inset: 0,
              backgroundColor: "transparent",
            }}
          >
            <CircularProgress size={40} />
            <Typography variant="caption2" color="text.secondary">
              Loading messages...
            </Typography>
          </Stack>
        ) : null}

        <MessageMenu
          open={menuState.open}
          anchorEl={menuState.anchorEl}
          anchorPosition={menuState.anchorPosition}
          onClose={closeMenu}
          message={menuState.message}
          currentUserId={currentUserId}
          onAction={handleMenuAction}
        />

        <ReactionTray
          open={reactionState.open}
          anchorEl={reactionState.anchorEl}
          anchorPosition={reactionState.anchorPosition}
          onClose={closeReactionTray}
          onSelect={handleReactionSelect}
          containerRef={containerRef}
        />
      </Box>
    );
  }
);

export default ConversationMessage;
