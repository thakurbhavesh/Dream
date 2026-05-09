import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  PiVideoCameraBold,
  PiClockBold,
  PiCalendarBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiHourglassBold,
  PiUserCheckBold,
  PiUsersThreeBold,
  PiKeyBold,
  PiCopyBold,
  PiLinkBold,
  PiRepeatBold,
  PiCrownBold,
  PiArrowsClockwiseBold,
  PiX,
} from "react-icons/pi";
import { getMeetingById, getMeetingAttendance } from "../../services/meetingApi.js";

// ─── Helpers ──────────────────────────────────────────────────────────────
const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const formatDuration = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const initialsOf = (name) => {
  const n = String(name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const STATUS_THEME = {
  waiting:   { label: "Scheduled", color: "#2563eb" },
  active:    { label: "Live",      color: "#16a34a" },
  ended:     { label: "Ended",     color: "#64748b" },
  cancelled: { label: "Cancelled", color: "#dc2626" },
};

// Fold attendance sessions into per-user totals so a person who joined twice
// shows up once with combined time + first joined / last left timestamps.
const foldSessions = (sessions = []) => {
  const map = new Map();
  for (const s of sessions) {
    const key = s.user_id != null ? `u-${s.user_id}` : `g-${s.display_name || s.socket_id || ""}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        userId: s.user_id || null,
        name: s.user_name || s.display_name || (s.user_id ? `User #${s.user_id}` : "Guest"),
        email: s.user_email || null,
        avatar: s.user_avatar || null,
        firstJoinedAt: s.joined_at,
        lastLeftAt: s.left_at,
        totalMs: 0,
        sessions: 0,
        stillIn: false,
      });
    }
    const entry = map.get(key);
    entry.sessions += 1;
    if (s.joined_at && (!entry.firstJoinedAt || new Date(s.joined_at) < new Date(entry.firstJoinedAt))) {
      entry.firstJoinedAt = s.joined_at;
    }
    if (s.left_at) {
      if (!entry.lastLeftAt || new Date(s.left_at) > new Date(entry.lastLeftAt)) {
        entry.lastLeftAt = s.left_at;
      }
    } else {
      entry.stillIn = true;
    }
    if (s.joined_at) {
      const start = new Date(s.joined_at).getTime();
      const end = s.left_at ? new Date(s.left_at).getTime() : Date.now();
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        entry.totalMs += end - start;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalMs - a.totalMs);
};

