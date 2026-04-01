import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Stack,
  Typography,
  IconButton,
  Chip,
  Avatar,
  Button,
  Tooltip,
  Divider,
  CircularProgress,
  useTheme,
} from "@mui/material";
import {
  PiVideoCameraBold,
  PiCalendarBold,
  PiClockBold,
  PiTrashBold,
  PiCopyBold,
  PiCheckBold,
  PiXBold,
  PiQuestionBold,
  PiArrowClockwiseBold,
} from "react-icons/pi";
import { getUpcomingMeetings, rsvpMeeting, deleteMeeting } from "../../services/meetingApi.js";
import useCurrentUser from "../../hooks/useCurrentUser.js";

const statusColors = {
  waiting: "info",
  active: "success",
  ended: "default",
  cancelled: "error",
};

const rsvpIcons = {
  accepted: <PiCheckBold size={12} />,
  declined: <PiXBold size={12} />,
  tentative: <PiQuestionBold size={12} />,
  pending: <PiClockBold size={12} />,
};

const MeetingsList = ({ onJoinMeeting, onClose }) => {
  const theme = useTheme();
  const currentUser = useCurrentUser();
  const orgId = (() => {
    const candidates = [
      currentUser?.organization_id,
      currentUser?.org,
      currentUser?.organization,
    ];
    for (const c of candidates) {
      const num = Number(c);
      if (Number.isFinite(num) && num > 0) return num;
    }
    return null;
  })();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMeetings = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getUpcomingMeetings(orgId);
      setMeetings(data?.meetings || []);
    } catch (err) {
      console.error("Failed to load meetings:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleRsvp = async (meetingId, rsvp) => {
    try {
      await rsvpMeeting(meetingId, rsvp);
      loadMeetings();
    } catch (err) {
      console.error("RSVP failed:", err);
    }
  };

  const handleDelete = async (meetingId) => {
    try {
      await deleteMeeting(meetingId);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const copyId = (meetingCode) => {
    navigator.clipboard.writeText(meetingCode);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Box
      sx={{
        width: 360,
        maxHeight: "70vh",
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        boxShadow: theme.shadows[8],
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PiCalendarBold size={20} />
          <Typography variant="subtitle1" fontWeight={600}>Meetings</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={loadMeetings}>
              <PiArrowClockwiseBold size={16} />
            </IconButton>
          </Tooltip>
          {onClose && (
            <IconButton size="small" onClick={onClose}>
              <PiXBold size={16} />
            </IconButton>
          )}
        </Stack>
      </Stack>

      <Divider />

      <Stack sx={{ flex: 1, overflow: "auto", p: 1 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : meetings.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
            <PiCalendarBold size={40} color={theme.palette.text.disabled} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No upcoming meetings
            </Typography>
          </Stack>
        ) : (
          meetings.map((m) => {
            const isHost = m.host_id === (currentUser?.id || currentUser?.user_id);
            return (
              <Box
                key={m.id}
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  mb: 0.5,
                  bgcolor: theme.palette.action.hover,
                  "&:hover": { bgcolor: theme.palette.action.selected },
                  transition: "background 0.15s",
                }}
              >
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap fontWeight={600}>
                      {m.title}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Chip
                        label={m.status}
                        size="small"
                        color={statusColors[m.status] || "default"}
                        sx={{ height: 20, fontSize: 11 }}
                      />
                      {m.meeting_type === "scheduled" && (
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(m.scheduled_at)}
                        </Typography>
                      )}
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                      <Chip
                        label={m.meeting_id}
                        size="small"
                        variant="outlined"
                        onClick={() => copyId(m.meeting_id)}
                        icon={<PiCopyBold size={10} />}
                        sx={{ height: 22, fontSize: 11, cursor: "pointer" }}
                      />
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {(m.status === "waiting" || m.status === "active") && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PiVideoCameraBold size={14} />}
                        onClick={() => onJoinMeeting?.(m)}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, fontSize: 12, textTransform: "none" }}
                      >
                        Join
                      </Button>
                    )}
                    {isHost && m.status === "waiting" && (
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(m.id)}>
                          <PiTrashBold size={14} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Stack>

                {/* RSVP buttons for non-host scheduled meetings */}
                {!isHost && m.meeting_type === "scheduled" && m.status === "waiting" && (
                  <Stack direction="row" spacing={0.5} sx={{ mt: 1 }}>
                    <Chip
                      label="Accept"
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<PiCheckBold size={12} />}
                      onClick={() => handleRsvp(m.id, "accepted")}
                      sx={{ cursor: "pointer", height: 24 }}
                    />
                    <Chip
                      label="Decline"
                      size="small"
                      color="error"
                      variant="outlined"
                      icon={<PiXBold size={12} />}
                      onClick={() => handleRsvp(m.id, "declined")}
                      sx={{ cursor: "pointer", height: 24 }}
                    />
                    <Chip
                      label="Maybe"
                      size="small"
                      variant="outlined"
                      icon={<PiQuestionBold size={12} />}
                      onClick={() => handleRsvp(m.id, "tentative")}
                      sx={{ cursor: "pointer", height: 24 }}
                    />
                  </Stack>
                )}
              </Box>
            );
          })
        )}
      </Stack>
    </Box>
  );
};

export default MeetingsList;
