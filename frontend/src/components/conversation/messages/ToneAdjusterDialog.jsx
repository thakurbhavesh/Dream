import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  PiPenNibBold,
  PiXBold,
  PiCopySimpleBold,
  PiCheckBold,
} from "react-icons/pi";
import { toneAdjustText } from "../../../services/chatApi";

const TONES = [
  { key: "formal", label: "Formal", color: "#1976d2", desc: "Corporate & professional" },
  { key: "friendly", label: "Friendly", color: "#2e7d32", desc: "Warm & approachable" },
  { key: "diplomatic", label: "Diplomatic", color: "#ed6c02", desc: "Tactful & sensitive" },
  { key: "professional", label: "Professional", color: "#7b1fa2", desc: "Clear & business-like" },
];

const ToneAdjusterDialog = ({ open, onClose, messageText = "" }) => {
  const theme = useTheme();
  const [selectedTone, setSelectedTone] = useState(null);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleToneSelect = async (tone) => {
    if (loading) return;
    setSelectedTone(tone);
    setResult("");
    setError(null);
    setLoading(true);
    try {
      const data = await toneAdjustText(messageText, tone);
      setResult(data.adjusted || messageText);
    } catch (err) {
      setError(err.message || "Failed to adjust tone");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setSelectedTone(null);
    setResult("");
    setError(null);
    setLoading(false);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3, py: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <PiPenNibBold size={22} color={theme.palette.primary.main} />
          <Typography variant="h6" fontWeight={600}>Adjust Tone</Typography>
        </Stack>
        <IconButton onClick={handleClose} size="small">
          <PiXBold size={18} />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 3, pb: 3 }}>
        <Stack spacing={3}>
          {/* Original text */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: "block" }}>
              ORIGINAL
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.text.primary, 0.04),
                border: `1px solid ${theme.palette.divider}`,
                maxHeight: 120,
                overflow: "auto",
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {messageText || "No text"}
              </Typography>
            </Box>
          </Box>

          {/* Tone selection */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: "block" }}>
              SELECT TONE
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {TONES.map((tone) => (
                <Chip
                  key={tone.key}
                  label={tone.label}
                  onClick={() => handleToneSelect(tone.key)}
                  variant={selectedTone === tone.key ? "filled" : "outlined"}
                  sx={{
                    fontWeight: 600,
                    borderColor: tone.color,
                    color: selectedTone === tone.key ? "#fff" : tone.color,
                    bgcolor: selectedTone === tone.key ? tone.color : "transparent",
                    "&:hover": {
                      bgcolor: selectedTone === tone.key ? tone.color : alpha(tone.color, 0.08),
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Result */}
          {(loading || result || error) && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: "block" }}>
                {loading ? "GENERATING..." : "ADJUSTED"}
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${selectedTone ? TONES.find(t => t.key === selectedTone)?.color || theme.palette.primary.main : theme.palette.divider}`,
                  borderLeftWidth: 4,
                  minHeight: 60,
                  display: "flex",
                  alignItems: loading ? "center" : "flex-start",
                  justifyContent: loading ? "center" : "flex-start",
                }}
              >
                {loading ? (
                  <CircularProgress size={28} />
                ) : error ? (
                  <Typography variant="body2" color="error">{error}</Typography>
                ) : (
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", flex: 1 }}>
                    {result}
                  </Typography>
                )}
              </Box>

              {/* Copy button */}
              {result && !loading && (
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={copied ? <PiCheckBold /> : <PiCopySimpleBold />}
                    onClick={handleCopy}
                    sx={{ textTransform: "none", borderRadius: 2 }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </Stack>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default ToneAdjusterDialog;
