import { useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Checkbox,
  Typography,
  Box,
  Chip,
  Stack,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import { PiMagnifyingGlassBold } from "react-icons/pi";

const BroadcastDialog = ({ open, onClose, contacts = [], onSend }) => {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.label || c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const toggleContact = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!message.trim() || selectedIds.size === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await onSend?.(Array.from(selectedIds), message.trim());
      setResult(res);
      if (res?.ok) {
        setTimeout(() => {
          setMessage("");
          setSelectedIds(new Set());
          setResult(null);
          onClose?.();
        }, 2000);
      }
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;
    setMessage("");
    setSelectedIds(new Set());
    setSearch("");
    setResult(null);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Broadcast Message</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Selected chips */}
          {selectedIds.size > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {Array.from(selectedIds).map((id) => {
                const c = contacts.find((c) => c.id === id);
                return (
                  <Chip
                    key={id}
                    label={c?.label || c?.name || id}
                    size="small"
                    onDelete={() => toggleContact(id)}
                  />
                );
              })}
            </Box>
          )}

          {/* Search contacts */}
          <TextField
            size="small"
            fullWidth
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PiMagnifyingGlassBold size={16} />
                </InputAdornment>
              ),
            }}
          />

          {/* Contact list */}
          <Box sx={{ maxHeight: 240, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
            <List dense disablePadding>
              {filtered.map((c) => (
                <ListItemButton key={c.id} onClick={() => toggleContact(c.id)}>
                  <Checkbox
                    size="small"
                    checked={selectedIds.has(c.id)}
                    tabIndex={-1}
                    sx={{ mr: 1 }}
                  />
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar sx={{ width: 28, height: 28 }} src={c.avatar || c.profilePicture}>
                      {(c.label || c.name || "?")[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={c.label || c.name}
                    secondary={c.email || ""}
                    primaryTypographyProps={{ variant: "body2" }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                </ListItemButton>
              ))}
              {filtered.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                  No contacts found
                </Typography>
              )}
            </List>
          </Box>

          {/* Message */}
          <TextField
            multiline
            rows={3}
            fullWidth
            placeholder="Type your broadcast message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {/* Result */}
          {result && (
            <Typography
              variant="body2"
              color={result.ok ? "success.main" : "error.main"}
              sx={{ textAlign: "center" }}
            >
              {result.ok
                ? `Sent to ${result.sent} contact(s)${result.failed ? `, ${result.failed} failed` : ""}`
                : result.error || "Broadcast failed"}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={sending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || !message.trim() || selectedIds.size === 0}
          startIcon={sending ? <CircularProgress size={16} /> : null}
        >
          {sending ? "Sending..." : `Send to ${selectedIds.size} contact(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BroadcastDialog;
