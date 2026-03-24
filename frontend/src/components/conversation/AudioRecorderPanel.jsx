import React from "react";
import PropTypes from "prop-types";
import { Box, IconButton, Stack, Typography, useTheme } from "@mui/material";

// AudioRecorderPanel shows live recording controls or pending audio preview.
const AudioRecorderPanel = ({
  isRecording,
  recordingState,
  recordingDuration,
  formatRecordingTime,
  onStop,
  onPauseResume,
  onCancel,
  pendingRecording = null,
  discardPendingRecording,
}) => {
  const theme = useTheme();

  // Nothing to display when neither actively recording nor holding a draft.
  if (!isRecording && (!pendingRecording || pendingRecording.type !== "audio")) {
    return null;
  }

  return (
    <>
      {/* Floating controls appear only while audio is recording */}
      {isRecording ? (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 1,
            zIndex: 2,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <IconButton
              disableRipple
              size="small"
              onClick={onStop}
              sx={{
                width: 34,
                height: 34,
                backgroundColor: theme.palette.warning.main,
                color: theme.palette.warning.contrastText,
                "&:hover": {
                  backgroundColor: theme.palette.warning.main,
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  width: 12,
                  height: 12,
                  borderRadius: 0.5,
                  backgroundColor: theme.palette.warning.contrastText,
                }}
              />
            </IconButton>
            <Stack spacing={0}>
              <Typography variant="caption" color="text.secondary">
                Recording audio
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 700 }}
                color="text.primary"
              >
                {formatRecordingTime(recordingDuration)}
              </Typography>
            </Stack>
            <IconButton
              disableRipple
              size="small"
              onClick={onPauseResume}
              sx={{
                width: 34,
                height: 34,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
            >
              {recordingState === "paused" ? (
                <Box
                  component="span"
                  sx={{
                    width: 0,
                    height: 0,
                    borderTop: "6px solid transparent",
                    borderBottom: "6px solid transparent",
                    borderLeft: `10px solid ${theme.palette.text.primary}`,
                  }}
                />
              ) : (
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    gap: "3px",
                  }}
                >
                  <Box
                    sx={{
                      width: 3,
                      height: 12,
                      backgroundColor: theme.palette.text.primary,
                    }}
                  />
                  <Box
                    sx={{
                      width: 3,
                      height: 12,
                      backgroundColor: theme.palette.text.primary,
                    }}
                  />
                </Box>
              )}
            </IconButton>
          </Stack>
          <IconButton
            disableRipple
            size="small"
            onClick={onCancel}
            sx={{
              width: 34,
              height: 34,
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            }}
          >
            <Box component="span" sx={{ fontWeight: 700 }}>
              X
            </Box>
          </IconButton>
        </Box>
      ) : null}

      {/* Once recording stops, show the pending clip preview */}
      {pendingRecording?.type === "audio" ? (
        <Box sx={{ px: 2, pt: 1 }}>
          <Stack direction="row" alignItems="center" spacing={4}>
            <Box sx={{ flexGrow: 1 }}>
              <audio controls src={pendingRecording.url} />
            </Box>
            <Stack spacing={0.5} sx={{ minWidth: 110 }}>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                Audio recording
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatRecordingTime(pendingRecording.duration || 0)}
              </Typography>
            </Stack>
            <IconButton
              disableRipple
              size="small"
              onClick={discardPendingRecording}
              sx={{
                width: 32,
                height: 32,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box component="span" sx={{ fontWeight: 700 }}>
                X
              </Box>
            </IconButton>
          </Stack>
        </Box>
      ) : null}
    </>
  );
};

AudioRecorderPanel.propTypes = {
  isRecording: PropTypes.bool.isRequired,
  recordingState: PropTypes.string.isRequired,
  recordingDuration: PropTypes.number.isRequired,
  formatRecordingTime: PropTypes.func.isRequired,
  onStop: PropTypes.func.isRequired,
  onPauseResume: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  pendingRecording: PropTypes.shape({
    type: PropTypes.string,
    url: PropTypes.string,
    duration: PropTypes.number,
  }),
  discardPendingRecording: PropTypes.func.isRequired,
};

export default AudioRecorderPanel;
