import { memo } from "react";
// @mui
import { useTheme } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";

// ----------------------------------------------------------------------

function NoChat({ ...other }) {
  const theme = useTheme();



  return (
    <Box {...other} display="flex" justifyContent="center" alignItems="center" flexDirection="column">
      <img
        src="nochat.gif"
        alt="No Messages"
        style={{ width: "150px", marginBottom: "16px",}}
      />
      <Typography variant="body1" color={theme.palette.mode === "light" ? "inherit" : "#ddd"}>No Messages here Yet...</Typography>
      <Typography variant="body1" color={theme.palette.mode === "light" ? "inherit" : "#ddd"}>Type something below... </Typography>
    </Box>
  );
}

export default memo(NoChat);
