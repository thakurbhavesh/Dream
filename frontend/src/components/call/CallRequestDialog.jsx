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
import { PiPhone, PiVideoCamera } from "react-icons/pi";
import { useCallContext } from "../../contexts/CallContext.jsx";
import { startIncomingRingtone, stopIncomingRingtone } from "../../utils/callSounds.js";

const AUTO_DISMISS_MS = 30_000;

const CallRequestDialog = () => {
  const theme = useTheme();
  const { status, callType, peerUserName, acceptCall, rejectCall } =
    useCallContext();

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
        rejectCall();
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, rejectCall]);

  // Play incoming call ringtone
  useEffect(() => {
    if (open) {
      startIncomingRingtone();
    } else {
      stopIncomingRingtone();
    }
    return () => stopIncomingRingtone();
  }, [open]);

  const isVideo = callType === "video";
  const Icon = isVideo ? PiVideoCamera : PiPhone;

  return (
    <Dialog
      open={open}
      onClose={rejectCall}
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
            backgroundColor: isVideo
              ? theme.palette.info.main
              : theme.palette.success.main,
          },
        }}
      />
      <DialogContent sx={{ textAlign: "center", pt: 4, pb: 2 }}>
        <Stack spacing={2} alignItems="center">
          <Avatar
            sx={{
              width: 72,
              height: 72,
              bgcolor: isVideo
                ? theme.palette.info.main
                : theme.palette.success.main,
              color: "#fff",
              fontSize: 32,
              animation: "pulse 1.5s ease-in-out infinite",
              "@keyframes pulse": {
                "0%": { boxShadow: `0 0 0 0 ${isVideo ? "rgba(33,150,243,0.4)" : "rgba(76,175,80,0.4)"}` },
                "70%": { boxShadow: `0 0 0 16px ${isVideo ? "rgba(33,150,243,0)" : "rgba(76,175,80,0)"}` },
                "100%": { boxShadow: `0 0 0 0 ${isVideo ? "rgba(33,150,243,0)" : "rgba(76,175,80,0)"}` },
              },
            }}
          >
            <Icon />
          </Avatar>
          <Typography variant="h6" fontWeight={600}>
            Incoming {isVideo ? "Video" : "Audio"} Call
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>{peerUserName || "Someone"}</strong> is calling you
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 3, gap: 2 }}>
        <Button
          variant="contained"
          color="error"
          onClick={rejectCall}
          sx={{ minWidth: 110, borderRadius: 6 }}
        >
          Decline
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={acceptCall}
          sx={{ minWidth: 110, borderRadius: 6 }}
        >
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CallRequestDialog;
