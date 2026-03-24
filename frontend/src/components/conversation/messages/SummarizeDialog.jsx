import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
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
  PiMagicWandBold,
  PiXBold,
  PiCopySimpleBold,
  PiCheckBold,
  PiArrowClockwiseBold,
  PiFileBold,
  PiImageBold,
  PiVideoCameraBold,
} from "react-icons/pi";
import { fetchWithAuth } from "../../../utils/authApi";
import { API_BASE_URL } from "../../../config/apiBaseUrl";

const SummarizeDialog = ({ open, message, onClose }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const isDark = theme.palette.mode === "dark";

  const messageText = useMemo(() => {
    if (!message) return "";
    return message?.content?.text || message?.message || message?.content?.code || message?.content?.caption || "";
  }, [message]);

  const isFile = useMemo(() => {
    const type = (message?.type || "").toLowerCase();
    return ["file", "image", "video", "audio"].includes(type);
  }, [message]);

  const fileInfo = useMemo(() => {
    if (!isFile) return null;
    const c = message?.content || {};
    return {
      name: c.fileName || c.name || "File",
      type: c.mimeType || c.fileType || message?.type || "file",
      url: c.fileUrl || c.url || "",
      size: c.fileSize || "",
    };
  }, [isFile, message]);

  const fileIcon = useMemo(() => {
    const type = (message?.type || "").toLowerCase();
    if (type === "image") return <PiImageBold size={20} />;
    if (type === "video") return <PiVideoCameraBold size={20} />;
    return <PiFileBold size={20} />;
  }, [message]);

  const previousSummaryRef = useRef("");

  const doSummarize = useCallback(async () => {
    // Store previous summary so regenerate can request a different one
    if (summary) previousSummaryRef.current = summary;
    setLoading(true);
    setError("");
    setSummary("");
    try {
      const c = message?.content || {};
      const body = isFile
        ? {
            fileUrl: fileInfo?.url,
            fileKey: c.fileKey || c.file_key || null,
            fileName: fileInfo?.name,
            fileType: fileInfo?.type,
            text: messageText || "",
            previousSummary: previousSummaryRef.current || undefined,
          }
        : { text: messageText, previousSummary: previousSummaryRef.current || undefined };

      const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/translate/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(payload?.message || "Summarize failed");
      setSummary(payload?.data?.summary || "No summary generated");
    } catch (err) {
      setError(err?.message || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  }, [messageText, isFile, fileInfo, summary]);

  // Auto-summarize on open
  useEffect(() => {
    if (open && (messageText || isFile)) {
      doSummarize();
    }
    if (!open) {
      setSummary("");
      setError("");
      setCopied(false);
    }
  }, [open]);

  const handleCopy = useCallback(() => {
    if (!summary) return;
    navigator.clipboard?.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [summary]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      sx={{
        "& .MuiDialog-container": { alignItems: "center", justifyContent: "center" },
      }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: theme.palette.background.paper,
          width: 560,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "70vh",
          m: "auto",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 36, height: 36, borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha("#8b5cf6", 0.15)}, ${alpha("#6366f1", 0.15)})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <PiMagicWandBold size={20} color="#8b5cf6" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>Summarize</Typography>
            <Typography variant="caption" color="text.secondary" noWrap title={isFile ? fileInfo?.name : undefined} sx={{ display: "block" }}>
              {isFile ? `File: ${fileInfo?.name}` : `${messageText.length} characters · ${messageText.trim().split(/\s+/).filter(Boolean).length} words`}
            </Typography>
          </Box>
        </Stack>
        <IconButton size="small" onClick={onClose}>
          <PiXBold size={18} />
        </IconButton>
      </Stack>

      <DialogContent sx={{ p: 2.5, overflowY: "auto", flexGrow: 1 }}>

        {/* Original Message / File Info */}
        <Box
          sx={{
            p: 2, borderRadius: 2, mb: 2,
            bgcolor: isDark ? alpha(theme.palette.primary.main, 0.06) : "#f8fafc",
            border: "1px solid",
            borderColor: isDark ? alpha(theme.palette.primary.main, 0.15) : "#e2e8f0",
          }}
        >
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5, mb: 1, display: "block" }}>
            Original
          </Typography>
          {isFile ? (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{ color: theme.palette.primary.main, flexShrink: 0 }}>{fileIcon}</Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} title={fileInfo?.name} sx={{ wordBreak: "break-word" }}>{fileInfo?.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {fileInfo?.size} • {fileInfo?.type}
                </Typography>
              </Box>
            </Stack>
          ) : null}
          {messageText ? (
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6,
                mt: isFile ? 1 : 0,
                maxHeight: 120, overflowY: "auto",
              }}
            >
              {messageText}
            </Typography>
          ) : null}
        </Box>

        {/* Summary Result */}
        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 4, gap: 1.5 }}>
            <CircularProgress size={28} sx={{ color: "#8b5cf6" }} />
            <Typography variant="body2" color="text.secondary">Generating summary...</Typography>
          </Box>
        ) : summary ? (
          <Box
            sx={{
              p: 2, borderRadius: 2,
              background: isDark
                ? `linear-gradient(135deg, ${alpha("#8b5cf6", 0.06)}, ${alpha("#6366f1", 0.04)})`
                : `linear-gradient(135deg, ${alpha("#8b5cf6", 0.04)}, ${alpha("#6366f1", 0.02)})`,
              border: "1px solid",
              borderColor: isDark ? alpha("#8b5cf6", 0.2) : alpha("#8b5cf6", 0.12),
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <PiMagicWandBold size={14} color="#8b5cf6" />
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Summary
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <Button
                  size="small"
                  startIcon={<PiArrowClockwiseBold size={13} />}
                  onClick={doSummarize}
                  sx={{ fontSize: 11, textTransform: "none", color: "text.secondary" }}
                >
                  Regenerate
                </Button>
                <Button
                  size="small"
                  startIcon={copied ? <PiCheckBold size={13} /> : <PiCopySimpleBold size={13} />}
                  onClick={handleCopy}
                  sx={{ fontSize: 11, textTransform: "none", color: copied ? "#22c55e" : "text.secondary" }}
                >
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </Stack>
            </Stack>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.7 }}>
              {summary}
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.08), border: "1px solid", borderColor: alpha(theme.palette.error.main, 0.2) }}>
            <Typography variant="body2" color="error">{error}</Typography>
            <Button size="small" onClick={doSummarize} sx={{ mt: 1, textTransform: "none" }}>
              Try Again
            </Button>
          </Box>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default SummarizeDialog;
