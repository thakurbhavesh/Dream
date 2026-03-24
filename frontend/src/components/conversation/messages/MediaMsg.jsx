import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import {
  PiArrowCounterClockwiseBold,
  PiDownloadSimple,
  PiLinkBold,
  PiPlayCircle,
  PiXBold,
} from "react-icons/pi";
import { formatFileSize } from "./helpers.js";
import UploadProgressIndicator from "../files/UploadProgressIndicator.jsx";
import ImageGalleryOverlay from "./ImageGalleryOverlay.jsx";
import {
  registerImageEntry,
  useImageGalleryEntries,
} from "./imageGalleryStore.js";
import { resolveFileExtension } from "../files/filePreviewUtils.js";

const pickFirstString = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const deriveSizeFromDataUrl = (value) => {
  if (!value || typeof value !== "string") return null;
  const base64Index = value.indexOf("base64,");
  if (!value.startsWith("data:") || base64Index === -1) return null;
  const encoded = value.slice(base64Index + 7);
  const paddingMatch = encoded.match(/=+$/);
  const padding = paddingMatch ? paddingMatch[0].length : 0;
  const bytes = (encoded.length * 3) / 4 - padding;
  return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
};

const formatDurationLabel = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.round(value)}s`;
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
};

const ERROR_STATES = new Set(["error", "failed", "cancelled", "canceled"]);

const resolveProgressPercent = (rawValue) => {
  if (typeof rawValue !== "number" || Number.isNaN(rawValue)) return null;
  const normalized = rawValue <= 1 ? rawValue * 100 : rawValue;
  return Math.max(0, Math.min(100, normalized));
};

const MediaMsg = ({ message, onAction, hideInlineActions = false }) => {
  const {
    url,
    fileName,
    fileSize,
    caption,
    thumbnail,
    duration,
    mimeType,
    rawSize,
  } = message?.content ?? {};
  const isVideo = message?.type === "video";
  const theme = useTheme();
  const isOutgoing = message?.direction === "outgoing";
  const normalizedStatus = message?.status?.toLowerCase?.() ?? "";
  const metadataUploadState =
    message?.metadata?.uploadState?.toLowerCase?.() ?? "";
  const metadataQueued = Boolean(message?.metadata?.uploadQueued);
  const metadataActions = message?.metadata?.uploadActions || {};
  const [isPlaying, setIsPlaying] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeMediaId, setActiveMediaId] = useState(null);
  const galleryEntries = useImageGalleryEntries();
  const fallbackFile = useMemo(() => {
    const candidates = [];
    if (Array.isArray(message?.content?.files)) {
      candidates.push(...message.content.files.filter(Boolean));
    }
    if (Array.isArray(message?.files)) {
      candidates.push(...message.files.filter(Boolean));
    }
    if (Array.isArray(message?.attachments)) {
      candidates.push(...message.attachments.filter(Boolean));
    }
    if (Array.isArray(message?.content?.attachments)) {
      candidates.push(...message.content.attachments.filter(Boolean));
    }
    return candidates[0] ?? null;
  }, [message]);

  const resolvedMimeType = useMemo(() => {
    const candidates = [
      mimeType,
      message?.metadata?.mimeType,
      fallbackFile?.mimeType,
      fallbackFile?.type,
      fallbackFile?.contentType,
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    if (url?.startsWith?.("data:")) {
      const typeSection = url.slice(
        5,
        url.indexOf(";") > -1 ? url.indexOf(";") : undefined
      );
      return typeSection?.trim?.() || null;
    }
    return null;
  }, [mimeType, message?.metadata?.mimeType, fallbackFile, url]);

  const downloadSource =
    message?.content?.downloadUrl ||
    message?.metadata?.downloadUrl ||
    fallbackFile?.downloadUrl ||
    fallbackFile?.file_url ||
    fallbackFile?.url ||
    url;

  const resolvedFileName = useMemo(
    () =>
      pickFirstString(
        message?.content?.fileName,
        message?.content?.name,
        message?.content?.filename,
        message?.content?.originalName,
        message?.content?.original_name,
        message?.metadata?.fileName,
        message?.metadata?.name,
        message?.metadata?.filename,
        message?.metadata?.originalFileName,
        message?.metadata?.originalName,
        message?.metadata?.original_name,
        fallbackFile?.fileName,
        fallbackFile?.name,
        fallbackFile?.filename,
        fallbackFile?.originalFileName,
        fallbackFile?.originalName,
        fallbackFile?.original_name,
        fileName
      ),
    [
      fileName,
      fallbackFile?.fileName,
      fallbackFile?.name,
      fallbackFile?.filename,
      fallbackFile?.originalFileName,
      fallbackFile?.originalName,
      fallbackFile?.original_name,
      message?.content?.fileName,
      message?.content?.name,
      message?.content?.filename,
      message?.content?.originalName,
      message?.content?.original_name,
      message?.metadata?.fileName,
      message?.metadata?.name,
      message?.metadata?.filename,
      message?.metadata?.originalFileName,
      message?.metadata?.originalName,
      message?.metadata?.original_name,
    ]
  );

  const extension = useMemo(() => {
    const candidates = [
      message?.content,
      message?.metadata,
      fallbackFile,
      {
        fileName: resolvedFileName || "",
        mimeType: resolvedMimeType || "",
        url: downloadSource || url || "",
        typeLabel: isVideo ? "mp4" : "img",
      },
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const ext = resolveFileExtension(candidate);
      if (ext && ext !== "file") {
        return ext.toLowerCase();
      }
    }
    if (resolvedMimeType?.includes?.("/")) {
      const subtype =
        resolvedMimeType.split("/").pop()?.split(";")?.[0]?.toLowerCase();
      if (subtype) return subtype;
    }
    return isVideo ? "mp4" : "png";
  }, [message?.content, message?.metadata, fallbackFile, resolvedFileName, resolvedMimeType, downloadSource, url, isVideo]);

  const typeLabel = useMemo(() => {
    if (extension) {
      return extension.toUpperCase();
    }
    if (resolvedMimeType) {
      const normalized =
        resolvedMimeType.split(";")[0] || resolvedMimeType;
      const parts = normalized.split("/");
      const label = parts[parts.length - 1] || normalized;
      return label.toUpperCase();
    }
    return isVideo ? "VIDEO" : "IMAGE";
  }, [extension, resolvedMimeType, isVideo]);
  const numericFallbackSize =
    (typeof rawSize === "number" && rawSize > 0 && rawSize) ||
    (typeof fallbackFile?.rawSize === "number" &&
      fallbackFile.rawSize > 0 &&
      fallbackFile.rawSize) ||
    (typeof fallbackFile?.size === "number" &&
      fallbackFile.size > 0 &&
      fallbackFile.size) ||
    (typeof fallbackFile?.file_size === "number" &&
      fallbackFile.file_size > 0 &&
      fallbackFile.file_size) ||
    (typeof message?.metadata?.size === "number" &&
      message.metadata.size > 0 &&
      message.metadata.size) ||
    deriveSizeFromDataUrl(url);
  const sizeValue =
    fileSize ||
    fallbackFile?.fileSize ||
    fallbackFile?.sizeLabel ||
    message?.metadata?.fileSize ||
    message?.metadata?.sizeLabel ||
    (numericFallbackSize ? formatFileSize(numericFallbackSize) : null) ||
    (fileSize === 0 ? "0 B" : null);
  const sizeLabel = sizeValue ?? "--";
  const formattedName = useMemo(() => {
    const base =
      (typeof resolvedFileName === "string" &&
        resolvedFileName.replace(/\.[^.]+$/, "")) ||
      (isVideo ? "video" : "image");
    const ext = extension || (isVideo ? "mp4" : "png");
    return `${base}.${ext}`;
  }, [resolvedFileName, extension, isVideo]);
  const metaLabel = [sizeLabel, typeLabel].filter(Boolean).join(" / ");
  const initialDuration =
    duration ??
    fallbackFile?.duration ??
    fallbackFile?.metadata?.duration ??
    message?.metadata?.duration ??
    null;
  const [resolvedDuration, setResolvedDuration] = useState(initialDuration);
  useEffect(() => {
    setResolvedDuration(initialDuration);
  }, [initialDuration]);
  const durationLabel = isVideo ? formatDurationLabel(resolvedDuration) : null;

  const handleMetadata = (event) => {
    const metaDuration = event?.currentTarget?.duration;
    if (!Number.isFinite(metaDuration)) return;
    setResolvedDuration((prev) => {
      if (
        (typeof prev === "number" && Number.isFinite(prev)) ||
        (typeof prev === "string" && prev.trim())
      ) {
        return prev;
      }
      return metaDuration;
    });
  };

  const entryUploadState =
    message?.content?.uploadState?.toLowerCase?.() ||
    fallbackFile?.uploadState?.toLowerCase?.() ||
    "";
  const entryProgress =
    resolveProgressPercent(message?.content?.uploadProgress) ??
    resolveProgressPercent(fallbackFile?.uploadProgress) ??
    resolveProgressPercent(message?.metadata?.uploadProgress);
  const isMessageUploading =
    isOutgoing &&
    (metadataQueued ||
      normalizedStatus === "pending" ||
      normalizedStatus === "sending" ||
      metadataUploadState === "uploading");
  const entryUploading =
    isMessageUploading &&
    (entryUploadState === "uploading" ||
      !url ||
      normalizedStatus === "pending" ||
      normalizedStatus === "sending");
  const isMessageErrored =
    isOutgoing &&
    (ERROR_STATES.has(normalizedStatus) ||
      ERROR_STATES.has(metadataUploadState) ||
      Boolean(message?.metadata?.uploadError));
  const entryErrored =
    isMessageErrored ||
    ERROR_STATES.has(entryUploadState) ||
    Boolean(message?.content?.uploadError) ||
    Boolean(fallbackFile?.uploadError);
  const entryActions = {
    onRetry:
      message?.content?.uploadActions?.onRetry ?? metadataActions.onRetry,
    onCancel:
      message?.content?.uploadActions?.onCancel ?? metadataActions.onCancel,
  };
  const canRetry =
    entryErrored &&
    (typeof entryActions.onRetry === "function" ||
      typeof onAction === "function");
  const canCancel =
    entryUploading &&
    (typeof entryActions.onCancel === "function" ||
      typeof onAction === "function");

  const handleRetry = (event) => {
    event?.stopPropagation?.();
    if (!canRetry) return;
    entryActions.onRetry?.(message);
    onAction?.("retry-upload", { messageId: message?.id });
  };

  const handleCancel = (event) => {
    event?.stopPropagation?.();
    if (!canCancel) return;
    entryActions.onCancel?.(message);
    onAction?.("cancel-upload", { messageId: message?.id });
  };

  const downloadButton =
    !hideInlineActions && downloadSource && !entryUploading && !entryErrored ? (
      <IconButton
        size="small"
        component="a"
        href={downloadSource}
        target="_blank"
        rel="noopener noreferrer"
        download={formattedName}
        sx={{
          width: 28,
          height: 28,
          color: isOutgoing
            ? theme.palette.text.primary
            : theme.palette.primary.main,
        }}
      >
        <PiDownloadSimple size={16} />
      </IconButton>
    ) : null;

  const linkRow =
    url && isVideo ? (
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{ minWidth: 0, mt: 0.5 }}
      >
        <PiLinkBold size={16} color="text.primary" />
        <Typography
          variant="caption"
          component="a"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: "text.primary",
            textDecoration: "none",
            display: "block",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {url}
        </Typography>
      </Stack>
    ) : null;

  const metaDetails = (
    <Stack spacing={0.5}>
      {linkRow}
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography variant="caption" sx={{ color: "text.primary" }}>
          {metaLabel}
          {durationLabel ? ` • ${durationLabel}` : ""}
        </Typography>
        {downloadButton}
      </Stack>
    </Stack>
  );

  if (!url) return null;
  const canOpenOverlay = !isVideo && !entryUploading && !entryErrored && url;

  useEffect(() => {
    if (
      isVideo ||
      !message?.id ||
      !url ||
      entryUploading ||
      entryErrored
    ) {
      return undefined;
    }
    const unregister = registerImageEntry({
      id: message.id,
      url,
      thumbnail: thumbnail || url,
      caption: caption || "",
      downloadSource,
      filename: formattedName,
      originalFileName: resolvedFileName,
      extension,
      mimeType: resolvedMimeType,
      createdAt:
        message?.createdAt ??
        message?.metadata?.createdAt ??
        message?.content?.createdAt ??
        null,
      invokeAction: (actionKey, payload = {}) =>
        onAction?.(actionKey, { ...payload }),
    });
    return unregister;
  }, [
    caption,
    downloadSource,
    entryErrored,
    entryUploading,
    formattedName,
    isVideo,
    resolvedMimeType,
    resolvedFileName,
    message?.content?.createdAt,
    message?.createdAt,
    message?.id,
    message?.metadata?.createdAt,
    onAction,
    thumbnail,
    url,
  ]);

  useEffect(() => {
    if (!overlayOpen) return;
    if (!galleryEntries.length) {
      setOverlayOpen(false);
      setActiveMediaId(null);
      return;
    }
    if (
      activeMediaId &&
      !galleryEntries.some((entry) => entry.id === activeMediaId)
    ) {
      setActiveMediaId(galleryEntries[0]?.id ?? null);
    }
  }, [activeMediaId, galleryEntries, overlayOpen]);

  const handleOpenOverlay = () => {
    if (!canOpenOverlay) return;
    setActiveMediaId(message?.id ?? null);
    setOverlayOpen(true);
  };

  const handleOverlayClose = () => {
    setOverlayOpen(false);
  };

  const renderOverlay = () => {
    if (!entryUploading && !entryErrored) return null;
    return (
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          bgcolor: alpha(theme.palette.common.black, 0.55),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 1,
          zIndex: 2,
          "&:hover .upload-cancel-btn": {
            opacity: 1,
            visibility: "visible",
          },
          "&:hover .upload-progress-label": {
            opacity: 0,
          },
        }}
      >
        {entryErrored ? (
          <Tooltip title={canRetry ? "Retry upload" : "Upload failed"}>
            <span>
              <IconButton
                size="large"
                disabled={!canRetry}
                onClick={handleRetry}
                sx={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  bgcolor: alpha(theme.palette.error.main, 0.2),
                  color: theme.palette.error.contrastText,
                }}
              >
                <PiArrowCounterClockwiseBold size={24} />
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <Box
            sx={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UploadProgressIndicator
              value={
                typeof entryProgress === "number" ? entryProgress : undefined
              }
              size={64}
              thickness={4}
              labelColor={theme.palette.common.white}
              labelOverride={
                typeof entryProgress === "number"
                  ? `${Math.round(entryProgress)}%`
                  : "0%"
              }
              progressSx={{ color: theme.palette.common.white }}
            />
            {canCancel ? (
              <IconButton
                size="small"
                className="upload-cancel-btn"
                onClick={handleCancel}
                sx={{
                  position: "absolute",
                  inset: 0,
                  m: "auto",
                  width: 32,
                  height: 32,
                  bgcolor: alpha(theme.palette.common.white, 0.25),
                  color: theme.palette.common.white,
                  opacity: 0,
                  visibility: "hidden",
                }}
              >
                <PiXBold size={16} />
              </IconButton>
            ) : null}
          </Box>
        )}
      </Box>
    );
  };

  if (isVideo) {
    return (
      <Stack spacing={0.75} sx={{ maxWidth: 400 }}>
        <Box
          component="video"
          src={url}
          preload="metadata"
          onLoadedMetadata={handleMetadata}
          sx={{ display: "none" }}
        />
        {isPlaying && !entryUploading && !entryErrored ? (
          <Box
            component="video"
            src={url}
            poster={thumbnail}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onEnded={() => setIsPlaying(false)}
            onLoadedMetadata={handleMetadata}
            sx={{
              width: "100%",
              height: "100%",
              aspectRatio: "16/9",
              borderRadius: 1,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {renderOverlay()}
          </Box>
        ) : (
          <Box
            onClick={() => {
              if (entryUploading || entryErrored) return;
              setIsPlaying(true);
            }}
            sx={{
              width: "100%",
              minHeight: 220,

              borderRadius: 1,
              overflow: "hidden",
              position: "relative",
              cursor: entryUploading || entryErrored ? "default" : "pointer",
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              mt: 0,
            }}
          >
            {thumbnail ? (
              <Box
                component="img"
                src={thumbnail}
                alt={formattedName}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <Box sx={{ pt: "56.25%" }} />
            )}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `linear-gradient(180deg, transparent, ${alpha(
                  theme.palette.common.black,
                  0.25
                )})`,
              }}
            >
              <PiPlayCircle size={48} color={theme.palette.primary.light} />
            </Box>
            {renderOverlay()}
          </Box>
        )}
        {metaDetails}
      </Stack>
    );
  }

  return (
    <>
      <Stack spacing={0.75} maxWidth={400}>
        <Box
          role={canOpenOverlay ? "button" : undefined}
          tabIndex={canOpenOverlay ? 0 : undefined}
          onClick={canOpenOverlay ? handleOpenOverlay : undefined}
          onKeyDown={
            canOpenOverlay
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenOverlay();
                  }
                }
              : undefined
          }
          sx={{
            width: "100%",
            height: "100%",
            borderRadius: 1,
            overflow: "hidden",
            position: "relative",
            cursor: "pointer",
          }}
        >
          <Box
            component="img"
            src={url}
            alt={caption || fileName || "image"}
            loading="lazy"
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
          {renderOverlay()}
        </Box>
        {metaDetails}
      </Stack>
      <ImageGalleryOverlay
        open={overlayOpen}
        entries={galleryEntries}
        activeId={activeMediaId ?? message?.id ?? null}
        onSelect={(nextId) => setActiveMediaId(nextId)}
        onClose={handleOverlayClose}
      />
    </>
  );
};

export default MediaMsg;
