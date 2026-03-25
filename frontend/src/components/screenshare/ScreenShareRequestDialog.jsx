import React, { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { PiMonitor } from "react-icons/pi";
import { useScreenShareContext } from "../../contexts/ScreenShareContext.jsx";

const AUTO_DISMISS_MS = 30_000;

const ScreenShareRequestDialog = () => {
  const theme = useTheme();
  const { status, peerUserName, acceptScreenShare, rejectScreenShare } =
    useScreenShareContext();

  const open = status === "incoming";
  const timerRef = useRef(null);
  const [progress, setProgress] = useState(100);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!open) {
      setProgress(100);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        rejectScreenShare();
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, rejectScreenShare]);

  // Play notification sound
  useEffect(() => {
    if (!open) return;
    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={rejectScreenShare}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
        },
      }}
    >
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 3,
          "& .MuiLinearProgress-bar": {
            backgroundColor: theme.palette.primary.main,
          },
        }}
      />
      <DialogContent sx={{ textAlign: "center", pt: 4, pb: 2 }}>
        <Stack spacing={2} alignItems="center">
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: theme.palette.primary.main,
              color: "#fff",
              fontSize: 28,
            }}
          >
            <PiMonitor />
          </Avatar>
          <Typography variant="h6" fontWeight={600}>
            Screen Share Request
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>{peerUserName || "Someone"}</strong> wants to share their
            screen with you
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 3, gap: 2 }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={rejectScreenShare}
          sx={{ minWidth: 110 }}
        >
          Decline
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={acceptScreenShare}
          sx={{ minWidth: 110 }}
        >
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScreenShareRequestDialog;
