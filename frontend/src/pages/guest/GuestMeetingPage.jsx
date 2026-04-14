import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { PiVideoConferenceFill, PiUserBold } from "react-icons/pi";
import { fetchJson } from "../../utils/fetchJson.js";
import { API_BASE_URL } from "../../config/apiBaseUrl.js";
import { SocketProvider } from "../../contexts/SocketContext.jsx";
import { MeetingProvider, useMeetingContext } from "../../contexts/MeetingContext.jsx";
import MeetingRoom from "../../components/meeting/MeetingRoom.jsx";

const GuestMeetingRoomRunner = ({ meetingId, displayName, onLeave }) => {
  const meeting = useMeetingContext();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (started) return;
    setStarted(true);
    meeting.joinMeeting({
      meetingRoomId: meetingId,
      meetingData: { meeting_id: meetingId, title: "Meeting" },
      userName: displayName,
      enableVideo: true,
      enableAudio: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <MeetingRoom userName={displayName} onLeave={onLeave} />;
};

const GuestMeetingPage = () => {
  const theme = useTheme();
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [jwt, setJwt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { response, payload } = await fetchJson(
          `${API_BASE_URL}/meetings/guest/${encodeURIComponent(token)}`
        );
        if (cancelled) return;
        if (!response.ok) {
          setError(payload?.message || "Invalid or expired invite");
        } else {
          setMeeting(payload?.data?.meeting || payload?.meeting);
          const g = payload?.data?.guest || payload?.guest;
          if (g?.email) setGuestEmail(g.email);
          if (g?.display_name) setDisplayName(g.display_name);
        }
      } catch (err) {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleJoin = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!code.trim()) return setError("Enter the 6-digit code from your email");
    if (!displayName.trim()) return setError("Enter your name");
    setSubmitting(true);
    try {
      const { response, payload } = await fetchJson(
        `${API_BASE_URL}/meetings/guest/${encodeURIComponent(token)}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim(), display_name: displayName.trim() }),
        }
      );
      if (!response.ok) {
        setError(payload?.message || "Incorrect code");
        return;
      }
      const issued = payload?.data?.token || payload?.token;
      if (!issued) {
        setError("Could not verify invite");
        return;
      }
      setJwt(issued);
    } catch (err) {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (jwt && meeting?.meeting_id) {
    return (
      <SocketProvider explicitToken={jwt}>
        <MeetingProvider>
          <GuestMeetingRoomRunner
            meetingId={meeting.meeting_id}
            displayName={displayName || "Guest"}
            onLeave={() => setJwt(null)}
          />
        </MeetingProvider>
      </SocketProvider>
    );
  }

  return (
    <Box sx={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      bgcolor: theme.palette.background.default,
      px: 2,
    }}>
      <Paper elevation={0} sx={{
        width: "100%", maxWidth: 420, p: 4,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 3,
      }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 56, height: 56 }}>
            <PiVideoConferenceFill size={28} />
          </Avatar>
          <Typography variant="h5" fontWeight={700}>
            {meeting?.title || "Meeting Invitation"}
          </Typography>
          {meeting?.host_name && (
            <Typography variant="body2" color="text.secondary">
              Hosted by {meeting.host_name}
            </Typography>
          )}
          {meeting?.scheduled_at && (
            <Typography variant="body2" color="text.secondary">
              {new Date(meeting.scheduled_at).toLocaleString()}
            </Typography>
          )}
          {guestEmail && (
            <Typography variant="caption" color="text.secondary">
              Invited as <b>{guestEmail}</b>
            </Typography>
          )}
        </Stack>

        <Box component="form" onSubmit={handleJoin} sx={{ mt: 3 }}>
          <Stack spacing={2}>
            <TextField
              label="Your Name"
              fullWidth
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              InputProps={{
                startAdornment: <PiUserBold style={{ marginRight: 8, opacity: 0.6 }} />,
              }}
            />
            <TextField
              label="Access Code"
              placeholder="6-digit code"
              fullWidth
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputProps={{ style: { letterSpacing: 4, fontWeight: 600, textAlign: "center" }, maxLength: 6 }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting || !code || code.length !== 6 || !displayName.trim()}
              startIcon={<PiVideoConferenceFill />}
            >
              {submitting ? "Joining..." : "Join Meeting"}
            </Button>
          </Stack>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: "block", textAlign: "center" }}>
          You are joining as an external guest — no account required.
        </Typography>
      </Paper>
    </Box>
  );
};

export default GuestMeetingPage;
