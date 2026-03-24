import { Box, IconButton, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { PiPencilSimpleLineDuotone, PiXBold } from "react-icons/pi";

const EditComposerPreview = ({ data, onCancel }) => {
  if (!data) return null;
  const { label = "Editing message", snippet = "" } = data;

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      sx={(theme) => ({
        px: 1.5,
        py: 1,
        borderRadius: 1,
        backgroundColor: alpha(theme.palette.warning.main, 0.08),
        border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
        mb: 1,
      })}
    >
      <Box sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <PiPencilSimpleLineDuotone
            size={13}
            color="currentColor"
            style={{ color: "inherit" }}
          />
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: "warning.main" }}
          >
            {label}
          </Typography>
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 0.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {snippet || "No content available"}
        </Typography>
      </Box>
      <IconButton
        size="small"
        onClick={onCancel}
        sx={{
          mt: -0.5,
          color: "text.secondary",
          "&:hover": { color: "warning.main" },
        }}
      >
        <PiXBold size={14} />
      </IconButton>
    </Stack>
  );
};

export default EditComposerPreview;
