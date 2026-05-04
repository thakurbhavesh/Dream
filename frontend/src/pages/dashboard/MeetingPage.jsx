import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Box,
  Stack,
  Typography,
  Tabs,
  Tab,
  TextField,
  Button,
  Paper,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Checkbox,
  Avatar,
  Chip,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  useTheme,
} from "@mui/material";
import {
  PiVideoConferenceFill,
  PiVideoCameraBold,
  PiCalendarBold,
  PiLinkBold,
  PiMagnifyingGlassBold,
  PiCopyBold,
  PiUsersBold,
  PiEnvelopeBold,
  PiXBold,
  PiArrowLeftBold,
} from "react-icons/pi";
import { createMeeting, joinByCode as joinByCodeApi } from "../../services/meetingApi.js";
import useCurrentUser from "../../hooks/useCurrentUser.js";
import { useSocket } from "../../contexts/SocketContext.jsx";
import { useMeetingContext } from "../../contexts/MeetingContext.jsx";
import MeetingRoom from "../../components/meeting/MeetingRoom.jsx";
import MeetingsList from "../../components/meeting/MeetingsList.jsx";
import { fetchWithAuth } from "../../utils/authApi.js";
import { API_BASE_URL } from "../../config/apiBaseUrl.js";
import { useNavigate } from "react-router-dom";

