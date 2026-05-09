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
  Tabs,
  Tab,
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
  PiLinkBold,
  PiUsersThreeBold,
} from "react-icons/pi";
import { getUpcomingMeetings, getPastMeetings, rsvpMeeting, deleteMeeting, getMeetingAttendance } from "../../services/meetingApi.js";
import { Dialog, DialogTitle, DialogContent, DialogActions, Snackbar } from "@mui/material";
import useCurrentUser from "../../hooks/useCurrentUser.js";
import MeetingDetailsDialog from "./MeetingDetailsDialog.jsx";

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
  const [tab, setTab] = useState("upcoming"); // "upcoming" | "past"
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  // Full-info "click on a card" details dialog
  const [detailsOpenId, setDetailsOpenId] = useState(null);
  const [detailsToast, setDetailsToast] = useState("");

  const openAttendance = async (meeting) => {
    setAttendanceOpen(true);
    setAttendanceLoading(true);
    setAttendanceData(null);
    try {
      const data = await getMeetingAttendance(meeting.id);
      setAttendanceData(data);
    } catch (err) {
      console.error("Attendance load failed:", err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const loadMeetings = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = tab === "past"
        ? await getPastMeetings(orgId)
        : await getUpcomingMeetings(orgId);
      setMeetings(data?.meetings || []);
    } catch (err) {
      console.error("Failed to load meetings:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, tab]);

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

  const copyInviteLink = (meetingCode) => {
    const origin = window.location.origin;
    const link = `${origin}/app/meeting?join=${encodeURIComponent(meetingCode)}`;
    navigator.clipboard.writeText(link);
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

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ minHeight: 36, borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        <Tab value="upcoming" label="Upcoming" sx={{ minHeight: 36, textTransform: "none", fontSize: 13 }} />
        <Tab value="past" label="Past" sx={{ minHeight: 36, textTransform: "none", fontSize: 13 }} />
      </Tabs>

      <Stack sx={{ flex: 1, overflow: "auto", p: 1 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : meetings.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 4 }}>
            <PiCalendarBold size={40} color={theme.palette.text.disabled} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {tab === "past" ? "No past meetings yet" : "No upcoming meetings"}
            </Typography>
          </Stack>
        ) : (
          meetings.map((m) => {
            const isHost = m.host_id === (currentUser?.id || currentUser?.user_id);
            return (
              <Box
                key={m.id}
                onClick={(e) => {
                  // Tapping inline buttons / chips shouldn't open the dialog;
                  // they handle click via stopPropagation below where needed.
                  if (e.defaultPrevented) return;
                  setDetailsOpenId(m.id);
                }}
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  mb: 0.5,
                  bgcolor: theme.palette.action.hover,
                  cursor: "pointer",
                  "&:hover": { bgcolor: theme.palette.action.selected },
                  transition: "background 0.15s",
                }}
              >
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap fontWeight={600}>
                      {m.title}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap">
                      <Chip
                        label={m.status}
                        size="small"
                        color={statusColors[m.status] || "default"}
                        sx={{ height: 20, fontSize: 11 }}
                      />
                      <Stack direction="row" alignItems="center" spacing={0.3}>
                        <PiClockBold size={11} color={theme.palette.text.secondary} />
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(
                            m.meeting_type === "scheduled"
                              ? m.scheduled_at
                              : (m.started_at || m.created_at)
                          )}
                        </Typography>
                      </Stack>
                      {m.meeting_type === "scheduled" && (
                        <Chip label="Scheduled" size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                      )}
                      {tab === "past" && typeof m.duration_minutes === "number" && m.duration_minutes > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          • {m.duration_minutes} min
                        </Typography>
                      )}
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                      <Tooltip title="Copy meeting ID">
                        <Chip
                          label={m.meeting_id}
                          size="small"
                          variant="outlined"
                          onClick={(e) => { e.stopPropagation(); copyId(m.meeting_id); }}
                          icon={<PiCopyBold size={10} />}
                          sx={{ height: 22, fontSize: 11, cursor: "pointer" }}
                        />
                      </Tooltip>
                      {tab !== "past" && (
                        <Tooltip title="Copy invite link">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); copyInviteLink(m.meeting_id); }} sx={{ p: 0.5 }}>
                            <PiLinkBold size={12} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {tab === "past" && Array.isArray(m.participant_count) ? null : tab === "past" && typeof m.attendee_count === "number" ? (
                        <Typography variant="caption" color="text.secondary">
                          • {m.attendee_count} attendee{m.attendee_count === 1 ? "" : "s"}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>

                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {tab !== "past" && (m.status === "waiting" || m.status === "active") && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PiVideoCameraBold size={14} />}
                        onClick={(e) => { e.stopPropagation(); onJoinMeeting?.(m); }}
                        sx={{ minWidth: 0, px: 1.5, py: 0.5, fontSize: 12, textTransform: "none" }}
                      >
                        Join
                      </Button>
                    )}
                    {tab !== "past" && isHost && m.status === "waiting" && (
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}>
                          <PiTrashBold size={14} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {tab === "past" && isHost && (
                      <>
                        <Tooltip title="Attendance report">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openAttendance(m); }}>
                            <PiUsersThreeBold size={14} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove from history">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}>
                            <PiTrashBold size={14} />
                          </IconButton>
                        </Tooltip>
                      </>
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
                      onClick={(e) => { e.stopPropagation(); handleRsvp(m.id, "accepted"); }}
                      sx={{ cursor: "pointer", height: 24 }}
                    />
                    <Chip
                      label="Decline"
                      size="small"
                      color="error"
                      variant="outlined"
                      icon={<PiXBold size={12} />}
                      onClick={(e) => { e.stopPropagation(); handleRsvp(m.id, "declined"); }}
                      sx={{ cursor: "pointer", height: 24 }}
                    />
                    <Chip
                      label="Maybe"
                      size="small"
                      variant="outlined"
                      icon={<PiQuestionBold size={12} />}
                      onClick={(e) => { e.stopPropagation(); handleRsvp(m.id, "tentative"); }}
                      sx={{ cursor: "pointer", height: 24 }}
                    />
                  </Stack>
                )}
              </Box>
            );
          })
        )}
      </Stack>

      <Dialog open={attendanceOpen} onClose={() => setAttendanceOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          Attendance report
          {attendanceData?.meeting?.title ? ` — ${attendanceData.meeting.title}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {attendanceLoading && (
            <Stack alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={24} />
            </Stack>
          )}
          {!attendanceLoading && attendanceData?.attendees?.length === 0 && (
            <Typography variant="body2" color="text.secondary">No attendance recorded.</Typography>
          )}
          {!attendanceLoading && attendanceData?.attendees?.map((a) => (
            <Stack key={`${a.user_id || a.name}-${a.first_join}`} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1 }}>
              <Avatar sx={{ width: 32, height: 32, fontSize: 13 }}>{(a.name || "?").charAt(0)}</Avatar>
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>{a.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(a.first_join).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {a.last_leave ? ` → ${new Date(a.last_leave).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : " → still connected"}
                  {" • "}{Math.floor(a.total_seconds / 60)}m {a.total_seconds % 60}s
                  {a.sessions > 1 ? ` • ${a.sessions} sessions` : ""}
                </Typography>
              </Stack>
            </Stack>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttendanceOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Full meeting details — opens when a card is clicked */}
      <MeetingDetailsDialog
        open={Boolean(detailsOpenId)}
        meetingId={detailsOpenId}
        onClose={() => setDetailsOpenId(null)}
        onCopyToast={(msg) => setDetailsToast(msg)}
      />
      <Snackbar
        open={Boolean(detailsToast)}
        autoHideDuration={1800}
        onClose={() => setDetailsToast("")}
        message={detailsToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
};

export default MeetingsList;
