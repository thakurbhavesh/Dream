import React, { useMemo } from "react";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import { FileIcon } from "react-file-icon";
import {
  buildFileIconProps,
  buildIconStyleMap,
  getFileDetailLabel,
  resolveFileExtension,
} from "./filePreviewUtils.js";

const FileAttachmentTile = ({
  file,
  previewUrl,
  inlineAction = null,
  overlayAction = null,
  variant = "default",
  fullWidth = false,
  thumbnailSlot = null,
  onClick = null,
  sx = {},
}) => {
  const theme = useTheme();
  if (!file) return null;
  const iconStyles = useMemo(() => buildIconStyleMap(theme), [theme]);
  const extension = resolveFileExtension(file);
  const iconProps = useMemo(
    () => buildFileIconProps(extension, theme, iconStyles),
    [extension, theme, iconStyles]
  );
  const name =
    file.fileName ||
    file.name ||
    file.originalName ||
    file.original_name ||
    "attachment";
  const detailLabel = getFileDetailLabel(file);
  const thumbnail =
    previewUrl ||
    file.thumbnail ||
    (file.mimeType?.startsWith?.("image/") ? file.url : "") ||
    "";
  const hasVisual = Boolean(thumbnailSlot || thumbnail);
  const baseBoxShadow =
    theme.customShadows?.z8 || theme.shadows?.[2] || "0 2px 6px rgba(0,0,0,0.08)";
  const sizePreset =
    variant === "compact"
      ? { minWidth: 250, maxWidth: 300, py: 0.75 }
      : { minWidth: 250, maxWidth: 300, py: 1 };
  const widthStyles = fullWidth
    ? { width: "100%", minWidth: 250, maxWidth: 300 }
    : sizePreset;
  const interactive = typeof onClick === "function";
  const handleKeyDown = (event) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.(event);
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 1,
        padding: 0.5,
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.default,
        boxShadow: baseBoxShadow,
        cursor: interactive ? "pointer" : "default",
        userSelect: interactive ? "none" : undefined,
        ...widthStyles,
        ...sx,
      }}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      {overlayAction ? (
        <Box
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            display: "inline-flex",
            zIndex: 2,
          }}
        >
          {overlayAction}
        </Box>
      ) : null}
      <Box
        sx={{
          width: hasVisual ? 48 : 34,
          height: 42,
          borderRadius: 0.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {thumbnailSlot ? (
          thumbnailSlot
        ) : thumbnail ? (
          <Box
            component="img"
            src={thumbnail}
            alt={name}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 0.5,
            }}
          />
        ) : (
          <FileIcon
            extension={extension?.toLowerCase() || "File"}
            {...iconProps}
            radius={4}
            labelUppercase
            labelText={(extension || "ext").toUpperCase()}
          />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            color: theme.palette.text.primary,
            fontWeight: 500,
          }}
        >
          {name}
        </Typography>
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {detailLabel}
          </Typography>
          {inlineAction ? (
            <Box sx={{ display: "inline-flex" }}>{inlineAction}</Box>
          ) : null}
        </Stack>
      </Box>
    </Box>
  );
};

export default FileAttachmentTile;
