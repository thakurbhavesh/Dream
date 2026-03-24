import {
  Box,
  ButtonBase,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { resolveFileExtension } from "../files/filePreviewUtils.js";
import {
  PiArrowSquareOutBold,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiCopySimpleBold,
  PiDownloadSimple,
  PiMagnifyingGlassMinusBold,
  PiMagnifyingGlassPlusBold,
  PiShareFatBold,
  PiXBold,
} from "react-icons/pi";
import { RiReplyLine } from "react-icons/ri";
import { copyImageSourceToClipboard } from "../../../utils/blobUtils.js";

const getOverlayHost = () => {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector('[data-conversation-overlay-root="true"]') ||
    document.body
  );
};

const slideInNext = keyframes`
  from {
    opacity: 0;
    transform: translateX(60px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

const slideInPrev = keyframes`
  from {
    opacity: 0;
    transform: translateX(-60px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

const zoomIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const ImageGalleryOverlay = ({
  open,
  entries = [],
  activeId,
  onSelect,
  onClose,
}) => {
  const theme = useTheme();
  const [overlayRoot, setOverlayRoot] = useState(() => getOverlayHost());
  const [imageLoaded, setImageLoaded] = useState(false);
  const loadedEntriesRef = useRef(new Set());
  const lastIndexRef = useRef(undefined);
  const [slideDirection, setSlideDirection] = useState("none");
  const [animationKey, setAnimationKey] = useState(0);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panOffsetRef = useRef(panOffset);
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    origin: { x: 0, y: 0 },
    startOffset: { x: 0, y: 0 },
  });

  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  useEffect(() => {
    if (overlayRoot) return;
    setOverlayRoot(getOverlayHost());
  }, [overlayRoot]);

  const currentIndex = useMemo(
    () => entries.findIndex((entry) => entry.id === activeId),
    [entries, activeId]
  );
  const totalEntries = entries.length;
  const resolvedIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentEntry = entries[resolvedIndex];
  const hasPrev = resolvedIndex > 0;
  const hasNext = resolvedIndex < totalEntries - 1;

  useEffect(() => {
    if (!open) return;
    if (!currentEntry && totalEntries) {
      onSelect?.(entries[0].id);
    }
  }, [open, currentEntry, entries, onSelect, totalEntries]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
        return;
      }
      if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onSelect?.(entries[resolvedIndex + 1].id);
      } else if (event.key === "ArrowLeft" && hasPrev) {
        event.preventDefault();
        onSelect?.(entries[resolvedIndex - 1].id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasNext, hasPrev, entries, resolvedIndex, onClose, onSelect]);

  useEffect(() => {
    if (!currentEntry?.id) {
      setImageLoaded(false);
      return;
    }
    setImageLoaded(loadedEntriesRef.current.has(currentEntry.id));
    setZoomFactor(1);
    setPanOffset({ x: 0, y: 0 });
  }, [currentEntry]);

  useEffect(() => {
    if (zoomFactor <= 1) {
      setPanOffset({ x: 0, y: 0 });
    }
  }, [zoomFactor]);

  useEffect(() => {
    if (!open) return;
    const pending = [];
    entries.forEach((entry) => {
      if (!entry?.id || loadedEntriesRef.current.has(entry.id) || !entry.url) {
        return;
      }
      const preloadImg = new Image();
      const handleResolve = () => {
        loadedEntriesRef.current.add(entry.id);
        if (entry.id === currentEntry?.id) {
          setImageLoaded(true);
        }
      };
      preloadImg.onload = handleResolve;
      preloadImg.onerror = handleResolve;
      preloadImg.src = entry.url;
      pending.push(preloadImg);
    });
    return () => {
      pending.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [entries, open, currentEntry?.id]);

  useEffect(() => {
    if (!open) {
      lastIndexRef.current = undefined;
      setSlideDirection("none");
      return;
    }
    const lastIndex = lastIndexRef.current;
    if (lastIndex === undefined) {
      lastIndexRef.current = resolvedIndex;
      setSlideDirection("none");
      return;
    }
    if (lastIndex === resolvedIndex) {
      setSlideDirection("none");
      return;
    }
    setSlideDirection(resolvedIndex > lastIndex ? "next" : "prev");
    lastIndexRef.current = resolvedIndex;
  }, [open, resolvedIndex]);

  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
  }, [currentEntry?.id, slideDirection]);

  if (!open || !overlayRoot || !currentEntry) {
    return null;
  }

  const caption =
    typeof currentEntry.caption === "string"
      ? currentEntry.caption.trim()
      : "";

  const backgroundColor =
    theme.palette.mode === "dark"
      ? alpha("#050505", 0.95)
      : alpha(theme.palette.common.black, 0.9);

  const handleDownload = () => {
    if (!currentEntry.downloadSource) return;
    try {
      const link = document.createElement("a");
      link.href = currentEntry.downloadSource;
      const entryExtensionRaw =
        currentEntry.extension ||
        resolveFileExtension({
          fileName: currentEntry.originalFileName || currentEntry.filename || "",
          mimeType: currentEntry.mimeType || "",
          typeLabel: "image",
        }) ||
        "png";
      const entryExtension =
        entryExtensionRaw?.toLowerCase?.() || entryExtensionRaw || "png";
      const rawBase =
        currentEntry.originalFileName ||
        currentEntry.filename ||
        currentEntry.downloadSource?.split("/")?.pop() ||
        `image.${entryExtension}`;
      const normalizedName = rawBase.includes(".")
        ? rawBase
        : `${rawBase}.${entryExtension}`;
      const sanitizedName = normalizedName.replace(/[\\/:"*?<>|]+/g, "_");
      link.download = sanitizedName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // ignore download failures
    }
  };

  const triggerAction = (actionKey) => {
    if (!actionKey || !currentEntry?.invokeAction) return false;
    currentEntry.invokeAction(actionKey, { source: "image-overlay" });
    return true;
  };

  const triggerActionAndClose = (actionKey) => {
    if (triggerAction(actionKey)) {
      onClose?.();
    }
  };

  const handleShareImage = async () => {
    if (!currentEntry?.url) return;
    const shareUrl = currentEntry.downloadSource || currentEntry.url;
    const shareTitle =
      currentEntry.originalFileName || currentEntry.filename || "Image";
    if (navigator?.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: currentEntry.caption || undefined,
          url: shareUrl,
        });
        return;
      } catch {
        // ignore share rejection
      }
    }
    try {
      await navigator.clipboard?.writeText(shareUrl);
    } catch {
      // ignore clipboard failures
    }
  };

  const handleCopyImage = async () => {
    const source = currentEntry?.downloadSource || currentEntry?.url;
    if (!source) return;
    try {
      await copyImageSourceToClipboard(source);
    } catch {
      // ignore copy failures
    }
  };

  const handleZoom = (delta) => {
    setZoomFactor((prev) => {
      const next = Math.max(0.5, Math.min(3, prev + delta));
      return Number(next.toFixed(2));
    });
  };

  const handlePrev = () => {
    if (!hasPrev) return;
    onSelect?.(entries[resolvedIndex - 1].id);
  };

  const handleNext = () => {
    if (!hasNext) return;
    onSelect?.(entries[resolvedIndex + 1].id);
  };

  const beginImagePan = (event) => {
    if (!imageLoaded || zoomFactor <= 1) return;
    event.preventDefault();
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      startOffset: { ...panOffsetRef.current },
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const updateImagePan = (event) => {
    const state = dragStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - state.origin.x;
    const deltaY = event.clientY - state.origin.y;
    setPanOffset({
      x: state.startOffset.x + deltaX,
      y: state.startOffset.y + deltaY,
    });
  };

  const endImagePan = (event) => {
    const state = dragStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    const pointerId = state.pointerId;
    dragStateRef.current = {
      active: false,
      pointerId: null,
      origin: { x: 0, y: 0 },
      startOffset: { ...panOffsetRef.current },
    };
    setIsPanning(false);
    event.currentTarget.releasePointerCapture?.(pointerId);
  };

  const cancelImagePan = (event) => {
    if (!dragStateRef.current.active) return;
    const pointerId = dragStateRef.current.pointerId;
    dragStateRef.current = {
      active: false,
      pointerId: null,
      origin: { x: 0, y: 0 },
      startOffset: { ...panOffsetRef.current },
    };
    setIsPanning(false);
    if (event?.currentTarget && pointerId != null) {
      event.currentTarget.releasePointerCapture?.(pointerId);
    }
  };

  const actionButtons = [
    {
      key: "share-external",
      icon: PiArrowSquareOutBold,
      label: "Share",
      handler: handleShareImage,
    },
    {
      key: "reply",
      icon: RiReplyLine,
      label: "Reply",
      handler: () => triggerActionAndClose("reply"),
    },
    {
      key: "forward",
      icon: PiShareFatBold,
      label: "Forward",
      handler: () => triggerActionAndClose("forward"),
    },
    {
      key: "copy-image",
      icon: PiCopySimpleBold,
      label: "Copy image",
      handler: handleCopyImage,
    },
    {
      key: "zoom-in",
      icon: PiMagnifyingGlassPlusBold,
      label: "Zoom in",
      handler: () => handleZoom(0.2),
    },
    {
      key: "zoom-out",
      icon: PiMagnifyingGlassMinusBold,
      label: "Zoom out",
      handler: () => handleZoom(-0.2),
    },
    currentEntry.downloadSource
      ? {
          key: "download",
          icon: PiDownloadSimple,
          label: "Download",
          handler: handleDownload,
        }
      : null,
    {
      key: "close",
      icon: PiXBold,
      label: "Close",
      handler: onClose,
    },
  ].filter(Boolean);

  const headingLabel = `${Math.min(resolvedIndex + 1, totalEntries)} / ${totalEntries}`;

  return createPortal(
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: (muiTheme) => muiTheme.zIndex.modal + 1,
        backgroundColor,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: theme.palette.common.white,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 3,
          py: 2,
          color: "inherit",
          fontWeight: 600,
          letterSpacing: "0.08em",
        }}
      >
        <Typography variant="body2">{headingLabel}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {actionButtons.map((action) => {
            const Icon = action.icon;
            return (
              <Tooltip key={action.key} title={action.label}>
                <IconButton
                  size="small"
                  onClick={action.handler}
                  sx={{
                    width: 34,
                    height: 34,
                    color: theme.palette.common.white,
                    borderRadius: 1,
                    "&:hover": {
                      bgcolor: alpha(theme.palette.common.white, 0.15),
                    },
                  }}
                >
                  <Icon size={18} />
                </IconButton>
              </Tooltip>
            );
          })}
        </Stack>
      </Stack>
      <Box
      sx={{
        flexGrow: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        px: 4,
        pb: 4,
      }}
    >
        <IconButton
          size="large"
          onClick={handlePrev}
          disabled={!hasPrev}
          sx={{
            position: "absolute",
            left: 24,
            zIndex:9,
            bgcolor: alpha(theme.palette.common.white, 0.1),
            color: theme.palette.common.white,
            "&:hover": {
              bgcolor: alpha(theme.palette.common.white, 0.25),
            },
            "&:disabled": {
              color: alpha(theme.palette.common.white, 0.3),
              bgcolor: "transparent",
            },
          }}
        >
          <PiCaretLeftBold size={22} />
        </IconButton>
        <Box
          key={animationKey}
          sx={{
            maxWidth: "82vw",
            maxHeight: "70vh",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            animation:
              slideDirection === "next"
                ? `${slideInNext} 260ms ease`
                : slideDirection === "prev"
                ? `${slideInPrev} 260ms ease`
                : `${zoomIn} 260ms ease`,
            animationFillMode: "both",
            willChange: "transform, opacity",
          }}
        >
          <Box
            component="img"
            src={currentEntry.url}
            alt={currentEntry.filename || currentEntry.caption || "image"}
            onLoad={() => {
              if (currentEntry?.id) {
                loadedEntriesRef.current.add(currentEntry.id);
              }
              setImageLoaded(true);
            }}
            onError={() => setImageLoaded(true)}
            onPointerDown={beginImagePan}
            onPointerMove={updateImagePan}
            onPointerUp={endImagePan}
            onPointerCancel={cancelImagePan}
            onPointerLeave={cancelImagePan}
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: imageLoaded ? "block" : "none",
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomFactor})`,
              transition: isPanning ? "none" : "transform 0.2s ease",
              transformOrigin: "center",
              cursor:
                zoomFactor > 1
                  ? isPanning
                    ? "grabbing"
                    : "grab"
                  : "default",
              userSelect: "none",
              touchAction: zoomFactor > 1 ? "none" : "auto",
            }}
          />
          {!imageLoaded ? (
            <Stack
              spacing={1}
              alignItems="center"
              justifyContent="center"
              sx={{
                position: "absolute",
                inset: 0,
              }}
            >
              <CircularProgress color="inherit" />
              <Typography variant="caption" color="inherit">
                Loading image...
              </Typography>
            </Stack>
          ) : null}
        </Box>
        <IconButton
          size="large"
          onClick={handleNext}
          disabled={!hasNext}
          sx={{
            position: "absolute",
            right: 24,
            zIndex:9,
            bgcolor: alpha(theme.palette.common.white, 0.1),
            color: theme.palette.common.white,
            "&:hover": {
              bgcolor: alpha(theme.palette.common.white, 0.25),
            },
            "&:disabled": {
              color: alpha(theme.palette.common.white, 0.3),
              bgcolor: "transparent",
            },
          }}
        >
          <PiCaretRightBold size={22} />
        </IconButton>
        {caption ? (
          <Box
            sx={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              width: "70vw",
              p: 1,
              backgroundColor: alpha(theme.palette.common.black, 0.5),
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: theme.palette.common.white,textAlign: "center" }}
            >
              {caption}
            </Typography>
          </Box>
        ) : null}
      </Box>
      <Box
        sx={{
          borderTop: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
          backgroundColor: alpha(theme.palette.common.black, 0.6),
          px: 2,
          py: 1.5,
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ overflowX: "auto" }}
        >
          {entries.map((entry) => {
            const active = entry.id === currentEntry.id;
            return (
              <ButtonBase
                key={entry.id}
                onClick={() => onSelect?.(entry.id)}
                sx={{
                  borderRadius: 1,
                  border: `2px solid ${
                    active
                      ? theme.palette.primary.main
                      : alpha(theme.palette.common.white, 0.2)
                  }`,
                  overflow: "hidden",
                }}
              >
                <Box
                  component="img"
                  src={entry.thumbnail || entry.url}
                  alt="preview"
                  sx={{
                    width: 72,
                    height: 54,
                    objectFit: "cover",
                    display: "block",
                    opacity: active ? 1 : 0.75,
                    cursor: "grab"
                  }}
                />
              </ButtonBase>
            );
          })}
        </Stack>
      </Box>
    </Box>,
    overlayRoot
  );
};

export default ImageGalleryOverlay;
