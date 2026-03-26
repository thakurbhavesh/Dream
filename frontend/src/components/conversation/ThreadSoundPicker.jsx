import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Box,
  Typography,
  alpha,
  useTheme,
  Slide,
} from "@mui/material";
import {
  PiSpeakerHighBold,
  PiCheckBold,
  PiMusicNoteBold,
  PiSpeakerSlashBold,
} from "react-icons/pi";

const NOTIFICATION_SOUNDS = [
  { value: "default", label: "Default (Global)", icon: PiSpeakerSlashBold, color: "#78909C" },
  { value: "sound1.mp3", label: "Classic", icon: PiMusicNoteBold, color: "#5C6BC0" },
  { value: "sound2.mp3", label: "Chime", icon: PiMusicNoteBold, color: "#26A69A" },
  { value: "sound3.mp3", label: "Bell", icon: PiMusicNoteBold, color: "#FFA726" },
  { value: "sound4.mp3", label: "Pop", icon: PiMusicNoteBold, color: "#EF5350" },
  { value: "sound5.mp3", label: "Ding", icon: PiMusicNoteBold, color: "#AB47BC" },
  { value: "sound6.mp3", label: "Drop", icon: PiMusicNoteBold, color: "#42A5F5" },
  { value: "sound7.mp3", label: "Bubble", icon: PiMusicNoteBold, color: "#66BB6A" },
  { value: "sound8.mp3", label: "Ping", icon: PiMusicNoteBold, color: "#EC407A" },
];

const _basePath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const ThreadSoundPicker = ({ open, onClose, currentSound = "default", onSelect }) => {
  const theme = useTheme();
  const [selected, setSelected] = useState(currentSound || "default");
  const [playing, setPlaying] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (open) setSelected(currentSound || "default");
  }, [open, currentSound]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePreview = (soundFile) => {
    if (soundFile === "default") return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    try {
      const url = soundFile.startsWith("/")
        ? `${_basePath}${soundFile}`
        : `${_basePath}/sounds/${soundFile}`;
      const audio = new Audio(url);
      audio.volume = 0.5;
      audioRef.current = audio;
      setPlaying(soundFile);
      audio.play().catch(() => {});
      audio.onended = () => { setPlaying(null); audioRef.current = null; };
    } catch {
      setPlaying(null);
    }
  };

  const handleSelect = (soundFile) => {
    setSelected(soundFile);
    if (soundFile !== "default") handlePreview(soundFile);
  };

  const handleSave = () => {
    onSelect?.(selected);
    onClose?.();
  };

  const isDark = theme.palette.mode === "dark";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      TransitionComponent={Slide}
      TransitionProps={{ direction: "up" }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
        },
      }}
    >
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          px: 3,
          py: 2.5,
          color: "#fff",
        }}
      >
        <Typography variant="h6" fontWeight={700}>
          Notification Sound
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
          Choose a unique tone for this chat
        </Typography>
      </Box>

      <DialogContent sx={{ px: 1.5, py: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {NOTIFICATION_SOUNDS.map((s) => {
            const isSelected = selected === s.value;
            const isPlaying = playing === s.value;
            const SoundIcon = s.icon;

            return (
              <Box
                key={s.value}
                onClick={() => handleSelect(s.value)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  px: 2,
                  py: 1.25,
                  borderRadius: 2,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  bgcolor: isSelected
                    ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08)
                    : "transparent",
                  border: "2px solid",
                  borderColor: isSelected
                    ? theme.palette.primary.main
                    : "transparent",
                  "&:hover": {
                    bgcolor: isSelected
                      ? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12)
                      : alpha(theme.palette.action.hover, 0.06),
                  },
                }}
              >
                {/* Color dot / icon */}
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    bgcolor: alpha(s.color, isDark ? 0.2 : 0.12),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <SoundIcon size={18} color={s.color} />
                </Box>

                {/* Label */}
                <Typography
                  variant="body2"
                  sx={{
                    flex: 1,
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                  }}
                >
                  {s.label}
                </Typography>

                {/* Preview button */}
                {s.value !== "default" && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(s.value);
                    }}
                    sx={{
                      color: isPlaying
                        ? theme.palette.primary.main
                        : theme.palette.text.secondary,
                      bgcolor: isPlaying
                        ? alpha(theme.palette.primary.main, 0.1)
                        : "transparent",
                      transition: "all 0.15s",
                      ...(isPlaying && {
                        animation: "sound-pulse 1s infinite",
                        "@keyframes sound-pulse": {
                          "0%, 100%": { transform: "scale(1)" },
                          "50%": { transform: "scale(1.15)" },
                        },
                      }),
                    }}
                  >
                    <PiSpeakerHighBold size={16} />
                  </IconButton>
                )}

                {/* Check mark */}
                {isSelected && (
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      bgcolor: theme.palette.primary.main,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <PiCheckBold size={12} color="#fff" />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2, px: 3 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{ borderRadius: 2, px: 3 }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ThreadSoundPicker;
