import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  PiArrowLeftBold,
  PiPhoneIncomingBold,
  PiPhoneOutgoingBold,
  PiPhoneSlashBold,
  PiVideoCameraBold,
  PiPhoneBold,
} from "react-icons/pi";
import { fetchWithAuth } from "../../utils/authApi.js";
import { API_BASE_URL } from "../../config/apiBaseUrl.js";

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (d.toDateString() === yest.toDateString()) {
    return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const outcomeMeta = {
  missed: { label: "Missed", color: "error" },
  no_answer: { label: "No answer", color: "warning" },
  declined: { label: "Declined", color: "error" },
  offline: { label: "Offline", color: "default" },
  answered: { label: "Answered", color: "success" },
};

const CallHistoryPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | missed | audio | video

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/calls?limit=200`);
        if (cancelled) return;
        if (response.ok) setCalls(payload?.data?.calls || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = calls.filter((c) => {
    if (filter === "missed") return c.outcome !== "answered";
    if (filter === "audio") return c.call_type === "audio";
    if (filter === "video") return c.call_type === "video";
    return true;
  });

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", bgcolor: theme.palette.background.default, overflow: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <IconButton onClick={() => navigate("/app")} size="small"><PiArrowLeftBold /></IconButton>
        <PiPhoneBold size={28} color={theme.palette.primary.main} />
        <Typography variant="h5" fontWeight={700}>Call History</Typography>
      </Stack>

      <Box sx={{ p: 3, maxWidth: 900, width: "100%", mx: "auto" }}>
        <Paper elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2, overflow: "hidden" }}>
          <Tabs value={filter} onChange={(_, v) => setFilter(v)} variant="fullWidth" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
            <Tab value="all" label="All" sx={{ textTransform: "none" }} />
            <Tab value="missed" label="Missed" sx={{ textTransform: "none" }} />
            <Tab value="audio" label="Audio" sx={{ textTransform: "none" }} />
            <Tab value="video" label="Video" sx={{ textTransform: "none" }} />
          </Tabs>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
          ) : filtered.length === 0 ? (
            <Stack alignItems="center" sx={{ py: 6 }} spacing={1}>
              <PiPhoneSlashBold size={48} color={theme.palette.text.disabled} />
              <Typography variant="body2" color="text.secondary">No call history yet</Typography>
            </Stack>
          ) : (
            <List disablePadding>
              {filtered.map((c) => {
                const isOutgoing = c.direction === "outgoing";
                const isMissed = !isOutgoing && (c.outcome === "missed" || c.outcome === "no_answer" || c.outcome === "offline");
                const om = outcomeMeta[c.outcome] || { label: c.outcome, color: "default" };
                const DirIcon = isMissed
                  ? PiPhoneSlashBold
                  : isOutgoing ? PiPhoneOutgoingBold : PiPhoneIncomingBold;
                const iconColor = isMissed
                  ? theme.palette.error.main
                  : isOutgoing ? theme.palette.primary.main : theme.palette.success.main;

                return (
                  <ListItem
                    key={c.call_log_id}
                    divider
                    secondaryAction={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={om.label} color={om.color} variant="outlined" />
                        {c.call_type === "video" ? (
                          <Tooltip title="Video call"><Box sx={{ display: "flex" }}><PiVideoCameraBold size={18} color={theme.palette.text.secondary} /></Box></Tooltip>
                        ) : (
                          <Tooltip title="Audio call"><Box sx={{ display: "flex" }}><PiPhoneBold size={16} color={theme.palette.text.secondary} /></Box></Tooltip>
                        )}
                      </Stack>
                    }
                    sx={{
                      cursor: "pointer",
                      "&:hover": { bgcolor: theme.palette.action.hover },
                    }}
                    onClick={() => navigate(`/app?thread=dm-${c.peer_id}`)}
                  >
                    <ListItemAvatar>
                      <Avatar src={c.peer_avatar}>{(c.peer_name || "?").slice(0, 1).toUpperCase()}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body1" fontWeight={isMissed ? 700 : 500}
                            color={isMissed ? "error.main" : "text.primary"} noWrap>
                            {c.peer_name || `User #${c.peer_id}`}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <DirIcon size={14} color={iconColor} />
                          <Typography variant="caption" color="text.secondary">
                            {formatTime(c.created_at)}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default CallHistoryPage;
