import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { PiPlus, PiX, PiSparkle, PiArrowsLeftRight, PiCheck } from "react-icons/pi";
import FileAttachmentTile from "./files/FileAttachmentTile.jsx";
import { removeImageBackground, convertImageFormat } from "../../utils/imageProcessor";

// Output formats offered in the per-image "Convert" menu. JPEG / WebP get
// quality 0.85 (sweet spot of size vs visual fidelity). PNG stays lossless.
const FORMAT_OPTIONS = [
  { mime: "image/png",  label: "PNG",  hint: "Lossless · keeps transparency" },
  { mime: "image/jpeg", label: "JPG",  hint: "Smallest · no transparency" },
  { mime: "image/webp", label: "WebP", hint: "Best balance · transparency" },
];

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
  // Track which attachment is mid-format-convert (separate so the
  // overlay says "Converting…" instead of "Removing BG…").
  const [convertingId, setConvertingId] = useState(null);
  // anchorEl + targetId for the "Convert to …" menu, keyed per attachment.
  const [convertMenu, setConvertMenu] = useState({ anchorEl: null, id: null });

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

  const handleConvert = async (id, targetMime) => {
    setConvertMenu({ anchorEl: null, id: null });
    if (!id || convertingId) return;
    const file = getAttachmentFile?.(id);
    if (!file) return;
    if ((file.type || "").toLowerCase() === targetMime) {
      showSnackbar?.("Already in that format", "info");
      return;
    }
    setConvertingId(id);
    try {
      const out = await convertImageFormat(file, targetMime, 0.85);
      if (out && out !== file) onReplaceFile?.(id, out);
      const ext = targetMime.split("/")[1].toUpperCase();
      showSnackbar?.(`Converted to ${ext}`, "success");
    } catch (err) {
      showSnackbar?.(err?.message || "Conversion failed", "error");
    } finally {
      setConvertingId(null);
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
          // Animated GIFs would lose animation if re-encoded — skip both
          // BG removal and format conversion; the user is probably sharing
          // the gif on purpose.
          const isProcessable = isImage && item.mime !== "image/gif" && Boolean(onReplaceFile);
          const canRemoveBg = isProcessable;
          const canConvert = isProcessable;
          const isRemovingBg = bgRemovingId === item.id;
          const isConverting = convertingId === item.id;
          const isBusy = isRemovingBg || isConverting;
          const currentMime = String(item.mime || "").toLowerCase();
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
                    {canConvert && (
                      <Tooltip title="Convert format (PNG / JPG / WebP)">
                        <span>
                          <IconButton
                            size="small"
                            disabled={isBusy}
                            onClick={(e) =>
                              setConvertMenu({ anchorEl: e.currentTarget, id: item.id })
                            }
                            sx={{
                              backgroundColor: theme.palette.background.paper,
                              color: "#0891b2",
                              boxShadow: theme.shadows[1],
                            }}
                          >
                            <PiArrowsLeftRight size={10} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
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
                            {isRemovingBg ? (
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
                    {isRemovingBg ? "Removing BG…" : "Converting…"}
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>

      {/* Per-image "Convert to ..." menu — anchored to the icon that opened it. */}
      <Menu
        anchorEl={convertMenu.anchorEl}
        open={Boolean(convertMenu.anchorEl)}
        onClose={() => setConvertMenu({ anchorEl: null, id: null })}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 220 } } }}
      >
        <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.4 }}>
            Convert to
          </Typography>
        </Box>
        {(() => {
          const targetItem = attachments.find((a) => a.id === convertMenu.id);
          const currentMime = String(targetItem?.mime || "").toLowerCase();
          return FORMAT_OPTIONS.map((opt) => {
            const isCurrent = currentMime === opt.mime;
            return (
              <MenuItem
                key={opt.mime}
                onClick={() => handleConvert(convertMenu.id, opt.mime)}
                disabled={isCurrent}
                sx={{ alignItems: "flex-start", py: 1, gap: 1 }}
              >
                <Box sx={{ width: 18, mt: 0.25 }}>
                  {isCurrent ? <PiCheck size={14} color={theme.palette.primary.main} /> : null}
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {opt.label}
                    {isCurrent && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 500 }}>
                        (current)
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {opt.hint}
                  </Typography>
                </Box>
              </MenuItem>
            );
          });
        })()}
      </Menu>
    </Box>
  );
};

export default AttachmentTray;
