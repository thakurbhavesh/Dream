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
import { FileIcon } from "react-file-icon";
import {
  buildFileIconProps,
  buildIconStyleMap,
  formatFileSize,
  resolveFileExtension,
} from "../files/filePreviewUtils.js";
import {
  PiArrowSquareOutBold,
  PiCaretLeftBold,
  PiCaretRightBold,
  PiDownloadSimple,
  PiFileTextBold,
  PiCopySimpleBold,
  PiLinkSimpleBold,
  PiShareFatBold,
  PiXBold,
} from "react-icons/pi";
import { RiReplyLine } from "react-icons/ri";

const OFFICE_VIEWER_EXTENSIONS = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "xlsm",
  "xlsb",
  "ppt",
  "pptx",
  "pps",
  "ppsx",
  "rtf",
  "csv",
  "tsv",
]);

const INLINE_VIEWER_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "md",
  "json",
  "log",
  "xml",
  "html",
  "htm",
]);

const CODE_PREVIEW_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "scss",
  "less",
  "html",
  "htm",
  "php",
  "py",
  "rb",
  "go",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "rs",
  "swift",
  "kt",
  "kts",
  "sql",
  "json",
  "yml",
  "yaml",
  "xml",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "bat",
  "cmd",
  "ini",
  "env",
  "toml",
  "md",
  "txt",
  "log",
]);

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
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

const normalizeSourceUrl = (entry) =>
  entry?.viewerSource ||
  entry?.sourceUrl ||
  entry?.downloadSource ||
  entry?.url ||
  entry?.previewUrl ||
  "";

const shouldUseOfficeViewer = (extension, mimeType) => {
  if (!extension && !mimeType) return false;
  if (extension && OFFICE_VIEWER_EXTENSIONS.has(extension)) return true;
  if (mimeType?.startsWith?.("application/vnd.openxmlformats")) return true;
  if (mimeType?.includes?.("ms-excel") || mimeType?.includes?.("msword")) {
    return true;
  }
  if (mimeType?.includes?.("powerpoint")) return true;
  return false;
};

const canUseInlineViewer = (extension, mimeType) => {
  if (extension && INLINE_VIEWER_EXTENSIONS.has(extension)) return true;
  if (mimeType?.includes?.("pdf")) return true;
  if (mimeType?.startsWith?.("text/")) return true;
  return false;
};

const isCodePreviewFile = (extension, mimeType = "") => {
  if (extension && OFFICE_VIEWER_EXTENSIONS.has(extension)) return false;
  if (extension && CODE_PREVIEW_EXTENSIONS.has(extension)) return true;
  const normalized = mimeType.toLowerCase();
  if (
    normalized.includes("csv") ||
    normalized.includes("tsv") ||
    normalized.includes("msword") ||
    normalized.includes("officedocument") ||
    normalized.includes("spreadsheet") ||
    normalized.includes("excel") ||
    normalized.includes("presentation")
  ) {
    return false;
  }
  if (normalized.startsWith("text/")) return true;
  if (normalized.includes("json")) return true;
  if (normalized.includes("xml")) return true;
  if (normalized.includes("yaml") || normalized.includes("yml")) return true;
  if (normalized.includes("javascript")) return true;
  if (normalized.includes("typescript")) return true;
  if (normalized.includes("python")) return true;
  if (normalized.includes("x-php") || normalized.includes("php")) return true;
  if (normalized.includes("sql")) return true;
  if (normalized.includes("x-shellscript")) return true;
  return false;
};

const buildOfficeViewerUrl = (sourceUrl) => {
  if (!sourceUrl) return "";
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    sourceUrl
  )}`;
};

const buildGoogleDocsViewerUrl = (sourceUrl) => {
  if (!sourceUrl) return "";
  return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
    sourceUrl
  )}`;
};

