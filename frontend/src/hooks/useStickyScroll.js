import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Manages scroll position for chat history.
 * - Pins to bottom when user is at bottom
 * - Preserves position when user is reading older messages (scrolled up)
 * - Preserves offset when prepending older messages (infinite scroll up)
 */
export const useStickyScroll = ({
  threadId,
  hasMore = false,
  onLoadPrevious,
  onNoMore,
  itemsVersion,
}) => {
  const scrollRef = useRef(null);
  const clientHeightRef = useRef(0);
  const pendingTopAdjustmentRef = useRef(null);
  const loadingOlderRef = useRef(false);
  const isAtBottomRef = useRef(true); // REF — synchronous, no batching delay
  const prevItemsVersionRef = useRef(itemsVersion);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [distanceFromBottom, setDistanceFromBottom] = useState(0);
  const [pendingNewCount, setPendingNewCount] = useState(0);

  // Thread change → always scroll to bottom
  useEffect(() => {
    isAtBottomRef.current = true;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToBottom?.();
      setAtBottom(true);
      setDistanceFromBottom(0);
      setPendingNewCount(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [threadId]);

  useEffect(() => {
    prevItemsVersionRef.current = itemsVersion;
    setPendingNewCount(0);
  }, [threadId]);

  // Preserve scroll position when older messages prepended
  useLayoutEffect(() => {
    const pending = pendingTopAdjustmentRef.current;
    if (!pending) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const totalHeight = scroller.getScrollHeight?.() ?? 0;
    const delta = totalHeight - pending.previousScrollHeight;
    scroller.scrollToTop((pending.previousTop ?? 0) + delta);
    pendingTopAdjustmentRef.current = null;
  }, [itemsVersion]);

  // Auto-scroll on new messages — ONLY when user is at bottom (via REF, not state)
  useEffect(() => {
    if (pendingTopAdjustmentRef.current) return;
    if (loadingOlderRef.current) return;
    // Use REF for instant check — not affected by React state batching
    if (!isAtBottomRef.current) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToBottom?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [itemsVersion]);

  // Auto-trigger load when content doesn't overflow (no scroll possible → onScroll never fires)
  useEffect(() => {
    if (!hasMore || loadingOlderRef.current) return;
    if (typeof onLoadPrevious !== "function") return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const frame = requestAnimationFrame(() => {
      const scrollHeight = scroller.getScrollHeight?.() ?? 0;
      const clientHeight = scroller.getClientHeight?.() ?? clientHeightRef.current;
      // If content fits in viewport (no scrollbar), user can't scroll up → trigger load directly
      if (scrollHeight <= clientHeight + 4) {
        pendingTopAdjustmentRef.current = {
          previousScrollHeight: scrollHeight,
          previousTop: 0,
        };
        loadingOlderRef.current = true;
        setLoadingOlder(true);
        Promise.resolve(onLoadPrevious())
          .catch((err) => console.error("loadOlder (auto) failed", err))
          .finally(() => {
            loadingOlderRef.current = false;
            setLoadingOlder(false);
          });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [hasMore, onLoadPrevious, itemsVersion]);

  // Track pending new message count (for "N new messages" indicator)
  // Only count genuinely NEW messages (1 at a time via socket), not bulk older loads
  useEffect(() => {
    const prevValue = Number(prevItemsVersionRef.current) || 0;
    const nextValue = Number(itemsVersion) || 0;
    const delta = nextValue - prevValue;
    // delta === 1 means a single new message arrived (socket)
    // delta > 1 means bulk load (older messages or initial load) — don't count
    if (delta === 1 && !isAtBottomRef.current && !loadingOlderRef.current) {
      setPendingNewCount((count) => count + 1);
    } else if (isAtBottomRef.current) {
      setPendingNewCount(0);
    }
    prevItemsVersionRef.current = itemsVersion;
  }, [itemsVersion]);

  const handleScroll = useCallback(
    (scrollTop = 0, values = {}) => {
      if (typeof values.clientHeight === "number") {
        clientHeightRef.current = values.clientHeight;
      }
      const clientHeight = values.clientHeight ?? clientHeightRef.current;
      const scrollHeight =
        values.scrollHeight ?? scrollRef.current?.getScrollHeight?.() ?? 0;
      const distance = Math.max(scrollHeight - (scrollTop + clientHeight), 0);
      const nearBottom = distance < 12;

      // Update REF synchronously — this is what the auto-scroll effect checks
      isAtBottomRef.current = nearBottom;

      setDistanceFromBottom(distance);
      if (nearBottom !== atBottom) {
        setAtBottom(nearBottom);
      }
      if (nearBottom) {
        setPendingNewCount(0);
      }

      // Load older messages when scrolled to top
      if (scrollTop <= 32 && !loadingOlderRef.current) {
        if (hasMore && typeof onLoadPrevious === "function") {
          pendingTopAdjustmentRef.current = {
            previousScrollHeight: scrollHeight,
            previousTop: scrollTop,
          };
          loadingOlderRef.current = true;
          setLoadingOlder(true);
          Promise.resolve(onLoadPrevious())
            .catch((error) => console.error("loadOlder failed", error))
            .finally(() => {
              loadingOlderRef.current = false;
              setLoadingOlder(false);
            });
        } else if (!hasMore && typeof onNoMore === "function") {
          onNoMore();
        }
      }
    },
    [atBottom, hasMore, onLoadPrevious, onNoMore]
  );

  const handleUpdate = useCallback(({ clientHeight }) => {
    if (typeof clientHeight === "number") {
      clientHeightRef.current = clientHeight;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollToBottom?.();
    isAtBottomRef.current = true;
    setAtBottom(true);
    setDistanceFromBottom(0);
    setPendingNewCount(0);
  }, []);

  const showScrollToBottom = !atBottom && distanceFromBottom > 120;

  return {
    scrollRef,
    handleScroll,
    handleUpdate,
    loadingOlder,
    showScrollToBottom,
    scrollToBottom,
    pendingNewCount,
  };
};

export default useStickyScroll;
