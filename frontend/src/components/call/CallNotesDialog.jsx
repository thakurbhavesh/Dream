import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  PiNotePencilBold,
  PiXBold,
  PiCopySimpleBold,
  PiCheckBold,
  PiListBulletsBold,
  PiCheckCircleBold,
} from "react-icons/pi";
import { generateCallNotes } from "../../services/chatApi";

const CallNotesDialog = ({ open, onClose, callDuration = 0, peerUserName = "", chatContext = [] }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setNotes(null);

    generateCallNotes({
      callDuration,
      participants: [peerUserName].filter(Boolean),
      chatContext,
    })
      .then((data) => {
        setNotes(data.notes || { summary: "Call completed.", keyPoints: [], actionItems: [] });
      })
      .catch((err) => {
        setError(err.message || "Failed to generate notes");
      })
      .finally(() => setLoading(false));
  }, [open, callDuration, peerUserName]);

  const handleCopy = () => {
    if (!notes) return;
    const text = [
      `Call Notes — ${peerUserName || "Call"}`,
      `Duration: ${Math.floor(callDuration / 60)}m ${callDuration % 60}s`,
      "",
      "Summary:",
      notes.summary,
      "",
      "Key Points:",
      ...(notes.keyPoints || []).map((p, i) => `  ${i + 1}. ${p}`),
      "",
      "Action Items:",
      ...(notes.actionItems || []).map((a, i) => `  ${i + 1}. ${a}`),
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
          <PiNotePencilBold size={22} color={theme.palette.primary.main} />
          <Typography variant="h6" fontWeight={600}>Call Notes</Typography>
        </Stack>
        <IconButton onClick={onClose} size="small">
          <PiXBold size={18} />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 3, pb: 3 }}>
        {/* Call info */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{peerUserName || "Call"}</strong> — {Math.floor(callDuration / 60)}m {callDuration % 60}s
          </Typography>
        </Stack>

        {loading ? (
          <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">Generating call notes...</Typography>
          </Stack>
        ) : error ? (
          <Typography variant="body2" color="error" sx={{ py: 2 }}>{error}</Typography>
        ) : notes ? (
          <Stack spacing={2.5}>
            {/* Summary */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Summary</Typography>
              <Box sx={{
                p: 2, borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                borderLeft: `4px solid ${theme.palette.primary.main}`,
              }}>
                <Typography variant="body2">{notes.summary}</Typography>
              </Box>
            </Box>

            {/* Key Points */}
            {notes.keyPoints?.length > 0 && (
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <PiListBulletsBold size={16} color={theme.palette.info.main} />
                  <Typography variant="subtitle2" fontWeight={700}>Key Points</Typography>
                </Stack>
                <Stack spacing={0.75}>
                  {notes.keyPoints.map((point, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 20 }}>{i + 1}.</Typography>
                      <Typography variant="body2">{point}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            <Divider />

            {/* Action Items */}
            {notes.actionItems?.length > 0 && (
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <PiCheckCircleBold size={16} color={theme.palette.success.main} />
                  <Typography variant="subtitle2" fontWeight={700}>Action Items</Typography>
                </Stack>
                <Stack spacing={0.75}>
                  {notes.actionItems.map((item, i) => (
                    <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                      <PiCheckCircleBold size={14} color={theme.palette.success.main} style={{ marginTop: 3, flexShrink: 0 }} />
                      <Typography variant="body2">{item}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Copy button */}
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <Button
                size="small"
                variant="contained"
                startIcon={copied ? <PiCheckBold /> : <PiCopySimpleBold />}
                onClick={handleCopy}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                {copied ? "Copied" : "Copy Notes"}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={onClose}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                Dismiss
              </Button>
            </Stack>
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default CallNotesDialog;
