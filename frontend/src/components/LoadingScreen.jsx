// LoadingScreen.js
import React from "react";
import PuffLoader from "react-spinners/PuffLoader";
import { Box, useTheme } from "@mui/material";

const LoadingScreen = ({ overlayOpacity = 0.82 }) => {
  const theme = useTheme();
  const backdrop =
    theme.palette.mode === "dark"
      ? `rgba(2, 6, 23, ${overlayOpacity})`
      : `rgba(255, 255, 255, ${overlayOpacity})`;
  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: backdrop,
        backdropFilter: "blur(2px)",
        zIndex: 1600,
      }}
    >
      <PuffLoader color={theme.palette.primary.main} size={96} />
    </Box>
  );
};

export default LoadingScreen;
