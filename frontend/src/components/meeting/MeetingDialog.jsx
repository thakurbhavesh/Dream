import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Tabs,
  Tab,
  Box,
  Chip,
  Avatar,
  Checkbox,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Switch,
  FormControlLabel,
  Divider,
  InputAdornment,
  IconButton,
  useTheme,
} from "@mui/material";
import {
  PiVideoCameraBold,
  PiCalendarBold,
  PiLinkBold,
  PiMagnifyingGlassBold,
  PiXBold,
  PiCopyBold,
  PiUsersBold,
} from "react-icons/pi";
import { createMeeting } from "../../services/meetingApi.js";
import useCurrentUser from "../../hooks/useCurrentUser.js";

const MeetingDialog = ({ open, onClose, members = [], organizationId, onMeetingCreated }) => {
  const theme = useTheme();
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState(0); // 0 = instant, 1 = schedule, 2 = join
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [enableVideo, setEnableVideo] = useState(true);
  const [enableAudio, setEnableAudio] = useState(true);
  const [enableWaitingRoom, setEnableWaitingRoom] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState("none");
  const [createdMeeting, setCreatedMeeting] = useState(null);

  // Use organizationId prop (from GeneralApp's activeOrganizationId), fallback to JWT (backend handles it)
  const orgId = (() => {
    const candidates = [organizationId, currentUser?.organization_id, currentUser?.org];
    for (const c of candidates) {
      const num = Number(c);
      if (Number.isFinite(num) && num > 0 && Number.isInteger(num)) return num;
    }
    return undefined; // let backend resolve from JWT
  })();

  const filteredMembers = useMemo(() => {
    if (!Array.isArray(members)) return [];
    const filtered = members.filter((m) => {
      if (!m) return false;
      // Skip self
      if (m.id === currentUser?.id || m.id === currentUser?.user_id) return false;
      // Skip non-user threads (agent-self, etc.) — must have a numeric user_id or dm-<number> id
      const hasUserId = Number(m.user_id || m.userId) > 0;
      const isDmThread = typeof m.id === "string" && /^dm-\d+$/.test(m.id);
      if (!hasUserId && !isDmThread) return false;
      return true;
    });
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(
      (m) =>
        (m.label || m.name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q)
    );
  }, [members, currentUser, searchQuery]);

  const toggleMember = (member) => {
    setSelectedMembers((prev) => {
      const exists = prev.find((m) => m.id === member.id);
      if (exists) return prev.filter((m) => m.id !== member.id);
      return [...prev, member];
    });
  };

  const handleCreateInstant = async () => {
    setLoading(true);
    try {
      const result = await createMeeting({
        organization_id: orgId,
        title: title.trim() || "Quick Meeting",
        description,
        meeting_type: "instant",
        settings: {
          video: enableVideo,
          audio: enableAudio,
          screenShare: true,
          chat: true,
          whiteboard: true,
          waitingRoom: enableWaitingRoom,
          maxParticipants: 50,
        },
        passcode: passcode.trim() || undefined,
        participants: selectedMembers
          .map((m) => {
            // Extract real numeric user_id from thread objects
            // Threads have: id="dm-2" and user_id=2, or id="agent-self" etc.
            const candidates = [m.user_id, m.userId, m.receiver_id, m.peer_id];
            // Try extracting from "dm-<number>" format
            if (typeof m.id === "string" && /^dm-\d+$/.test(m.id)) {
              candidates.push(m.id.replace("dm-", ""));
            }
            let uid = null;
            for (const c of candidates) {
              const n = Number(c);
              if (Number.isFinite(n) && n > 0 && Number.isInteger(n)) { uid = n; break; }
            }
            if (!uid) return null; // skip non-user entries like "agent-self"
            return {
              user_id: uid,
              display_name: m.label || m.name,
              email: m.email,
            };
          })
          .filter(Boolean),
      });
      const meetingWithParticipants = { ...result.meeting, participants: result.participants };
      setCreatedMeeting(meetingWithParticipants);
      onMeetingCreated?.(meetingWithParticipants, "instant");
    } catch (err) {
      console.error("Create meeting failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledDate || !scheduledTime) return;
    setLoading(true);
    try {
      const scheduled_at = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      const result = await createMeeting({
        organization_id: orgId,
        title: title.trim() || "Scheduled Meeting",
        description,
        meeting_type: "scheduled",
        scheduled_at,
        settings: {
          video: enableVideo,
          audio: enableAudio,
          screenShare: true,
          chat: true,
          whiteboard: true,
          waitingRoom: enableWaitingRoom,
          maxParticipants: 50,
        },
        passcode: passcode.trim() || undefined,
        recurrence_rule: recurrenceRule,
        participants: selectedMembers
          .map((m) => {
            // Extract real numeric user_id from thread objects
            // Threads have: id="dm-2" and user_id=2, or id="agent-self" etc.
            const candidates = [m.user_id, m.userId, m.receiver_id, m.peer_id];
            // Try extracting from "dm-<number>" format
            if (typeof m.id === "string" && /^dm-\d+$/.test(m.id)) {
              candidates.push(m.id.replace("dm-", ""));
            }
            let uid = null;
            for (const c of candidates) {
              const n = Number(c);
              if (Number.isFinite(n) && n > 0 && Number.isInteger(n)) { uid = n; break; }
            }
            if (!uid) return null; // skip non-user entries like "agent-self"
            return {
              user_id: uid,
              display_name: m.label || m.name,
              email: m.email,
            };
          })
          .filter(Boolean),
      });
      const meetingWithParticipants = { ...result.meeting, participants: result.participants };
      setCreatedMeeting(meetingWithParticipants);
      onMeetingCreated?.(meetingWithParticipants, "scheduled");
    } catch (err) {
      console.error("Schedule meeting failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = () => {
    if (!joinCode.trim()) return;
    onMeetingCreated?.({ meeting_id: joinCode.trim().toUpperCase() }, "join");
    handleClose();
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setScheduledDate("");
    setScheduledTime("");
    setJoinCode("");
    setPasscode("");
    setRecurrenceRule("none");
    setSelectedMembers([]);
    setSearchQuery("");
    setCreatedMeeting(null);
    setTab(0);
    setLoading(false);
    onClose?.();
  };

  const copyMeetingId = () => {
    if (createdMeeting?.meeting_id) {
      navigator.clipboard.writeText(createdMeeting.meeting_id);
    }
  };

  // After meeting created — show success with meeting ID
  if (createdMeeting) {
    return (
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: "center", pt: 3 }}>
          Meeting Created!
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center", pb: 1 }}>
          <Box
            sx={{
              bgcolor: theme.palette.primary.lighter || "#e3f2fd",
              borderRadius: 2,
              p: 2,
              mb: 2,
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Meeting ID
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1}>
              <Typography variant="h5" fontWeight={700} color="primary">
                {createdMeeting.meeting_id}
              </Typography>
              <IconButton size="small" onClick={copyMeetingId}>
                <PiCopyBold size={18} />
              </IconButton>
            </Stack>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Share this ID with participants to join the meeting
          </Typography>
          {createdMeeting.meeting_type === "scheduled" && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Scheduled: {new Date(createdMeeting.scheduled_at).toLocaleString()}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3, gap: 1 }}>
          {createdMeeting.meeting_type === "instant" && (
            <Button
              variant="contained"
              startIcon={<PiVideoCameraBold />}
              onClick={() => {
                onMeetingCreated?.(createdMeeting, "join-now");
                handleClose();
              }}
            >
              Join Now
            </Button>
          )}
          <Button variant="outlined" onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle component="div" sx={{ pb: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" fontWeight={700}>Meeting</Typography>
        <IconButton size="small" onClick={handleClose}>
          <PiXBold size={18} />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
          <Tab icon={<PiVideoCameraBold size={16} />} iconPosition="start" label="Instant" sx={{ minHeight: 48, textTransform: "none" }} />
          <Tab icon={<PiCalendarBold size={16} />} iconPosition="start" label="Schedule" sx={{ minHeight: 48, textTransform: "none" }} />
          <Tab icon={<PiLinkBold size={16} />} iconPosition="start" label="Join" sx={{ minHeight: 48, textTransform: "none" }} />
        </Tabs>
      </Box>

      <DialogContent sx={{ pt: 1 }}>
        {/* ─── Join by code ───────────────────────────────── */}
        {tab === 2 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Enter a meeting ID to join an existing meeting
            </Typography>
            <TextField
              fullWidth
              label="Meeting ID"
              placeholder="e.g. MTG-AB12CD"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              inputProps={{ style: { letterSpacing: 2, fontWeight: 600 } }}
            />
          </Stack>
        )}

        {/* ─── Instant / Schedule shared fields ──────────── */}
        {tab !== 2 && (
          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Meeting Title"
              placeholder={tab === 0 ? "Quick Meeting" : "Team Standup"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextField
              fullWidth
              label="Description (optional)"
              placeholder="What is this meeting about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              minRows={2}
              maxRows={3}
            />

            {/* Schedule fields */}
            {tab === 1 && (
              <>
                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    fullWidth
                    type="time"
                    label="Time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>
                <TextField
                  select
                  label="Repeat"
                  size="small"
                  value={recurrenceRule}
                  onChange={(e) => setRecurrenceRule(e.target.value)}
                  SelectProps={{ native: true }}
                  sx={{ maxWidth: 200 }}
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </TextField>
              </>
            )}

            {/* Settings */}
            <Divider />
            <Typography variant="subtitle2">Settings</Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <FormControlLabel
                control={<Switch checked={enableVideo} onChange={(e) => setEnableVideo(e.target.checked)} size="small" />}
                label="Video"
              />
              <FormControlLabel
                control={<Switch checked={enableAudio} onChange={(e) => setEnableAudio(e.target.checked)} size="small" />}
                label="Audio"
              />
              <FormControlLabel
                control={<Switch checked={enableWaitingRoom} onChange={(e) => setEnableWaitingRoom(e.target.checked)} size="small" />}
                label="Waiting Room"
              />
            </Stack>
            <TextField
              label="Passcode (optional, 4–12 chars)"
              size="small"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.slice(0, 12))}
              placeholder="Leave empty for no passcode"
              helperText="Joiners will need to enter this passcode"
              inputProps={{ maxLength: 12 }}
              sx={{ maxWidth: 320 }}
            />

            {/* Invite participants */}
            <Divider />
            <Stack direction="row" alignItems="center" spacing={1}>
              <PiUsersBold size={18} />
              <Typography variant="subtitle2">Invite Participants</Typography>
              {selectedMembers.length > 0 && (
                <Chip label={selectedMembers.length} size="small" color="primary" />
              )}
            </Stack>

            {/* Selected chips */}
            {selectedMembers.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {selectedMembers.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.label || m.name}
                    size="small"
                    avatar={<Avatar src={m.avatar || m.profilePicture} sx={{ width: 20, height: 20 }} />}
                    onDelete={() => toggleMember(m)}
                  />
                ))}
              </Stack>
            )}

            <TextField
              fullWidth
              size="small"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PiMagnifyingGlassBold size={16} />
                  </InputAdornment>
                ),
              }}
            />

            <List dense sx={{ maxHeight: 200, overflow: "auto", bgcolor: theme.palette.background.neutral || theme.palette.action.hover, borderRadius: 1 }}>
              {filteredMembers.map((m) => (
                <ListItem key={m.id} disablePadding>
                  <ListItemButton onClick={() => toggleMember(m)} dense>
                    <Checkbox
                      edge="start"
                      checked={!!selectedMembers.find((s) => s.id === m.id)}
                      size="small"
                    />
                    <ListItemAvatar sx={{ minWidth: 36 }}>
                      <Avatar src={m.avatar || m.profilePicture} sx={{ width: 28, height: 28 }} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={m.label || m.name}
                      secondary={m.email}
                      primaryTypographyProps={{ variant: "body2" }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
              {filteredMembers.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ p: 2, textAlign: "center", display: "block" }}>
                  No members found
                </Typography>
              )}
            </List>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">Cancel</Button>
        {tab === 0 && (
          <Button
            variant="contained"
            startIcon={<PiVideoCameraBold />}
            onClick={handleCreateInstant}
            disabled={loading}
          >
            {loading ? "Creating..." : "Start Meeting"}
          </Button>
        )}
        {tab === 1 && (
          <Button
            variant="contained"
            startIcon={<PiCalendarBold />}
            onClick={handleSchedule}
            disabled={loading || !scheduledDate || !scheduledTime}
          >
            {loading ? "Scheduling..." : "Schedule Meeting"}
          </Button>
        )}
        {tab === 2 && (
          <Button
            variant="contained"
            startIcon={<PiLinkBold />}
            onClick={handleJoinByCode}
            disabled={!joinCode.trim()}
          >
            Join Meeting
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MeetingDialog;