const FilePreviewOverlay = ({
  open,
  entries = [],
  activeId,
  onSelect,
  onClose,
}) => {
  const theme = useTheme();
  const [overlayRoot, setOverlayRoot] = useState(() => getOverlayHost());
  const [animationKey, setAnimationKey] = useState(0);
  const [slideDirection, setSlideDirection] = useState("none");
  const [previewStatus, setPreviewStatus] = useState("loading");
  const [pdfFallbackActive, setPdfFallbackActive] = useState(false);
  const [textPreview, setTextPreview] = useState("");
  const lastIndexRef = useRef(undefined);
  const iconStyleMap = useMemo(() => buildIconStyleMap(theme), [theme]);

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

  const derivedEntry = currentEntry || {};
  const captionText =
    typeof derivedEntry.caption === "string" ? derivedEntry.caption.trim() : "";
  const fileName =
    derivedEntry.originalFileName ||
    derivedEntry.filename ||
    derivedEntry.displayName ||
    "Attachment";
  const sourceUrl = normalizeSourceUrl(derivedEntry);
  const extensionRaw =
    derivedEntry.extension ||
    resolveFileExtension({
      fileName,
      mimeType: derivedEntry.mimeType || "",
      typeLabel: "file",
    }) ||
    "";
  const extension = extensionRaw?.toLowerCase?.() || "";
  const normalizedMime = derivedEntry.mimeType?.toLowerCase?.() || "";
  const isPdfFile = extension === "pdf" || normalizedMime.includes("pdf");
  const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "avif"]);
  const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogg", "mov", "avi", "mkv"]);
  const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "aac", "flac", "webm", "m4a"]);
  const isImageFile = IMAGE_EXTENSIONS.has(extension) || normalizedMime.startsWith("image/");
  const isVideoFile = VIDEO_EXTENSIONS.has(extension) || normalizedMime.startsWith("video/");
  const isAudioFile = !isVideoFile && (AUDIO_EXTENSIONS.has(extension) || normalizedMime.startsWith("audio/"));
  const useTextPreview =
    Boolean(currentEntry) && !isImageFile && !isVideoFile && !isAudioFile && isCodePreviewFile(extension, derivedEntry.mimeType);
  const inlineViewer =
    Boolean(currentEntry) &&
    !useTextPreview &&
    !isPdfFile &&
    !isImageFile &&
    !isVideoFile &&
    !isAudioFile &&
    canUseInlineViewer(extension, derivedEntry.mimeType);
  const useOfficeViewer =
    Boolean(currentEntry) &&
    !isImageFile &&
    !isVideoFile &&
    !isAudioFile &&
    shouldUseOfficeViewer(extension, derivedEntry.mimeType);
  const previewUrl = useMemo(() => {
    if (isImageFile || isVideoFile || isAudioFile) return sourceUrl;
    if (useOfficeViewer) return buildOfficeViewerUrl(sourceUrl);
    if (isPdfFile) {
      return pdfFallbackActive
        ? buildGoogleDocsViewerUrl(sourceUrl)
        : sourceUrl;
    }
    if (useTextPreview) return sourceUrl;
    if (inlineViewer) return sourceUrl;
    // Fallback: use Google Docs viewer for any file with a URL
    if (sourceUrl) return buildGoogleDocsViewerUrl(sourceUrl);
    return "";
  }, [isImageFile, isVideoFile, isAudioFile, useOfficeViewer, isPdfFile, useTextPreview, inlineViewer, sourceUrl, pdfFallbackActive]);

  useEffect(() => {
    setPdfFallbackActive(false);
    setTextPreview("");
    if (!open || !currentEntry) {
      setPreviewStatus("loading");
      return;
    }
    if (useTextPreview) {
      setPreviewStatus("loading");
      return;
    }
    if (!previewUrl) {
      setPreviewStatus("unsupported");
      return;
    }
    setPreviewStatus("loading");
  }, [open, previewUrl, currentEntry?.id, useTextPreview]);

  useEffect(() => {
    if (useTextPreview) return undefined;
    if (!open || previewStatus !== "loading" || !previewUrl) return undefined;
    // Office Viewer handles its own loading UI — don't timeout, auto-mark ready
    if (useOfficeViewer) {
      const readyTimer = setTimeout(() => {
        setPreviewStatus((prev) => (prev === "loading" ? "ready" : prev));
      }, 300);
      return () => clearTimeout(readyTimer);
    }
    const timeout = setTimeout(() => {
      setPreviewStatus((prev) => (prev === "loading" ? "error" : prev));
    }, 5000);
    return () => clearTimeout(timeout);
  }, [open, previewStatus, previewUrl, useTextPreview, useOfficeViewer]);

  useEffect(() => {
    if (!open || !useTextPreview || !sourceUrl) return undefined;
    let canceled = false;
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    setPreviewStatus("loading");
    fetch(sourceUrl, { signal: controller?.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("preview failed");
        }
        return response.text();
      })
      .then((text) => {
        if (canceled) return;
        setTextPreview(text);
        setPreviewStatus("ready");
      })
      .catch(() => {
        if (canceled) return;
        setPreviewStatus("error");
      });
    return () => {
      canceled = true;
      controller?.abort?.();
    };
  }, [open, useTextPreview, sourceUrl, currentEntry?.id]);

  const backgroundColor =
    theme.palette.mode === "dark"
      ? alpha("#050505", 0.95)
      : alpha(theme.palette.common.black, 0.9);

  const detailLabel = useMemo(() => {
    const labelParts = [];
    if (extension) {
      labelParts.push(extension.toUpperCase());
    }
    const sizeLabel =
      derivedEntry.sizeLabel ||
      (typeof derivedEntry.size === "number"
        ? formatFileSize(derivedEntry.size)
        : "") ||
      (typeof derivedEntry.fileSize === "number"
        ? formatFileSize(derivedEntry.fileSize)
        : "");
    if (sizeLabel) {
      labelParts.push(sizeLabel);
    }
    return labelParts.join(" · ");
  }, [
    derivedEntry.size,
    derivedEntry.sizeLabel,
    derivedEntry.fileSize,
    extension,
  ]);

  const shouldRender = Boolean(open && overlayRoot && currentEntry);
  if (!shouldRender) {
    return null;
  }

  const triggerAction = (actionKey) => {
    if (!actionKey || !currentEntry?.invokeAction) return false;
    currentEntry.invokeAction(actionKey, { source: "file-overlay" });
    return true;
  };

  const triggerActionAndClose = (actionKey) => {
    if (triggerAction(actionKey)) {
      onClose?.();
    }
  };

  const handleOpenExternal = () => {
    if (!sourceUrl) return;
    window.open(sourceUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownload = () => {
    if (!sourceUrl) return;
    try {
      const link = document.createElement("a");
      link.href = sourceUrl;
      const normalizedName = fileName.includes(".")
        ? fileName
        : extension
          ? `${fileName}.${extension}`
          : fileName;
      link.download = normalizedName.replace(/[\\/:"*?<>|]+/g, "_");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // ignore download failures
    }
  };

  const handleShare = async () => {
    if (!sourceUrl) return;
    const payload = {
      title: fileName,
      text: detailLabel || undefined,
      url: sourceUrl,
    };
    if (navigator?.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // ignore user cancellations
      }
    }
    try {
      await navigator.clipboard?.writeText(sourceUrl);
    } catch {
      // ignore fallback failure
    }
  };

  const handleCopyText = async () => {
    if (!textPreview) return;
    try {
      await navigator.clipboard?.writeText(textPreview);
    } catch {
      // ignore copy failures
    }
  };

  const handlePrev = () => {
    if (!hasPrev) return;
    onSelect?.(entries[resolvedIndex - 1].id);
  };

  const handleNext = () => {
    if (!hasNext) return;
    onSelect?.(entries[resolvedIndex + 1].id);
  };
  const handleFrameError = () => {
    if (isPdfFile && !pdfFallbackActive && sourceUrl) {
      setPdfFallbackActive(true);
      setPreviewStatus("loading");
      return;
    }
    setPreviewStatus("error");
  };

  const actionButtons = [
    {
      key: "share-external",
      icon: PiArrowSquareOutBold,
      label: "Open externally",
      handler: handleOpenExternal,
    },
    useTextPreview
      ? {
          key: "copy-text",
          icon: PiCopySimpleBold,
          label: "Copy text",
          handler: handleCopyText,
        }
      : null,
    {
      key: "share",
      icon: PiLinkSimpleBold,
      label: "Copy/share link",
      handler: handleShare,
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
    sourceUrl
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

  const headingLabel = `File ${Math.min(resolvedIndex + 1, totalEntries)} / ${totalEntries}`;

  const renderFallback = (label) => (
    <Stack
      spacing={1}
      alignItems="center"
      justifyContent="center"
      sx={{
        width: "100%",
        height: "100%",
        color: theme.palette.common.white,
      }}
    >
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.common.white, 0.08),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PiFileTextBold size={52} />
      </Box>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        No Preview Available
      </Typography>
      {label ? (
        <Typography
          variant="caption"
          color={alpha(theme.palette.common.white, 0.8)}
        >
          {label}
        </Typography>
      ) : null}
    </Stack>
  );

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
          px: 1,
          pb: 1,
        }}
      >
        <IconButton
          size="large"
          onClick={handlePrev}
          disabled={!hasPrev}
          sx={{
            position: "absolute",
            left: 24,
            zIndex: 9,
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
            borderRadius: 1,
            bgcolor: alpha(theme.palette.common.white, 0.05),
          }}
        >
          {isImageFile && sourceUrl ? (
            <Box
              component="img"
              src={sourceUrl}
              alt={fileName}
              onLoad={() => setPreviewStatus("ready")}
              onError={() => setPreviewStatus("error")}
              sx={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: previewStatus === "ready" ? "block" : "none",
                margin: "auto",
              }}
            />
          ) : isVideoFile && sourceUrl ? (
            <Box
              component="video"
              src={sourceUrl}
              controls
              autoPlay={false}
              onLoadedData={() => setPreviewStatus("ready")}
              onError={() => setPreviewStatus("error")}
              sx={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: previewStatus === "ready" ? "block" : "none",
                margin: "auto",
              }}
            />
          ) : isAudioFile && sourceUrl ? (
            <Stack alignItems="center" justifyContent="center" sx={{ width: "100%", height: "100%" }}>
              <Box
                component="audio"
                src={sourceUrl}
                controls
                onLoadedData={() => setPreviewStatus("ready")}
                onError={() => setPreviewStatus("error")}
                sx={{ maxWidth: "90%", display: previewStatus === "ready" ? "block" : "none" }}
              />
            </Stack>
          ) : useTextPreview ? (
            <>
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  overflow: "auto",
                  p: 2,
                  color: theme.palette.common.white,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {textPreview}
              </Box>
              {previewStatus === "error"
                ? renderFallback("Cannot display this file.")
                : null}
            </>
          ) : previewUrl ? (
            <>
              <Box
                component="iframe"
                src={previewUrl}
                title={fileName}
                loading="lazy"
                referrerPolicy="no-referrer"
                allowFullScreen
                onLoad={() => setPreviewStatus("ready")}
                onError={handleFrameError}
                {...(!useOfficeViewer ? { sandbox: "allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation" } : {})}
                sx={{
                  border: "none",
                  width: "100%",
                  height: "100%",
                  display: previewStatus === "ready" ? "block" : "none",
                  backgroundColor: theme.palette.common.black,
                }}
              />
              {previewStatus === "error" || previewStatus === "unsupported"
                ? renderFallback(
                    previewStatus === "unsupported"
                      ? "Preview not supported for this file."
                      : "Cannot display this file."
                  )
                : null}
            </>
          ) : (
            renderFallback("Use download to view this file.")
          )}
          {/* Common loading spinner for all types */}
          {previewStatus === "loading" && (isImageFile || isVideoFile || isAudioFile || useTextPreview || previewUrl) ? (
            <Stack
              spacing={1}
              alignItems="center"
              justifyContent="center"
              sx={{ position: "absolute", inset: 0 }}
            >
              <CircularProgress color="inherit" />
              <Typography variant="caption" color="inherit">Loading preview...</Typography>
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
            zIndex: 9,
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
        {captionText ? (
          <Box
            sx={{
              position: "absolute",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              width: "68vw",
              p: 1,
              backgroundColor: alpha(theme.palette.common.black, 0.5),
              textAlign: "center"
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: theme.palette.common.white }}
            >
              {captionText}
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
            const entryName =
              entry.originalFileName ||
              entry.filename ||
              entry.displayName ||
              "file";
            const entryExtension =
              entry.extension ||
              resolveFileExtension({
                fileName: entryName,
                mimeType: entry.mimeType || "",
                typeLabel: "file",
              });
            const iconProps = buildFileIconProps(
              entryExtension,
              theme,
              iconStyleMap
            );
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
                  px: 1,
                  py: 0.75,
                  minWidth: 80,
                }}
              >
                <Stack spacing={0.5} alignItems="center">
                  <Box sx={{ width: 32, height: 42 }}>
                    <FileIcon
                      extension={(entryExtension || "file").toLowerCase()}
                      {...iconProps}
                      radius={4}
                      labelUppercase
                      labelText={(entryExtension || "file")
                        .slice(0, 3)
                        .toUpperCase()}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.common.white,
                      whiteSpace: "nowrap",
                      maxWidth: 90,
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {entryName}
                  </Typography>
                </Stack>
              </ButtonBase>
            );
          })}
        </Stack>
      </Box>
    </Box>,
    overlayRoot
  );
};

export default FilePreviewOverlay;
