import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import { PiArrowLeft, PiDownloadSimple, PiX } from "react-icons/pi";
import { BiReset } from "react-icons/bi";

const ORIENTATION_DIMENSIONS = {
  landscape: { width: 1280, height: 720, aspectRatio: 16 / 9 },
  portrait: { width: 720, height: 1280, aspectRatio: 9 / 16 },
};

// Convert elapsed seconds into mm:ss for the recording banner.
const formatElapsed = (seconds) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

// Build a File object from a Blob so uploads feel natural.
const createFileFromBlob = (blob, type) => {
  try {
    return new File([blob], `${type}-recording-${Date.now()}.webm`, {
      type: blob.type,
    });
  } catch {
    return null;
  }
};

// VideoRecorderModal handles full camera recording workflow.
const VideoRecorderModal = ({
  open,
  onClose,
  onSubmit,
  showSnackbar = () => {},
}) => {
  const theme = useTheme();
  const recorderBackground =
    theme.palette.mode === "dark"
      ? theme.palette.grey[900]
      : theme.palette.grey[800];
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const timerRef = useRef(null);
  const chunksRef = useRef([]);

  const [availableCameras, setAvailableCameras] = useState([]);
  const [availableMicrophones, setAvailableMicrophones] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMicrophone, setSelectedMicrophone] = useState("");
  const [orientation, setOrientation] = useState("landscape");
  const [status, setStatus] = useState("idle"); // idle | recording | preview
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  // Dispose of URLs and blobs created for the preview clip.
  const cleanupPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewFile(null);
  }, [previewUrl]);

  // Stop the elapsed timer interval and optionally reset the count.
  const resetTimer = useCallback((resetValue = true) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (resetValue) {
      setElapsed(0);
    }
  }, []);

  // Stop all media tracks and detach the preview video element.
  const stopStream = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore
      }
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);

  // Reset every recorder resource back to the idle state.
  const resetRecorder = useCallback(() => {
    cleanupPreview();
    stopStream();
    resetTimer();
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setStatus("idle");
  }, [cleanupPreview, resetTimer, stopStream]);

  // When modal closes, make sure everything is reset.
  useEffect(() => {
    if (!open) {
      resetRecorder();
    }
  }, [open, resetRecorder]);

  // Discover available cameras/microphones so the user can pick inputs.
  const enumerateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      const microphones = devices.filter(
        (device) => device.kind === "audioinput"
      );
      setAvailableCameras(cameras);
      setAvailableMicrophones(microphones);
      setSelectedCamera((prev) => {
        if (prev && cameras.some((camera) => camera.deviceId === prev)) {
          return prev;
        }
        return cameras[0]?.deviceId || "";
      });
      setSelectedMicrophone((prev) => {
        if (prev && microphones.some((mic) => mic.deviceId === prev)) {
          return prev;
        }
        return microphones[0]?.deviceId || "";
      });
    } catch (error) {
      console.warn("Failed to enumerate devices", error);
    }
  }, []);

  // Refresh device lists whenever the modal opens.
  useEffect(() => {
    if (open) {
      enumerateDevices();
    }
  }, [open, enumerateDevices]);

  // Called when MediaRecorder stops so we can build the preview blob/file.
  const handleRecorderStop = useCallback(
    (recorder) => {
      resetTimer(false);
      stopStream();
      const chunks = chunksRef.current;
      if (!chunks.length) return;
      const mimeType =
        recorder?.mimeType || "video/webm;codecs=vp9,opus" || "video/webm";
      const blob = new Blob(chunks, { type: mimeType });
      const file = createFileFromBlob(blob, "video");
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewFile(file);
      setPreviewUrl(url);
      setStatus("preview");
    },
    [resetTimer, stopStream]
  );

  // Kick off getUserMedia and MediaRecorder with the selected devices.
  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showSnackbar(
        "Media recording is not supported on this browser.",
        "error"
      );
      return;
    }
    if (!selectedCamera) {
      showSnackbar("No camera detected. Connect a camera to record.", "error");
      return;
    }
    if (!selectedMicrophone) {
      showSnackbar(
        "No microphone detected. Connect a microphone to record.",
        "error"
      );
      return;
    }
    cleanupPreview();
    try {
      const dimensions = ORIENTATION_DIMENSIONS[orientation];
      const constraints = {
        audio: { deviceId: { exact: selectedMicrophone } },
        video: {
          deviceId: { exact: selectedCamera },
          width: { ideal: dimensions.width },
          height: { ideal: dimensions.height },
          facingMode: "user",
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (error) {
          console.warn("Video preview play failed", error);
        }
      }

      let recorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp9,opus",
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => handleRecorderStop(recorder);
      recorder.start();
      setStatus("recording");
      resetTimer();
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Video recording error", error);
      const notFound =
        error?.name === "NotFoundError" ||
        error?.name === "DevicesNotFoundError";
      showSnackbar(
        notFound
          ? "No camera or microphone detected. Please connect a device and try again."
          : "Unable to start video recording.",
        "error"
      );
      resetRecorder();
    }
  }, [
    cleanupPreview,
    handleRecorderStop,
    orientation,
    resetRecorder,
    resetTimer,
    selectedCamera,
    selectedMicrophone,
    showSnackbar,
  ]);

  // Stop the recorder if it is currently capturing frames.
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  // Back to idle state so the user can capture a new take.
  const handleRecordAgain = useCallback(() => {
    resetRecorder();
  }, [resetRecorder]);

  // Download the preview clip directly to disk.
  const handleDownload = useCallback(() => {
    if (!previewBlob || !previewUrl) return;
    const link = document.createElement("a");
    link.href = previewUrl;
    link.download = previewFile?.name || "video-recording.webm";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [previewBlob, previewFile, previewUrl]);

  // Hand the recorded payload back to the footer so it can send/upload.
  const handleSubmit = useCallback(() => {
    if (!previewBlob) {
      showSnackbar("Please record a video first.", "warning");
      return;
    }
    const payload = {
      type: "video",
      blob: previewBlob,
      file: previewFile || createFileFromBlob(previewBlob, "video"),
      url: previewUrl,
      duration: elapsed,
      mimeType: previewBlob.type,
    };
    onSubmit(payload);
    resetRecorder();
    onClose();
  }, [
    elapsed,
    onClose,
    onSubmit,
    previewBlob,
    previewFile,
    previewUrl,
    resetRecorder,
    showSnackbar,
  ]);

  const isRecording = status === "recording";
  const isPreviewing = status === "preview";

  // Keep video containers sized correctly for portrait/landscape toggles.
  const videoContainerStyles = useMemo(() => {
    const dimensions = ORIENTATION_DIMENSIONS[orientation];
    return {
      width: "100%",
      aspectRatio: dimensions.aspectRatio,
      overflow: "hidden",
      backgroundColor: recorderBackground,
      position: "relative",
    };
  }, [orientation, recorderBackground]);

  // Camera preview shown while recording.
  const renderLiveView = () => (
    <Box sx={{ ...videoContainerStyles }} key={`live-${orientation}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: "scaleX(-1)",
        }}
      />
      {/* Idle overlay gives the user basic instructions */}
      {status === "idle" ? (
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            position: "absolute",
            inset: 0,
            color: theme.palette.common.white,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)",
          }}
        >
          <Typography variant="h6">Ready to record</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Select camera & microphone, then start recording.
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );

  // Render the recorded clip + controls when previewing.
  const renderPreview = () => (
    <Box sx={{ ...videoContainerStyles }} key={previewUrl || "preview"}>
      <video
        controls
        src={previewUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        onCanPlay={(event) => {
          try {
            event.currentTarget.play().catch(() => {});
          } catch {
            // ignore autoplay errors
          }
        }}
      />
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={() => {
        resetRecorder();
        onClose();
      }}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 1, overflow: "hidden" },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          pr: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            size="small"
            onClick={() => {
              if (isRecording) {
                stopRecording();
              }
              resetRecorder();
              onClose();
            }}
          >
            <PiArrowLeft />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={600}>
            Record Video
          </Typography>
        </Stack>
        <IconButton
          size="small"
          onClick={() => {
            if (isRecording) {
              stopRecording();
            }
            resetRecorder();
            onClose();
          }}
        >
          <PiX />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, px: 0 }}
      >
        <Stack direction="column" alignItems="center" spacing={1}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={orientation}
            onChange={(_, value) => {
              if (value) setOrientation(value);
            }}
          >
            <ToggleButton value="landscape">Landscape [16:9]</ToggleButton>
            <ToggleButton value="portrait">Portrait [9:16]</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {/* Swap between live camera feed and recorded preview */}
        {isPreviewing ? renderPreview() : renderLiveView()}

        {/* While recording/live, expose device pickers and CTA */}
        {!isPreviewing && (
          <>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems="center"
              mt={2}
              mx={2}
            >
              {/* Show warning when no cameras are present */}
              {!availableCameras.length ? (
                <Typography
                  variant="caption"
                  color="error.main"
                  textAlign="center"
                  sx={{
                    mx: 2,
                    p: 1,
                    borderRadius: 1,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                  flex={1 / 2}
                >
                  No camera detected
                </Typography>
              ) : (
                <FormControl fullWidth size="small" style={{ flex: 1 / 2 }}>
                  <InputLabel id="camera-select-label">Camera</InputLabel>
                  <Select
                    labelId="camera-select-label"
                    label="Camera"
                    value={selectedCamera}
                    onChange={(event) => setSelectedCamera(event.target.value)}
                    displayEmpty
                  >
                    {availableCameras.map((camera) => (
                      <MenuItem key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${camera.deviceId.slice(-4)}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {/* Show warning when no microphones are present */}
              {!availableMicrophones.length ? (
                <Typography
                  variant="caption"
                  color="error.main"
                  textAlign="center"
                  sx={{
                    mx: 2,
                    p: 1,
                    borderRadius: 1,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                  flex={1 / 2}
                >
                  No microphone detected
                </Typography>
              ) : (
                <FormControl fullWidth size="small" style={{ flex: 1 / 2 }}>
                  <InputLabel id="mic-select-label">Microphone</InputLabel>
                  <Select
                    labelId="mic-select-label"
                    label="Microphone"
                    value={selectedMicrophone}
                    onChange={(event) =>
                      setSelectedMicrophone(event.target.value)
                    }
                    displayEmpty
                  >
                    {availableMicrophones.map((mic) => (
                      <MenuItem key={mic.deviceId} value={mic.deviceId}>
                        {mic.label || `Mic ${mic.deviceId.slice(-4)}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </>
        )}

        {/* Footer actions change with recording/preview/idle states */}
        {isRecording ? (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              p: 1,
              mx: 2,
              bgcolor: theme.palette.action.hover,
            }}
          >
            <Stack>
              <Typography variant="caption" color="text.secondary">
                Recording...
              </Typography>
              <Typography variant="h6" fontWeight={700}>
                {formatElapsed(elapsed)}
              </Typography>
            </Stack>
            <Button
              color="error"
              variant="contained"
              onClick={stopRecording}
              sx={{ borderRadius: 0.5 }}
            >
              Stop
            </Button>
          </Stack>
        ) : isPreviewing ? (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            mx={2}
          >
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={handleRecordAgain}
                startIcon={<BiReset />}
              >
                Record again
              </Button>
              <Button variant="outlined" onClick={handleDownload}>
                <PiDownloadSimple size={25} />
              </Button>
            </Stack>
            <Button variant="contained" onClick={handleSubmit}>
              Submit
            </Button>
          </Stack>
        ) : (
          <Button
            variant="contained"
            onClick={startRecording}
            disabled={!selectedCamera || !selectedMicrophone}
            sx={{ alignSelf: "flex-start", borderRadius: 0.5, mx: "auto" }}
          >
            Start recording
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

VideoRecorderModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  showSnackbar: PropTypes.func,
};

export default VideoRecorderModal;
