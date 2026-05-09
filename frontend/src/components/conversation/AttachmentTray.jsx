import React, { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import { PiPlus, PiX, PiSparkle } from "react-icons/pi";
import FileAttachmentTile from "./files/FileAttachmentTile.jsx";
import { removeImageBackground } from "../../utils/imageProcessor";

// AttachmentTray lists all files queued for the current message.
const AttachmentTray = ({
  attachments = [],
  onAddMore,
  onRemove,
  onReplaceFile,
  getAttachmentFile,
  showSnackbar,
}) => {
  // Track which attachment is mid-bg-removal so we can spin its overlay.
  const [bgRemovingId, setBgRemovingId] = useState(null);
  const handleRemoveBackground = async (id) => {
    if (!id || bgRemovingId) return;
    const file = getAttachmentFile?.(id);
    if (!file) return;
    setBgRemovingId(id);
    try {
      const out = await removeImageBackground(file);
      if (out && out !== file) onReplaceFile?.(id, out);
      showSnackbar?.("Background removed", "success");
    } catch (err) {
      showSnackbar?.(err?.message || "Background removal failed", "error");
    } finally {
      setBgRemovingId(null);
    }
  };
  const theme = useTheme();

  // Build preview URLs for any image attachments so we can show thumbnails.
  const imagePreviews = useMemo(() => {
    return attachments
      .map((item) => {
        if (!item?.mime?.startsWith?.("image/")) return null;
        const file = getAttachmentFile?.(item.id);
        if (!file) return null;
        return {
          id: item.id,
          url: URL.createObjectURL(file),
        };
      })
      .filter(Boolean);
  }, [attachments, getAttachmentFile]);

  // Clean up preview URLs whenever the attachment set changes.
  useEffect(() => {
    return () => {
      imagePreviews.forEach((preview) => {
        try {
          URL.revokeObjectURL(preview.url);
        } catch {
          /* ignore */
        }
      });
    };
  }, [imagePreviews]);

  // Merge our color overrides with the default file-icon palette.
  const previewMap = useMemo(() => {
    const map = new Map();
    imagePreviews.forEach((preview) => {
      map.set(preview.id, preview.url);
    });
    return map;
  }, [imagePreviews]);

  // Hide the tray entirely when no files are attached.
  if (!attachments.length) return null;

  return (
    <Box sx={{ px: 1, pb: 1 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        <Box
          role="button"
          tabIndex={0}
          onClick={onAddMore}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onAddMore?.();
            }
          }}
          sx={{
            minWidth: 40,
            height: 40,
            borderRadius: 999,
            border: `1px dashed ${theme.palette.primary.light}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.palette.secondary.light,
            cursor: "pointer",
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <PiPlus size={18} />
        </Box>
        {attachments.map((item) => {
          const isImage = item?.mime?.startsWith?.("image/");
          // Animated GIFs would lose animation if re-encoded — skip BG removal
          // for them since the result is a flat PNG anyway and the user is
          // probably sharing the gif on purpose.
          const canRemoveBg = isImage && item.mime !== "image/gif" && Boolean(onReplaceFile);
          const isBusy = bgRemovingId === item.id;
          return (
            <Box key={item.id} sx={{ position: "relative" }}>
              <FileAttachmentTile
                file={{
                  fileName: item.name,
                  mimeType: item.mime,
                  size: item.size,
                  typeLabel: item.typeLabel,
                  preview: item.preview,
                }}
                previewUrl={previewMap.get(item.id)}
                overlayAction={
                  <Stack direction="row" spacing={0.5}>
                    {canRemoveBg && (
                      <Tooltip title="Remove background (AI)">
                        <span>
                          <IconButton
                            size="small"
                            disabled={isBusy}
                            onClick={() => handleRemoveBackground(item.id)}
                            sx={{
                              backgroundColor: theme.palette.background.paper,
                              color: theme.palette.primary.main,
                              boxShadow: theme.shadows[1],
                            }}
                          >
                            {isBusy ? (
                              <CircularProgress size={10} thickness={6} />
                            ) : (
                              <PiSparkle size={10} />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => onRemove?.(item.id)}
                      sx={{
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.secondary,
                        boxShadow: theme.shadows[1],
                      }}
                    >
                      <PiX size={10} />
                    </IconButton>
                  </Stack>
                }
              />
              {isBusy && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 1,
                    bgcolor: "rgba(15, 23, 42, 0.55)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 0.5,
                    pointerEvents: "none",
                  }}
                >
                  <CircularProgress size={20} sx={{ color: "#fff" }} />
                  <Typography variant="caption" sx={{ color: "#fff", fontWeight: 600 }}>
                    Removing BG…
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};

export default AttachmentTray;
