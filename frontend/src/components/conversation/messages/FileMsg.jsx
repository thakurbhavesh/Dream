import React, { useEffect, useMemo, useState } from "react";
import { Box, IconButton, Stack, Tooltip, useTheme } from "@mui/material";
import {
  PiArrowCounterClockwiseBold,
  PiDownloadSimple,
  PiXBold,
} from "react-icons/pi";
import FileAttachmentTile from "../files/FileAttachmentTile.jsx";
import UploadProgressIndicator from "../files/UploadProgressIndicator.jsx";
import { resolveFileExtension } from "../files/filePreviewUtils.js";
import FilePreviewOverlay from "./FilePreviewOverlay.jsx";
import {
  registerFilePreviewEntry,
  useFilePreviewEntries,
} from "./filePreviewStore.js";

const ERROR_STATES = new Set(["error", "failed", "cancelled", "canceled"]);

const FileMsg = ({ message, onAction, hideInlineActions = false }) => {
  const {
    files = [],
    fileName,
    fileSize,
    mimeType,
    preview,
    url,
    uploadProgress: contentUploadProgress,
  } = message?.content ?? {};
  const theme = useTheme();
  const isOutgoing = message?.direction === "outgoing";
  const normalizedStatus = message?.status?.toLowerCase?.() ?? "";
  const metadataUploadState =
    message?.metadata?.uploadState?.toLowerCase?.() ?? "";
  const metadataQueued = Boolean(message?.metadata?.uploadQueued);
  const metadataActions = message?.metadata?.uploadActions || {};
  const fileEntries =
    Array.isArray(files) && files.length
      ? files
      : [
          {
            fileName: fileName || "attached-file",
            fileSize,
            mimeType,
            preview,
            url,
            uploadProgress: contentUploadProgress,
          },
        ];
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activePreviewId, setActivePreviewId] = useState(null);
  const filePreviewEntries = useFilePreviewEntries();
  const normalizedFileEntries = useMemo(
    () =>
      fileEntries.map((entry, index) => {
        const previewId =
          entry?.id ||
          entry?.fileId ||
          entry?.file_id ||
          `${message?.id ?? "message"}-file-${index}`;
        const sourceUrl =
          entry?.url ||
          entry?.downloadUrl ||
          entry?.downloadSource ||
          entry?.preview ||
          url ||
          "";
        return {
          entry,
          index,
          previewId,
          sourceUrl,
        };
      }),
    [fileEntries, message?.id, url]
  );

  const isMessageUploading =
    isOutgoing &&
    (metadataQueued ||
      normalizedStatus === "pending" ||
      normalizedStatus === "sending" ||
      metadataUploadState === "uploading");
  const isMessageErrored =
    isOutgoing &&
    (ERROR_STATES.has(normalizedStatus) ||
      ERROR_STATES.has(metadataUploadState) ||
      Boolean(message?.metadata?.uploadError));

  const resolveProgressPercent = (rawValue) => {
    if (typeof rawValue !== "number" || Number.isNaN(rawValue)) return null;
    const normalized = rawValue <= 1 ? rawValue * 100 : rawValue;
    return Math.max(0, Math.min(100, normalized));
  };

  const dispatchUploadAction = (actionKey, entry, index) => {
    onAction?.(actionKey, {
      file: entry,
      entryIndex: index,
      messageId: message?.id,
    });
  };

  useEffect(() => {
    const cleanups = normalizedFileEntries.map(
      ({ entry, index, previewId, sourceUrl }) => {
        if (!previewId) return null;
        return registerFilePreviewEntry({
          id: previewId,
          url: sourceUrl,
          sourceUrl,
          previewUrl: entry?.preview || entry?.thumbnail || entry?.url || "",
          downloadSource: sourceUrl,
          filename:
            entry?.fileName ||
            entry?.name ||
            entry?.originalName ||
            entry?.original_name ||
            `attachment-${index + 1}`,
          displayName:
            entry?.fileName ||
            entry?.name ||
            entry?.originalName ||
            entry?.original_name ||
            `attachment-${index + 1}`,
          originalFileName:
            entry?.originalName ||
            entry?.original_name ||
            entry?.fileName ||
            entry?.name,
          mimeType: entry?.mimeType || mimeType || "",
          size:
            entry?.fileSize ??
            entry?.size ??
            entry?.rawSize ??
            entry?.metadata?.size ??
            null,
          fileSize:
            entry?.fileSize ??
            entry?.size ??
            entry?.rawSize ??
            entry?.metadata?.size ??
            null,
          caption:
            (typeof entry?.caption === "string" && entry.caption.trim()) ||
            (typeof message?.content?.caption === "string" &&
              message.content.caption.trim()) ||
            "",
          createdAt:
            message?.createdAt ??
            message?.metadata?.createdAt ??
            message?.content?.createdAt ??
            null,
          extension: resolveFileExtension(entry),
          invokeAction: (actionKey, payload = {}) =>
            onAction?.(actionKey, {
              ...payload,
              file: entry,
              entryIndex: index,
              messageId: message?.id,
            }),
        });
      }
    );
    return () => {
      cleanups.forEach((cleanup) => cleanup?.());
    };
  }, [
    normalizedFileEntries,
    message?.content?.createdAt,
    message?.createdAt,
    message?.id,
    message?.metadata?.createdAt,
    mimeType,
    onAction,
  ]);

  useEffect(() => {
    if (!overlayOpen) return;
    if (!filePreviewEntries.length) {
      setOverlayOpen(false);
      setActivePreviewId(null);
      return;
    }
    if (
      activePreviewId &&
      !filePreviewEntries.some((entry) => entry.id === activePreviewId)
    ) {
      setActivePreviewId(filePreviewEntries[0]?.id ?? null);
      return;
    }
    if (!activePreviewId) {
      setActivePreviewId(filePreviewEntries[0]?.id ?? null);
    }
  }, [overlayOpen, filePreviewEntries, activePreviewId]);

  const handlePreviewOpen = (entryId) => {
    if (!entryId) return;
    setActivePreviewId(entryId);
    setOverlayOpen(true);
  };

  const handleOverlayClose = () => {
    setOverlayOpen(false);
  };

  return (
    <>
      <Stack spacing={1.25} sx={{ minWidth: 200 }}>
        {normalizedFileEntries.map(({ entry, index, previewId, sourceUrl }) => {
          const entryUploadState = entry?.uploadState?.toLowerCase?.() ?? "";
          const entryQueued =
            entry?.queued ||
            entry?.queuedBySelf ||
            entry?.queuedByViewer ||
            entry?.isQueued ||
            false;
          const entryUploading =
            isMessageUploading &&
            (entryQueued ||
              entryUploadState === "uploading" ||
              !entry?.url ||
              normalizedStatus === "pending" ||
              normalizedStatus === "sending");
          const entryErrored =
            isMessageErrored ||
            ERROR_STATES.has(entryUploadState) ||
            Boolean(entry?.uploadError);
          const resolvedProgress =
            resolveProgressPercent(entry?.uploadProgress ?? entry?.progress) ??
            resolveProgressPercent(
              message?.metadata?.uploadProgress ??
                message?.metadata?.progress ??
                contentUploadProgress
            );
          const entryActions = {
            onRetry: entry?.uploadActions?.onRetry ?? metadataActions.onRetry,
            onCancel: entry?.uploadActions?.onCancel ?? metadataActions.onCancel,
          };
          const canRetry =
            entryErrored &&
            (typeof entryActions.onRetry === "function" || typeof onAction === "function");
          const canCancel =
            entryUploading &&
            (typeof entryActions.onCancel === "function" || typeof onAction === "function");
          const canPreviewAttachment =
            Boolean(sourceUrl) && !entryUploading && !entryErrored;

          let thumbnailSlot = null;
          if (entryUploading) {
            const hasProgress = typeof resolvedProgress === "number";
        const progressLabel = hasProgress
          ? `${Math.round(resolvedProgress)}%`
          : "0%";
        thumbnailSlot = (
          <Box
            sx={{
              position: "relative",
              width: 42,
              height: 42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 0.75,
              "&:hover .upload-cancel-btn": {
                opacity: 1,
                visibility: "visible",
              },
              "&:hover .upload-progress-label": {
                opacity: 0,
              },
            }}
          >
              <UploadProgressIndicator
                value={hasProgress ? resolvedProgress : undefined}
                size={36}
                thickness={4.5}
                labelColor={theme.palette.text.primary}
                labelOverride={progressLabel}
                progressSx={{
                  color: theme.palette.primary.main,
                }}
              />
              {canCancel ? (
                <IconButton
                  size="small"
                  className="upload-cancel-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    entryActions.onCancel?.(entry, index, message);
                    dispatchUploadAction("cancel-upload", entry, index);
                  }}
                  sx={{
                    position: "absolute",
                    inset: 0,
                    m: "auto",
                    width: 26,
                    height: 26,
                    bgcolor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    opacity: 0,
                    visibility: "hidden",
                  }}
                >
                  <PiXBold size={12} />
                </IconButton>
              ) : null}
            </Box>
          );
        } else if (entryErrored) {
          thumbnailSlot = (
            <Tooltip title={canRetry ? "Retry upload" : "Upload failed"}>
              <span>
                <IconButton
                  size="small"
                  disabled={!canRetry}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!canRetry) return;
                    entryActions.onRetry?.(entry, index, message);
                    dispatchUploadAction("retry-upload", entry, index);
                  }}
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    color: theme.palette.error.main,
                  }}
                >
                  <PiArrowCounterClockwiseBold size={28} />
                </IconButton>
              </span>
            </Tooltip>
          );
        }
        const showDownload =
          !hideInlineActions &&
          Boolean(entry?.url) &&
          !entryUploading &&
          !entryErrored;
        return (
          <FileAttachmentTile
            key={previewId || `${entry.fileName}-${index}`}
            file={entry}
            previewUrl={entry.thumbnail}
            fullWidth
            thumbnailSlot={thumbnailSlot}
            onClick={
              canPreviewAttachment
                ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handlePreviewOpen(previewId);
                  }
                : undefined
            }
            inlineAction={
              showDownload ? (
                <IconButton
                  size="small"
                  component="a"
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={entry.fileName || undefined}
                  onClick={(event) => event.stopPropagation()}
                  sx={{
                    width: 24,
                    height: 24,
                    color: isOutgoing
                      ? theme.palette.text.primary
                      : theme.palette.primary.main,
                  }}
                >
                  <PiDownloadSimple size={14} />
                </IconButton>
              ) : null
            }
            sx={{
              backgroundColor: theme.palette.background.default,
              boxShadow: "none",
            }}
          />
        );
        })}
      </Stack>
      <FilePreviewOverlay
        open={overlayOpen}
        entries={filePreviewEntries}
        activeId={activePreviewId ?? null}
        onSelect={(nextId) => setActivePreviewId(nextId)}
        onClose={handleOverlayClose}
      />
    </>
  );
};

export default FileMsg;