// ─── Dialog ───────────────────────────────────────────────────────────────
const MeetingDetailsDialog = ({ open, meetingId, onClose, onCopyToast }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  // Mobile + narrow screens: fullScreen + tighter typography. The xs cutoff
  // (600 px) catches phones in portrait + landscape; tablets keep the
  // floating dialog.
  const isFullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !meetingId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      getMeetingById(meetingId).catch((err) => ({ __err: err })),
      getMeetingAttendance(meetingId).catch((err) => ({ __err: err })),
    ]).then(([detail, att]) => {
      if (cancelled) return;
      if (detail?.__err) setError(detail.__err.message || "Failed to load meeting");
      const data = !detail?.__err ? detail : null;
      setMeeting(data?.meeting || null);
      setParticipants(Array.isArray(data?.participants) ? data.participants : []);
      setAttendance(att?.__err ? [] : (Array.isArray(att?.sessions) ? att.sessions : (Array.isArray(att) ? att : [])));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, meetingId]);

  const status = String(meeting?.status || "").toLowerCase();
  const statusTheme = STATUS_THEME[status] || { label: status || "—", color: theme.palette.text.secondary };

  // The "started_at" column only gets set when a meeting transitions to
  // 'active'. Instant meetings created and ended within seconds, or
  // scheduled meetings that ended before anyone joined, never get a value.
  // Fall back to created_at so the UI still shows something sensible.
  const effectiveStartIso = meeting?.started_at || meeting?.created_at || meeting?.scheduled_at || null;
  const effectiveEndIso = meeting?.ended_at || (status === "active" ? new Date().toISOString() : null);

  // Effective duration: prefer server-stored duration_minutes, else compute
  // from started_at / ended_at, else fall back to (ended_at − created_at)
  // for instant meetings that ended without ever flipping to active.
  const durationMs = useMemo(() => {
    if (Number.isFinite(meeting?.duration_minutes) && meeting.duration_minutes > 0) {
      return meeting.duration_minutes * 60_000;
    }
    const startIso = meeting?.started_at || meeting?.created_at;
    if (!startIso) return null;
    const start = new Date(startIso).getTime();
    const endIso = meeting?.ended_at || (status === "active" ? new Date().toISOString() : null);
    const end = endIso ? new Date(endIso).getTime() : null;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return end - start;
    }
    return null;
  }, [meeting, status]);

  const folded = useMemo(() => foldSessions(attendance), [attendance]);

  // Map attendance entries to participants by user_id so we can show "joined as host"
  const participantRoleByUserId = useMemo(() => {
    const map = new Map();
    for (const p of participants) {
      const id = p.user_id || p.id;
      if (id != null) map.set(String(id), p);
    }
    return map;
  }, [participants]);

  const handleCopy = (text, label = "Copied") => {
    if (!text) return;
    navigator.clipboard?.writeText(text).catch(() => {});
    onCopyToast?.(label);
  };

  const handleCopyInviteLink = () => {
    if (!meeting?.meeting_id) return;
    // Best-effort: build a link to /app/meeting?join=CODE on the same origin
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    handleCopy(`${origin}/app/meeting?join=${meeting.meeting_id}`, "Invite link copied");
  };

  // Co-hosts pulled from the participants list (role === 'co-host').
  const coHosts = useMemo(
    () => participants.filter((p) => String(p.role || "").toLowerCase().includes("co")),
    [participants]
  );

  const isRecurring = meeting?.recurrence_rule && meeting.recurrence_rule !== "none";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isFullScreen}
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 3 },
          overflow: "hidden",
          // On phones the dialog takes the whole viewport so it can scroll
          // smoothly without competing with the body scroll.
          height: { xs: "100%", sm: "auto" },
          maxHeight: { xs: "100%", sm: "calc(100% - 64px)" },
        },
      }}
    >
      {/* Banner header */}
      <Box
        sx={{
          position: "relative",
          px: 3,
          pt: 2.5,
          pb: 2,
          background: `linear-gradient(135deg, ${alpha(statusTheme.color, 0.18)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: "absolute", top: 10, right: 10 }}
        >
          <PiX size={18} />
        </IconButton>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: alpha(statusTheme.color, 0.15),
              color: statusTheme.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PiVideoCameraBold size={20} />
          </Box>
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" fontWeight={800} noWrap>
              {meeting?.title || (loading ? "Loading…" : "Meeting")}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
              <Chip
                size="small"
                label={statusTheme.label}
                sx={{
                  height: 22,
                  fontWeight: 700,
                  bgcolor: alpha(statusTheme.color, 0.12),
                  color: statusTheme.color,
                  borderRadius: 1,
                }}
              />
              {meeting?.meeting_type && (
                <Chip
                  size="small"
                  label={String(meeting.meeting_type).replace(/_/g, " ")}
                  variant="outlined"
                  sx={{ height: 22, fontWeight: 600, fontSize: 11, textTransform: "capitalize" }}
                />
              )}
              {isRecurring && (
                <Chip
                  size="small"
                  icon={<PiRepeatBold size={11} />}
                  label={meeting.recurrence_rule}
                  variant="outlined"
                  sx={{ height: 22, fontWeight: 600, fontSize: 11, textTransform: "capitalize" }}
                />
              )}
            </Stack>
          </Stack>
        </Stack>
        {!!meeting?.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.55 }}>
            {meeting.description}
          </Typography>
        )}
      </Box>

      <DialogContent sx={{ p: 0, bgcolor: isDark ? alpha("#0f172a", 0.4) : "#fafbfc" }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress size={28} />
          </Stack>
        ) : !meeting ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <Typography color="text.secondary">{error || "Meeting not found"}</Typography>
          </Stack>
        ) : (
          <Stack spacing={2.5} sx={{ p: 3 }}>
            {/* Stat cards */}
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <StatCard
                icon={PiClockBold}
                label="Duration"
                value={durationMs != null ? formatDuration(durationMs) : "—"}
                color={theme.palette.primary.main}
              />
              <StatCard
                icon={PiUsersThreeBold}
                label="Attendees"
                value={folded.length || participants.length || 0}
                color="#0891b2"
              />
              <StatCard
                icon={PiCalendarBold}
                label="Started"
                value={effectiveStartIso ? formatTime(effectiveStartIso) : "—"}
                color="#16a34a"
              />
              <StatCard
                icon={PiHourglassBold}
                label="Ended"
                value={effectiveEndIso ? formatTime(effectiveEndIso) : "—"}
                color={statusTheme.color}
              />
            </Stack>

            {/* Timeline strip */}
            <Section title="Timeline">
              <Row label="Created" value={formatDateTime(meeting.created_at)} />
              {meeting.scheduled_at && (
                <Row icon={PiCalendarBold} label="Scheduled for" value={formatDateTime(meeting.scheduled_at)} />
              )}
              {meeting.started_at && (
                <Row icon={PiCheckCircleBold} label="Started" value={formatDateTime(meeting.started_at)} color="#16a34a" />
              )}
              {meeting.ended_at && (
                <Row icon={PiXCircleBold} label="Ended" value={formatDateTime(meeting.ended_at)} color="#64748b" />
              )}
              {meeting.reminder_sent_at && (
                <Row icon={PiClockBold} label="Reminder sent" value={formatDateTime(meeting.reminder_sent_at)} />
              )}
            </Section>

            {/* Host + meeting metadata */}
            <Section title="Meeting info">
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pb: 1 }}>
                <Avatar src={meeting.host_avatar || undefined} sx={{ width: 38, height: 38 }}>
                  {initialsOf(meeting.host_name)}
                </Avatar>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {meeting.host_name || (meeting.host_id ? `User #${meeting.host_id}` : "Unknown")}
                    </Typography>
                    <Chip
                      icon={<PiCrownBold size={11} />}
                      label="Host"
                      size="small"
                      sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: alpha("#f59e0b", 0.15), color: "#b45309" }}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {meeting.host_email || ""}
                  </Typography>
                </Stack>
              </Stack>
              {coHosts.length > 0 && (
                <Box sx={{ pl: 6.5, mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    Co-hosts
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {coHosts.map((p) => (
                      <Chip
                        key={p.id || p.user_id}
                        size="small"
                        avatar={<Avatar src={p.user_avatar || undefined}>{initialsOf(p.user_name || p.display_name)}</Avatar>}
                        label={p.user_name || p.display_name || `User #${p.user_id}`}
                        sx={{ height: 24 }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}
              <Divider sx={{ my: 1 }} />
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Meeting code
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, mt: 0.25 }}>
                    {meeting.meeting_id}
                  </Typography>
                </Box>
                <Tooltip title="Copy code">
                  <IconButton size="small" onClick={() => handleCopy(meeting.meeting_id, "Meeting code copied")}>
                    <PiCopyBold size={14} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy invite link">
                  <IconButton size="small" onClick={handleCopyInviteLink}>
                    <PiLinkBold size={14} />
                  </IconButton>
                </Tooltip>
              </Stack>
              {meeting.passcode && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                  <PiKeyBold size={14} color={theme.palette.text.secondary} />
                  <Typography variant="caption" color="text.secondary">
                    Passcode required
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", fontWeight: 700 }}>
                    {meeting.passcode}
                  </Typography>
                </Stack>
              )}
            </Section>

            {/* Attendees / attendance */}
            <Section
              title={`Members (${folded.length || participants.length || 0})`}
              right={
                folded.length > 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    From join logs
                  </Typography>
                ) : null
              }
            >
              {folded.length === 0 && participants.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  No attendance recorded.
                </Typography>
              )}
              {folded.length > 0 ? (
                <Stack divider={<Divider flexItem />} spacing={1}>
                  {folded.map((u) => {
                    const matchedParticipant = u.userId ? participantRoleByUserId.get(String(u.userId)) : null;
                    const role = String(matchedParticipant?.role || "participant").toLowerCase();
                    const isHost = Number(u.userId) && Number(u.userId) === Number(meeting.host_id);
                    const roleLabel = isHost ? "Host" : (role.includes("co") ? "Co-host" : "Member");
                    const roleColor = isHost ? "#f59e0b" : (role.includes("co") ? "#10b981" : theme.palette.text.secondary);
                    return (
                      <Stack
                        key={u.key}
                        direction="row"
                        spacing={1.25}
                        alignItems="center"
                        sx={{ py: 0.5 }}
                      >
                        <Avatar src={u.avatar || undefined} sx={{ width: 36, height: 36 }}>
                          {initialsOf(u.name)}
                        </Avatar>
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {u.name}
                            </Typography>
                            <Chip
                              label={roleLabel}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: 10,
                                fontWeight: 700,
                                bgcolor: alpha(roleColor, 0.14),
                                color: roleColor,
                              }}
                            />
                            {u.stillIn && (
                              <Chip
                                size="small"
                                label="In meeting"
                                sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: alpha("#16a34a", 0.14), color: "#16a34a" }}
                              />
                            )}
                            {u.sessions > 1 && (
                              <Tooltip title={`Joined ${u.sessions} times`}>
                                <Chip
                                  icon={<PiArrowsClockwiseBold size={10} />}
                                  size="small"
                                  label={u.sessions}
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              </Tooltip>
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {u.email || (u.userId ? `User #${u.userId}` : "Guest")}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            <PiUserCheckBold size={10} style={{ verticalAlign: "-1px" }} />{" "}
                            joined {formatTime(u.firstJoinedAt)}
                            {u.lastLeftAt && !u.stillIn ? ` · left ${formatTime(u.lastLeftAt)}` : ""}
                          </Typography>
                        </Stack>
                        <Stack alignItems="flex-end">
                          <Typography variant="caption" color="text.secondary">
                            Time in call
                          </Typography>
                          <Typography variant="body2" fontWeight={700}>
                            {formatDuration(u.totalMs)}
                          </Typography>
                        </Stack>
                      </Stack>
                    );
                  })}
                </Stack>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={1}>
                  {participants.map((p) => {
                    const role = String(p.role || "participant").toLowerCase();
                    const isHost = Number(p.user_id) === Number(meeting.host_id);
                    const roleLabel = isHost ? "Host" : (role.includes("co") ? "Co-host" : "Invited");
                    const roleColor = isHost ? "#f59e0b" : (role.includes("co") ? "#10b981" : theme.palette.text.secondary);
                    return (
                      <Stack key={p.id || p.user_id} direction="row" spacing={1.25} alignItems="center" sx={{ py: 0.5 }}>
                        <Avatar src={p.user_avatar || undefined} sx={{ width: 34, height: 34 }}>
                          {initialsOf(p.user_name || p.display_name)}
                        </Avatar>
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" fontWeight={600} noWrap>
                              {p.user_name || p.display_name || `User #${p.user_id}`}
                            </Typography>
                            <Chip
                              label={roleLabel}
                              size="small"
                              sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: alpha(roleColor, 0.14), color: roleColor }}
                            />
                            {p.rsvp && (
                              <Chip
                                size="small"
                                label={`RSVP: ${p.rsvp}`}
                                variant="outlined"
                                sx={{ height: 18, fontSize: 10 }}
                              />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {p.user_email || p.email || ""}
                          </Typography>
                        </Stack>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Section>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── Small subcomponents ──────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        // On phones we want 2 cards per row (calc((100% - gap) / 2)). On
        // tablets+ all 4 sit on a single row courtesy of flex-wrap + flex:1.
        flex: { xs: "1 1 calc(50% - 6px)", sm: 1 },
        minWidth: { xs: 0, sm: 130 },
        p: 1.5,
        borderRadius: 2,
        bgcolor: alpha(color, theme.palette.mode === "dark" ? 0.12 : 0.06),
        border: `1px solid ${alpha(color, 0.18)}`,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          bgcolor: alpha(color, 0.18),
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={16} />
      </Box>
      <Stack sx={{ minWidth: 0 }}>
        <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.05 }} noWrap>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap>
          {label}
        </Typography>
      </Stack>
    </Box>
  );
};

const Section = ({ title, right, children }) => (
  <Box>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
      <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: 0.7 }}>
        {title}
      </Typography>
      {right}
    </Stack>
    <Box
      sx={{
        bgcolor: (t) => (t.palette.mode === "dark" ? "#0f172a" : "#ffffff"),
        border: (t) => `1px solid ${t.palette.divider}`,
        borderRadius: 2,
        p: 2,
      }}
    >
      {children}
    </Box>
  </Box>
);

const Row = ({ label, value, color, icon: Icon }) => (
  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 0.6 }}>
    {Icon ? (
      <Box sx={{ width: 18, color: color || "text.secondary", flexShrink: 0 }}>
        <Icon size={14} />
      </Box>
    ) : (
      <Box sx={{ width: 18, flexShrink: 0 }} />
    )}
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ width: { xs: 90, sm: 130 }, fontWeight: 600, flexShrink: 0 }}
    >
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{ flex: 1, fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}
    >
      {value}
    </Typography>
  </Stack>
);

export default MeetingDetailsDialog;
