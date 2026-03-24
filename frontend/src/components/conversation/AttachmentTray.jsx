import React, { useEffect, useMemo } from "react";
import { Box, IconButton, Stack, useTheme } from "@mui/material";
import { PiPlus, PiX } from "react-icons/pi";
import FileAttachmentTile from "./files/FileAttachmentTile.jsx";

// AttachmentTray lists all files queued for the current message.
const AttachmentTray = ({
  attachments = [],
  onAddMore,
  onRemove,
  getAttachmentFile,
}) => {
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
        {attachments.map((item) => (
          <FileAttachmentTile
            key={item.id}
            file={{
              fileName: item.name,
              mimeType: item.mime,
              size: item.size,
              typeLabel: item.typeLabel,
              preview: item.preview,
            }}
            previewUrl={previewMap.get(item.id)}
            overlayAction={
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
            }
          />
        ))}
      </Stack>
    </Box>
  );
};

export default AttachmentTray;
