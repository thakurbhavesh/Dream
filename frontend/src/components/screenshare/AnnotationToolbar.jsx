import React from "react";
import {
  Box,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useTheme,
} from "@mui/material";
import {
  PiPencilSimple,
  PiHighlighter,
  PiLineSegment,
  PiRectangle,
  PiEraser,
  PiTrash,
  PiCursor,
  PiX,
} from "react-icons/pi";

const COLORS = [
  "#FF0000",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#FFFFFF",
  "#000000",
];

const TOOLS = [
  { key: "pen", icon: PiPencilSimple, label: "Pen" },
  { key: "highlight", icon: PiHighlighter, label: "Highlighter" },
  { key: "line", icon: PiLineSegment, label: "Line" },
  { key: "rect", icon: PiRectangle, label: "Rectangle" },
  { key: "eraser", icon: PiEraser, label: "Eraser" },
  { key: "pointer", icon: PiCursor, label: "Pointer" },
];

const WIDTHS = [
  { value: 2, label: "Thin" },
  { value: 4, label: "Medium" },
  { value: 8, label: "Thick" },
];

const AnnotationToolbar = ({
  tool,
  color,
  width,
  onToolChange,
  onColorChange,
  onWidthChange,
  onClear,
  onClose,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        bgcolor: "rgba(0,0,0,0.85)",
        borderRadius: 3,
        px: 2,
        py: 1,
        display: "flex",
        alignItems: "center",
        gap: 2,
        zIndex: 3,
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Tools */}
      <ToggleButtonGroup
        value={tool}
        exclusive
        onChange={(_, val) => val && onToolChange(val)}
        size="small"
        sx={{
          "& .MuiToggleButton-root": {
            color: "#aaa",
            borderColor: "rgba(255,255,255,0.15)",
            "&.Mui-selected": {
              color: "#fff",
              bgcolor: theme.palette.primary.main,
            },
          },
        }}
      >
        {TOOLS.map((t) => (
          <ToggleButton key={t.key} value={t.key}>
            <Tooltip title={t.label}>
              <Box sx={{ display: "flex" }}>
                <t.icon size={18} />
              </Box>
            </Tooltip>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Colors */}
      <Stack direction="row" spacing={0.5}>
        {COLORS.map((c) => (
          <Box
            key={c}
            onClick={() => onColorChange(c)}
            sx={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              bgcolor: c,
              border:
                color === c
                  ? "2px solid #fff"
                  : c === "#FFFFFF"
                    ? "1px solid #666"
                    : "2px solid transparent",
              cursor: "pointer",
              transition: "transform 0.1s",
              "&:hover": { transform: "scale(1.2)" },
            }}
          />
        ))}
      </Stack>

      {/* Width */}
      <ToggleButtonGroup
        value={width}
        exclusive
        onChange={(_, val) => val && onWidthChange(val)}
        size="small"
        sx={{
          "& .MuiToggleButton-root": {
            color: "#aaa",
            borderColor: "rgba(255,255,255,0.15)",
            px: 1,
            "&.Mui-selected": {
              color: "#fff",
              bgcolor: "rgba(255,255,255,0.2)",
            },
          },
        }}
      >
        {WIDTHS.map((w) => (
          <ToggleButton key={w.value} value={w.value}>
            <Tooltip title={w.label}>
              <Box
                sx={{
                  width: w.value * 2 + 4,
                  height: w.value * 2 + 4,
                  borderRadius: "50%",
                  bgcolor: "#fff",
                }}
              />
            </Tooltip>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Clear */}
      <Tooltip title="Clear All">
        <IconButton
          sx={{ color: "#fff" }}
          onClick={onClear}
        >
          <PiTrash size={18} />
        </IconButton>
      </Tooltip>

      {/* Close annotation mode */}
      <Tooltip title="Close Annotations">
        <IconButton sx={{ color: "#fff" }} onClick={onClose}>
          <PiX size={18} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default React.memo(AnnotationToolbar);
