import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import { alpha, lighten } from "@mui/material/styles";
import { useEffect, useRef, useState } from "react";
import {
  PiArrowSquareOutBold,
  PiCopySimpleBold,
  PiPauseFill,
  PiPlayFill,
  PiTextAaBold,
} from "react-icons/pi";
import { transcribeAudio } from "../../../services/chatApi.js";

const formatDuration = (value = 0) => {
  if (!Number.isFinite(value)) return "00:00";
  const totalSeconds = Math.max(0, Math.round(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 ? String(hours).padStart(2, "0") : null,
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].filter(Boolean);
  return parts.join(":");
};

const resolveAudioSource = (message) => {
  const candidates = [];
  if (message?.content?.url) candidates.push(message.content.url);
  if (Array.isArray(message?.content?.files)) {
    message.content.files.forEach((file) => {
      if (!file) return;
      candidates.push(
        file.url ||
          file.file_url ||
          file.previewUrl ||
          file.preview_url ||
          file.path,
      );
    });
  }
  if (Array.isArray(message?.files)) {
    message.files.forEach((file) => {
      if (!file) return;
      candidates.push(file.url || file.file_url || file.path);
    });
  }
  if (message?.content?.audioUrl) {
    candidates.push(message.content.audioUrl);
  }
  return candidates.find((item) => typeof item === "string" && item.trim());
};

const resolveDuration = (message) => {
  const content = message?.content ?? {};
  return (
    content.duration ??
    content.length ??
    content.lengthSeconds ??
    message?.metadata?.duration ??
    message?.metadata?.length ??
    message?.metadata?.lengthSeconds ??
    null
  );
};

const AudioMsg = ({ message }) => {
  const theme = useTheme();
  const audioUrl = resolveAudioSource(message);
  const initialDuration = resolveDuration(message);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(
    Number.isFinite(initialDuration) ? initialDuration : null,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState(null);
  const [transcriptError, setTranscriptError] = useState(null);
  const trackRef = useRef(null);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(Number.isFinite(initialDuration) ? initialDuration : null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [audioUrl, initialDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleLoaded = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration((prev) =>
          Number.isFinite(prev) ? prev : audio.duration,
        );
      }
    };
    const handleTime = () => {
      if (!seeking) {
        setCurrentTime(audio.currentTime || 0);
      }
    };
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoaded);
    audio.addEventListener("timeupdate", handleTime);
    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoaded);
      audio.removeEventListener("timeupdate", handleTime);
    };
  }, [audioUrl]);

  if (!audioUrl) return null;

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const progress =
    duration && Number.isFinite(duration) && duration > 0
      ? Math.min(currentTime / duration, 1)
      : 0;
  const displayLabel = isPlaying
    ? formatDuration(currentTime)
    : formatDuration(duration ?? currentTime);

  const innerSurface = alpha(
    theme.palette.mode === "light"
      ? theme.palette.common.white
      : theme.palette.common.white,
    0.6,
  );
  const progressTrack = alpha(theme.palette.success.main, 0.4);
  const progressFill = theme.palette.success.main;

  const playButtonInner = lighten(theme.palette.error.light, 0.3);
  const playButtonIcon = theme.palette.error.dark;

  const handleTranscribe = async () => {
    if (transcription) {
      setTranscription(null);
      return;
    }
    setTranscribing(true);
    setTranscriptError(null);
    try {
      const fileKey =
        message?.content?.fileKey ||
        message?.content?.file_key ||
        message?.content?.files?.[0]?.file_key ||
        message?.content?.files?.[0]?.fileKey ||
        message?.files?.[0]?.file_key ||
        null;
      const result = await transcribeAudio({
        fileUrl: audioUrl,
        fileKey,
        fileName: message?.content?.fileName || "audio.webm",
      });
      setTranscription(result.transcription || "No speech detected");
    } catch (err) {
      setTranscriptError(err.message || "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const handleCopyTranscript = () => {
    if (transcription) {
      navigator.clipboard.writeText(transcription).catch(() => {});
    }
  };

  const updateFromClientX = (clientX) => {
    if (!trackRef.current || !audioRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const clamped = Math.min(Math.max(ratio, 0), 1);
    const nextTime = (duration || 0) * clamped;
    if (!Number.isFinite(nextTime)) return;
    setCurrentTime(nextTime);
    audioRef.current.currentTime = nextTime;
  };

  const handlePointerDown = (event) => {
    if (!audioRef.current || !trackRef.current) return;
    event.preventDefault();
    trackRef.current.setPointerCapture?.(event.pointerId);
    wasPlayingRef.current = !audioRef.current.paused;
    if (wasPlayingRef.current) {
      audioRef.current.pause();
    }
    setSeeking(true);
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event) => {
    if (!seeking) return;
    event.preventDefault();
    updateFromClientX(event.clientX);
  };

  const handlePointerUp = (event) => {
    if (!seeking || !trackRef.current) return;
    event.preventDefault();
    trackRef.current.releasePointerCapture?.(event.pointerId);
    updateFromClientX(event.clientX);
    setSeeking(false);
    if (wasPlayingRef.current) {
      audioRef.current?.play().catch(() => {});
    }
    wasPlayingRef.current = false;
  };

  return (
    <Box
      sx={{
        width: "100%",
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <Stack
        spacing={1}
        sx={{
          borderRadius: 1,
          backgroundColor: innerSurface,
          px: 1,
          py: 1,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography
            variant="caption"
            sx={{
              color: "text.primary",
              minWidth: 0,
              maxWidth: "80%",
              flex: 1,
              mr: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {message?.content?.fileName || "audio.mp3"}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              letterSpacing: "0.5px",
              color: "text.primary",
              flexShrink: 0,
              minWidth: 40,
            }}
          >
            {displayLabel}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.palette.error.light,
            }}
          >
            <IconButton
              onClick={togglePlayback}
              size="small"
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: playButtonInner,
                color: playButtonIcon,
                "&:hover": {
                  backgroundColor: lighten(playButtonInner, 0.1),
                },
              }}
            >
              {isPlaying ? (
                <PiPauseFill size={18} />
              ) : (
                <PiPlayFill size={18} />
              )}
            </IconButton>
          </Box>
          <Box
            sx={{
              flex: 1,
              position: "relative",
              height: 6,
              width: 150,
              borderRadius: 999,
              backgroundColor: progressTrack,
              cursor: "pointer",
            }}
            ref={trackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
          
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                width: `${progress * 100}%`,
                borderRadius: 999,
                backgroundColor: progressFill,
                transition: "width 80ms linear",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                left: `calc(${progress * 100}% - 6px)`,
                top: "50%",
                transform: "translateY(-50%)",
                width: 14,
                height: 14,
                borderRadius: "50%",
                backgroundColor: progressFill,
                boxShadow: `0 0 0 3px ${innerSurface}`,
                transition: "left 80ms linear",
              }}
            />
          </Box>
          <Tooltip title={transcription ? "Hide text" : "Convert to Text"}>
            <IconButton
              onClick={handleTranscribe}
              disabled={transcribing}
              size="small"
              sx={{
                width: 32,
                height: 32,
                color: transcription ? "#fff" : theme.palette.text.secondary,
                backgroundColor: transcription
                  ? theme.palette.primary.main
                  : alpha(theme.palette.common.white, 0.6),
                border: transcription
                  ? "none"
                  : `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                "&:hover": {
                  backgroundColor: transcription
                    ? theme.palette.primary.dark
                    : alpha(theme.palette.common.white, 0.8),
                },
              }}
            >
              {transcribing ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <PiTextAaBold size={16} />
              )}
            </IconButton>
          </Tooltip>
          <IconButton
            component="a"
            href={audioUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            sx={{
              width: 32,
              height: 32,
              color: theme.palette.text.secondary,
              backgroundColor: alpha(theme.palette.common.white, 0.6),
              border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
            }}
          >
            <PiArrowSquareOutBold size={16} />
          </IconButton>
        </Stack>

        {/* Transcription result */}
        {transcription && (
          <Stack
            spacing={0.5}
            sx={{
              mt: 1,
              p: 1.5,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                Transcription
              </Typography>
              <Tooltip title="Copy">
                <IconButton onClick={handleCopyTranscript} size="small" sx={{ width: 24, height: 24 }}>
                  <PiCopySimpleBold size={13} />
                </IconButton>
              </Tooltip>
            </Stack>
            <Typography variant="body2" sx={{ color: "text.primary", lineHeight: 1.5 }}>
              {transcription}
            </Typography>
          </Stack>
        )}

        {/* Transcription error */}
        {transcriptError && (
          <Typography variant="caption" sx={{ mt: 0.5, color: "error.main", display: "block" }}>
            {transcriptError}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default AudioMsg;
