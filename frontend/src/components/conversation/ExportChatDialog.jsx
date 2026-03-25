import React, { useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { PiFileText, PiFilePdf } from "react-icons/pi";
import { fetchWithAuth } from "../../utils/authApi.js";
import { API_BASE_URL } from "../../config/apiBaseUrl.js";
import { exportChatAsPdf } from "../../utils/chatExportPdf.js";

const ExportChatDialog = ({ open, onClose, threadId, threadLabel }) => {
  const [loading, setLoading] = useState(null); // 'txt' | 'pdf' | null

  const handleExportText = async () => {
    if (!threadId) return;
    setLoading("txt");
    try {
      const { response } = await fetchWithAuth(
        `${API_BASE_URL}/chat/threads/${threadId}/export`
      );
      if (response.ok) {
        const text = await response.text();
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat-export-${threadId}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
      onClose();
    } catch (err) {
      console.error("[export] text export failed:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleExportPdf = async () => {
    if (!threadId) return;
    setLoading("pdf");
    try {
      // Fetch messages via existing API
      const { response, payload } = await fetchWithAuth(
        `${API_BASE_URL}/chat/threads/${threadId}/messages?limit=10000`
      );
      if (response.ok) {
        const messages = payload?.data?.messages || [];
        await exportChatAsPdf(messages, threadLabel || "Chat");
      }
      onClose();
    } catch (err) {
      console.error("[export] PDF export failed:", err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Export Chat</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose export format for "{threadLabel || "this chat"}"
        </Typography>
        <Stack spacing={1.5}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={
              loading === "txt" ? (
                <CircularProgress size={18} />
              ) : (
                <PiFileText size={20} />
              )
            }
            onClick={handleExportText}
            disabled={!!loading}
            sx={{ justifyContent: "flex-start", py: 1.5 }}
          >
            Export as Text (.txt)
          </Button>
          <Button
            variant="outlined"
            fullWidth
            startIcon={
              loading === "pdf" ? (
                <CircularProgress size={18} />
              ) : (
                <PiFilePdf size={20} />
              )
            }
            onClick={handleExportPdf}
            disabled={!!loading}
            sx={{ justifyContent: "flex-start", py: 1.5 }}
          >
            Export as PDF (.pdf)
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!!loading}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportChatDialog;
