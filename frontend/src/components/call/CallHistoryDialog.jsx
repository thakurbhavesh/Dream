import React, { useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  PiPhoneIncomingBold,
  PiPhoneOutgoingBold,
  PiPhoneSlashBold,
  PiVideoCameraBold,
  PiPhoneBold,
  PiXBold,
} from "react-icons/pi";
import { fetchWithAuth } from "../../utils/authApi.js";
import { API_BASE_URL } from "../../config/apiBaseUrl.js";

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) {
    return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (d.toDateString() === yest.toDateString()) {
    return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const outcomeMeta = {
  missed: { label: "Missed", color: "error" },
  no_answer: { label: "No answer", color: "warning" },
  declined: { label: "Declined", color: "error" },
  offline: { label: "Offline", color: "default" },
  answered: { label: "Answered", color: "success" },
};

/**
 * Per-user call history dialog — opened from the chat header menu.
 * peer = { id, name, avatar }
 */
const CallHistoryDialog = ({ open, onClose, peer }) => {
  const theme = useTheme();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!open || !peer?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { response, payload } = await fetchWithAuth(
          `${API_BASE_URL}/calls?peer_id=${encodeURIComponent(peer.id)}&limit=100`
        );
        if (cancelled) return;
        if (response.ok) setCalls(payload?.data?.calls || []);
        else setCalls([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, peer?.id]);

  const filtered = calls.filter((c) => {
    if (filter === "missed") return c.outcome !== "answered";
    if (filter === "audio") return c.call_type === "audio";
    if (filter === "video") return c.call_type === "video";
    return true;
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle component="div" sx={{ pb: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar src={peer?.avatar} sx={{ width: 36, height: 36 }}>
          {(peer?.name || "?").slice(0, 1).toUpperCase()}
        </Avatar>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {peer?.name || "Call History"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Call history
          </Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}>
          <PiXBold />
        </IconButton>
      </DialogTitle>

      <Tabs
        value={filter}
        onChange={(_, v) => setFilter(v)}
        variant="fullWidth"
        sx={{ borderBottom: `1px solid ${theme.palette.divider}`, minHeight: 38 }}
      >
        <Tab value="all" label="All" sx={{ textTransform: "none", minHeight: 38 }} />
        <Tab value="missed" label="Missed" sx={{ textTransform: "none", minHeight: 38 }} />
        <Tab value="audio" label="Audio" sx={{ textTransform: "none", minHeight: 38 }} />
        <Tab value="video" label="Video" sx={{ textTransform: "none", minHeight: 38 }} />
      </Tabs>

      <DialogContent sx={{ px: 0, py: 0, maxHeight: 420 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={28} /></Stack>
        ) : filtered.length === 0 ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 6 }}>
            <PiPhoneSlashBold size={40} color={theme.palette.text.disabled} />
            <Typography variant="body2" color="text.secondary">
              No calls with {peer?.name || "this user"} yet
            </Typography>
          </Stack>
        ) : (
          <List disablePadding>
            {filtered.map((c) => {
              const isOutgoing = c.direction === "outgoing";
              const isMissedIn = !isOutgoing && (c.outcome === "missed" || c.outcome === "no_answer" || c.outcome === "offline");
              const om = outcomeMeta[c.outcome] || { label: c.outcome, color: "default" };
              const DirIcon = isMissedIn
                ? PiPhoneSlashBold
                : isOutgoing ? PiPhoneOutgoingBold : PiPhoneIncomingBold;
              const iconColor = isMissedIn
                ? theme.palette.error.main
                : isOutgoing ? theme.palette.primary.main : theme.palette.success.main;
              return (
                <React.Fragment key={c.call_log_id}>
                  <ListItem
                    secondaryAction={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={om.label} color={om.color} variant="outlined" />
                        {c.call_type === "video" ? (
                          <Tooltip title="Video call">
                            <Box sx={{ display: "flex" }}>
                              <PiVideoCameraBold size={16} color={theme.palette.text.secondary} />
                            </Box>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Audio call">
                            <Box sx={{ display: "flex" }}>
                              <PiPhoneBold size={14} color={theme.palette.text.secondary} />
                            </Box>
                          </Tooltip>
                        )}
                      </Stack>
                    }
                  >
                    <ListItemAvatar sx={{ minWidth: 44 }}>
                      <Box sx={{
                        width: 36, height: 36, borderRadius: "50%",
                        bgcolor: theme.palette.action.hover,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <DirIcon size={18} color={iconColor} />
                      </Box>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={isMissedIn ? 700 : 500}
                          color={isMissedIn ? "error.main" : "text.primary"}>
                          {isOutgoing ? "Outgoing" : "Incoming"}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(c.created_at)}
                          {typeof c.duration_seconds === "number" && c.duration_seconds > 0
                            ? ` • ${Math.floor(c.duration_seconds / 60)}m ${c.duration_seconds % 60}s`
                            : ""}
                        </Typography>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CallHistoryDialog;
