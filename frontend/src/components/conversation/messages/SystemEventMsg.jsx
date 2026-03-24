import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { formatSystemEventLabel } from "./helpers.js";

const SystemEventMsg = ({ message }) => {
  const theme = useTheme();
  const label = formatSystemEventLabel(message);
  if (!label) return null;

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Typography
        variant="caption"
        sx={{
          px: 1.5,
          py: 0.5,
          borderRadius: 999,
          backgroundColor:
            theme.palette.mode === "light"
              ? alpha(theme.palette.text.primary, 0.6)
              : alpha(theme.palette.text.primary, 0.12),
          color: theme.palette.common.white,
          textAlign: "center",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

export default SystemEventMsg;