const MAX_EXTERNAL_GUESTS = 2;
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MeetingPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const socket = useSocket();
  const meeting = useMeetingContext();

  const [tab, setTab] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [enableVideo, setEnableVideo] = useState(true);
  const [enableAudio, setEnableAudio] = useState(true);
  const [enableWaitingRoom, setEnableWaitingRoom] = useState(false);
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestEmails, setGuestEmails] = useState([]);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [meetingRoomOpen, setMeetingRoomOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  const orgId = useMemo(() => {
    const candidates = [currentUser?.organization_id, currentUser?.org];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0 && Number.isInteger(n)) return n;
    }
    return undefined;
  }, [currentUser]);

  // Fetch org users for invite picker
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { response, payload } = await fetchWithAuth(`${API_BASE_URL}/users/directory`);
        if (!response.ok) return;
        // Controller returns { data: { count, rows } } via success() wrapper
        const rows =
          payload?.data?.rows ||
          payload?.data?.users ||
          payload?.rows ||
          payload?.users ||
          (Array.isArray(payload?.data) ? payload.data : []);
        if (cancelled) return;
        const selfId = Number(currentUser?.id || currentUser?.user_id);
        const list = (Array.isArray(rows) ? rows : []).map((u) => {
          const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
          const name = u.name || fullName || u.email || `User #${u.user_id || u.id}`;
          return {
            id: Number(u.user_id || u.id),
            user_id: Number(u.user_id || u.id),
            name,
            label: name,
            email: u.email,
            avatar: u.profile_url || u.avatar || "",
          };
        }).filter((u) => u.id && u.id !== selfId);
        setMembers(list);
      } catch (err) {
        console.warn("[MeetingPage] load users failed", err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentUser]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => (m.name || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const toggleMember = (m) => {
    setSelectedMembers((prev) => {
      const exists = prev.find((x) => x.id === m.id);
      return exists ? prev.filter((x) => x.id !== m.id) : [...prev, m];
    });
  };

  const addGuestEmail = () => {
    const v = guestEmail.trim().toLowerCase();
    if (!v) return;
    if (!emailRx.test(v)) {
      setToast({ open: true, message: "Invalid email address", severity: "error" });
      return;
    }
    if (guestEmails.includes(v)) {
      setToast({ open: true, message: "Already added", severity: "warning" });
      return;
    }
    if (guestEmails.length >= MAX_EXTERNAL_GUESTS) {
      setToast({ open: true, message: `Max ${MAX_EXTERNAL_GUESTS} external guests allowed`, severity: "warning" });
      return;
    }
    setGuestEmails((prev) => [...prev, v]);
    setGuestEmail("");
  };

  const removeGuestEmail = (email) => {
    setGuestEmails((prev) => prev.filter((e) => e !== email));
  };

  const userName = currentUser?.name
    || `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim()
    || "User";

  const buildParticipants = () => selectedMembers
    .map((m) => {
      const uid = Number(m.user_id || m.id);
      if (!uid) return null;
      return { user_id: uid, display_name: m.label || m.name, email: m.email };
    })
    .filter(Boolean);

  const sendInvites = (data) => {
    if (!socket) return;
    const participantIds = (data.participants || [])
      .map((p) => p.user_id)
      .filter((id) => id && String(id) !== String(currentUser?.id));
    if (participantIds.length > 0) {
      socket.emit("meeting:invite", {
        targetUserIds: participantIds,
        meetingId: data.meeting_id,
        meetingTitle: data.title,
        hostName: userName,
        scheduledAt: data.scheduled_at || null,
      });
    }
  };

  const handleCreate = async (type) => {
    setLoading(true);
    try {
      const payload = {
        organization_id: orgId,
        title: title.trim() || (type === "scheduled" ? "Scheduled Meeting" : "Quick Meeting"),
        description,
        meeting_type: type,
        settings: {
          video: enableVideo, audio: enableAudio, screenShare: true,
          chat: true, whiteboard: true, waitingRoom: enableWaitingRoom,
          maxParticipants: 50,
        },
        participants: buildParticipants(),
        guest_emails: guestEmails,
      };
      if (type === "scheduled") {
        if (!scheduledDate || !scheduledTime) {
          setToast({ open: true, message: "Pick date and time", severity: "error" });
          return;
        }
        payload.scheduled_at = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }
      const result = await createMeeting(payload);
      const m = { ...result.meeting, participants: result.participants };
      setCreatedMeeting(m);

      if (type === "instant") {
        sendInvites(m);
        meeting.joinMeeting({
          meetingRoomId: m.meeting_id,
          meetingData: m,
          userName,
          enableVideo: true,
          enableAudio: true,
        });
        setMeetingRoomOpen(true);
      } else {
        sendInvites(m);
        setToast({ open: true, message: "Meeting scheduled!", severity: "success" });
      }
    } catch (err) {
      console.error("Create meeting failed:", err);
      setToast({ open: true, message: err.message || "Failed to create meeting", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    // Validate first — backend returns 410 for ended/cancelled meetings, 404
    // for unknown codes. Only proceed to socket join if the meeting is live.
    try {
      const data = await joinByCodeApi(code);
      const meetingData = data?.meeting || data;
      meeting.joinMeeting({
        meetingRoomId: code,
        meetingData: meetingData || { meeting_id: code, title: "Meeting" },
        userName,
        enableVideo: true,
        enableAudio: true,
      });
      setMeetingRoomOpen(true);
    } catch (err) {
      const msg = err?.message || "Failed to join";
      // joinByCode throws with the backend's failure() message — for ended/
      // cancelled meetings that's "Meeting has ended". Surface it directly.
      const friendly = /ended|cancel|not\s*found/i.test(msg)
        ? "This meeting link has expired."
        : msg;
      setToast({ open: true, message: friendly, severity: "error" });
    }
  };

  const copyCode = useCallback(() => {
    if (createdMeeting?.meeting_id) {
      navigator.clipboard.writeText(createdMeeting.meeting_id).catch(() => {});
      setToast({ open: true, message: "Meeting ID copied", severity: "success" });
    }
  }, [createdMeeting]);

  const resetForm = () => {
    setCreatedMeeting(null);
    setTitle(""); setDescription("");
    setScheduledDate(""); setScheduledTime("");
    setJoinCode("");
    setSelectedMembers([]); setGuestEmails([]); setGuestEmail("");
    setSearchQuery("");
  };

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", bgcolor: theme.palette.background.default, overflow: "auto" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <IconButton onClick={() => navigate("/app")} size="small"><PiArrowLeftBold /></IconButton>
        <PiVideoConferenceFill size={28} color={theme.palette.primary.main} />
        <Typography variant="h5" fontWeight={700}>Meetings</Typography>
      </Stack>

      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 3, p: 3, maxWidth: 1400, width: "100%", mx: "auto" }}>
        {/* Left: form */}
        <Paper elevation={0} sx={{ flex: 2, p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
          {createdMeeting ? (
            <Stack spacing={2} alignItems="center" textAlign="center">
              <PiVideoConferenceFill size={56} color={theme.palette.success.main} />
              <Typography variant="h6" fontWeight={700}>Meeting Created!</Typography>
              <Box sx={{ bgcolor: theme.palette.action.hover, borderRadius: 2, p: 2, width: "100%" }}>
                <Typography variant="caption" color="text.secondary">Meeting ID</Typography>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
                  <Typography variant="h5" fontWeight={700} color="primary" sx={{ letterSpacing: 2 }}>
                    {createdMeeting.meeting_id}
                  </Typography>
                  <IconButton size="small" onClick={copyCode}><PiCopyBold /></IconButton>
                </Stack>
              </Box>
              {createdMeeting.meeting_type === "scheduled" && (
                <Typography variant="body2" color="text.secondary">
                  Scheduled: {new Date(createdMeeting.scheduled_at).toLocaleString()}
                </Typography>
              )}
              <Stack direction="row" spacing={2}>
                {createdMeeting.meeting_type === "instant" && (
                  <Button variant="contained" startIcon={<PiVideoCameraBold />} onClick={() => {
                    meeting.joinMeeting({
                      meetingRoomId: createdMeeting.meeting_id,
                      meetingData: createdMeeting,
                      userName, enableVideo: true, enableAudio: true,
                    });
                    setMeetingRoomOpen(true);
                  }}>Join Now</Button>
                )}
                <Button variant="outlined" onClick={resetForm}>New Meeting</Button>
              </Stack>
            </Stack>
          ) : (
            <>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Tab icon={<PiVideoCameraBold size={18} />} iconPosition="start" label="Instant" sx={{ minHeight: 48, textTransform: "none" }} />
                <Tab icon={<PiCalendarBold size={18} />} iconPosition="start" label="Schedule" sx={{ minHeight: 48, textTransform: "none" }} />
                <Tab icon={<PiLinkBold size={18} />} iconPosition="start" label="Join" sx={{ minHeight: 48, textTransform: "none" }} />
              </Tabs>

              {tab === 2 ? (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">Enter a meeting ID to join an existing meeting</Typography>
                  <TextField
                    fullWidth label="Meeting ID" placeholder="e.g. MTG-AB12CD"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    inputProps={{ style: { letterSpacing: 2, fontWeight: 600 } }}
                  />
                  <Button variant="contained" startIcon={<PiLinkBold />} onClick={handleJoinByCode} disabled={!joinCode.trim()}>
                    Join Meeting
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <TextField fullWidth label="Meeting Title" placeholder={tab === 0 ? "Quick Meeting" : "Team Standup"}
                    value={title} onChange={(e) => setTitle(e.target.value)} />
                  <TextField fullWidth label="Description (optional)" multiline minRows={2} maxRows={3}
                    value={description} onChange={(e) => setDescription(e.target.value)} />

                  {tab === 1 && (
                    <Stack direction="row" spacing={2}>
                      <TextField fullWidth type="date" label="Date" InputLabelProps={{ shrink: true }}
                        value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                      <TextField fullWidth type="time" label="Time" InputLabelProps={{ shrink: true }}
                        value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
                    </Stack>
                  )}

                  <Divider />
                  <Typography variant="subtitle2">Settings</Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap">
                    <FormControlLabel control={<Switch size="small" checked={enableVideo} onChange={(e) => setEnableVideo(e.target.checked)} />} label="Video" />
                    <FormControlLabel control={<Switch size="small" checked={enableAudio} onChange={(e) => setEnableAudio(e.target.checked)} />} label="Audio" />
                    <FormControlLabel control={<Switch size="small" checked={enableWaitingRoom} onChange={(e) => setEnableWaitingRoom(e.target.checked)} />} label="Waiting Room" />
                  </Stack>

                  <Divider />
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PiUsersBold size={18} />
                    <Typography variant="subtitle2">Invite Participants</Typography>
                    {selectedMembers.length > 0 && <Chip label={selectedMembers.length} size="small" color="primary" />}
                  </Stack>

                  {selectedMembers.length > 0 && (
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {selectedMembers.map((m) => (
                        <Chip key={m.id} label={m.label || m.name} size="small"
                          avatar={<Avatar src={m.avatar} sx={{ width: 20, height: 20 }} />}
                          onDelete={() => toggleMember(m)} />
                      ))}
                    </Stack>
                  )}

                  <TextField fullWidth size="small" placeholder="Search org members..."
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><PiMagnifyingGlassBold size={16} /></InputAdornment>,
                    }} />

                  <List dense sx={{ maxHeight: 220, overflow: "auto", bgcolor: theme.palette.action.hover, borderRadius: 1 }}>
                    {filteredMembers.map((m) => (
                      <ListItem key={m.id} disablePadding>
                        <ListItemButton onClick={() => toggleMember(m)} dense>
                          <Checkbox edge="start" checked={!!selectedMembers.find((s) => s.id === m.id)} size="small" />
                          <ListItemAvatar sx={{ minWidth: 36 }}>
                            <Avatar src={m.avatar} sx={{ width: 28, height: 28 }} />
                          </ListItemAvatar>
                          <ListItemText primary={m.label || m.name} secondary={m.email}
                            primaryTypographyProps={{ variant: "body2" }}
                            secondaryTypographyProps={{ variant: "caption" }} />
                        </ListItemButton>
                      </ListItem>
                    ))}
                    {filteredMembers.length === 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: "center", display: "block" }}>
                        No members found
                      </Typography>
                    )}
                  </List>

                  {/* External guests (email invites) */}
                  <Divider />
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PiEnvelopeBold size={18} />
                    <Typography variant="subtitle2">External Guests</Typography>
                    <Chip label={`${guestEmails.length}/${MAX_EXTERNAL_GUESTS}`} size="small"
                      color={guestEmails.length >= MAX_EXTERNAL_GUESTS ? "warning" : "default"} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Invite up to {MAX_EXTERNAL_GUESTS} people by email — they join via link + code without login.
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField fullWidth size="small" placeholder="guest@example.com"
                      value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGuestEmail(); } }}
                      disabled={guestEmails.length >= MAX_EXTERNAL_GUESTS} />
                    <Button variant="outlined" onClick={addGuestEmail}
                      disabled={guestEmails.length >= MAX_EXTERNAL_GUESTS || !guestEmail.trim()}>
                      Add
                    </Button>
                  </Stack>
                  {guestEmails.length > 0 && (
                    <Stack direction="row" flexWrap="wrap" gap={0.5}>
                      {guestEmails.map((e) => (
                        <Chip key={e} label={e} size="small" onDelete={() => removeGuestEmail(e)}
                          icon={<PiEnvelopeBold />} />
                      ))}
                    </Stack>
                  )}

                  <Divider />
                  <Stack direction="row" justifyContent="flex-end" spacing={2}>
                    {tab === 0 && (
                      <Button variant="contained" size="large" startIcon={<PiVideoCameraBold />}
                        onClick={() => handleCreate("instant")} disabled={loading}>
                        {loading ? "Creating..." : "Start Meeting"}
                      </Button>
                    )}
                    {tab === 1 && (
                      <Button variant="contained" size="large" startIcon={<PiCalendarBold />}
                        onClick={() => handleCreate("scheduled")}
                        disabled={loading || !scheduledDate || !scheduledTime}>
                        {loading ? "Scheduling..." : "Schedule Meeting"}
                      </Button>
                    )}
                  </Stack>
                </Stack>
              )}
            </>
          )}
        </Paper>

        {/* Right: upcoming meetings */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 2, height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Upcoming Meetings</Typography>
            <MeetingsList
              onJoinMeeting={async (m) => {
                // Validate the meeting is still active. The host may have
                // ended it after the list loaded; bail out before opening
                // the room if the backend responds 410.
                try {
                  const fresh = await joinByCodeApi(m.meeting_id);
                  const meetingData = fresh?.meeting || m;
                  meeting.joinMeeting({
                    meetingRoomId: m.meeting_id,
                    meetingData,
                    userName, enableVideo: true, enableAudio: true,
                  });
                  setMeetingRoomOpen(true);
                } catch (err) {
                  const msg = err?.message || "Failed to join";
                  const friendly = /ended|cancel|not\s*found/i.test(msg)
                    ? "This meeting has ended."
                    : msg;
                  setToast({ open: true, message: friendly, severity: "error" });
                }
              }}
            />
          </Paper>
        </Box>
      </Box>

      {meetingRoomOpen && (
        <MeetingRoom
          userName={userName}
          userId={currentUser?.id}
          onLeave={() => setMeetingRoomOpen(false)}
        />
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast({ ...toast, open: false })}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MeetingPage;
