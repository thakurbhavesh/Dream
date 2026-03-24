import React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

const clamp = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const UploadProgressIndicator = ({
  value = null,
  size = 40,
  thickness = 4.5,
  showLabel = true,
  containerSx = {},
  progressSx = {},
  labelColor = "text.primary",
  centerContent = null,
  labelOverride = null,
}) => {
  const normalized = clamp(value);
  const determinate = typeof normalized === "number";
  const hasOverride =
    typeof labelOverride === "string" && labelOverride.trim().length > 0;

  return (
    <Box
      sx={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        ...containerSx,
      }}
    >
      <CircularProgress
        variant={determinate ? "determinate" : "indeterminate"}
        value={determinate ? normalized : undefined}
        size={size}
        thickness={thickness}
        color="inherit"
        sx={{
          color: (theme) => theme.palette.primary.main,
          ...progressSx,
        }}
      />
      {centerContent ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {centerContent}
        </Box>
      ) : showLabel && (determinate || hasOverride) ? (
        <Typography
          className="upload-progress-label"
          variant="caption"
          sx={{
            position: "absolute",
            fontWeight: 600,
            color: labelColor,
          }}
        >
          {hasOverride
            ? labelOverride
            : `${Math.round(normalized ?? 0)}%`}
        </Typography>
      ) : null}
    </Box>
  );
};

export default UploadProgressIndicator;
