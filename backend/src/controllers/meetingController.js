const jwt = require('jsonwebtoken');
const meetingModel = require('../models/meetingModel');
const { success, failure } = require('../utils/response');
const { sendMailAsync } = require('../utils/mail');
const db = require('../config/database');
const { getIO } = require('../socket');

const MAX_GUESTS_PER_MEETING = 2;
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const resolveFrontendOrigin = () => {
  const raw = (process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
  return raw.replace(/\/$/, '');
};

// Build an iCalendar (.ics) attachment so recipients can add the meeting to Google/Outlook/Apple Calendar
const buildIcsAttachment = ({ meetingCode, title, description, scheduledAt, durationMinutes = 60, joinLink, recurrenceRule }) => {
  if (!scheduledAt) return null;
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const rruleMap = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY' };
  const rrule = rruleMap[recurrenceRule];
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TeamChat//Meeting//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${meetingCode}@teamchat`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escape(title || 'Meeting')}`,
    `DESCRIPTION:${escape((description || '') + (joinLink ? `\n\nJoin: ${joinLink}` : ''))}`,
    joinLink ? `URL:${joinLink}` : null,
    rrule ? `RRULE:${rrule}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return {
    filename: `${meetingCode}.ics`,
    content: lines.join('\r\n'),
    contentType: 'text/calendar; charset=utf-8; method=REQUEST',
  };
};

const sendMemberInviteEmail = async ({ email, meetingTitle, meetingCode, hostName, scheduledAt, description, recurrenceRule }) => {
  const origin = resolveFrontendOrigin();
  const link = `${origin}/app/meeting?join=${encodeURIComponent(meetingCode)}`;
  const when = scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Now';
  const subject = `Meeting invite: ${meetingTitle || 'Meeting'}`;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 8px;">You're invited to a meeting</h2>
      <p style="margin: 0 0 16px; color: #555;">${hostName ? `${hostName} has` : 'You have been'} invited you to a meeting.</p>
      <div style="background:#f5f7fb; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
        <div style="font-weight:600; font-size:18px; margin-bottom:4px;">${meetingTitle || 'Meeting'}</div>
        <div style="color:#555; font-size:13px;">${when}${recurrenceRule && recurrenceRule !== 'none' ? ` • Repeats ${recurrenceRule}` : ''}</div>
        <div style="color:#555; font-size:13px; margin-top:4px;">Meeting ID: <b>${meetingCode}</b></div>
      </div>
      <a href="${link}" style="display:inline-block; background:#1976d2; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600;">Open Meetings</a>
      <p style="margin: 20px 0 6px; color:#555; font-size:13px;">Calendar file (.ics) is attached — click to add to Google / Outlook / Apple Calendar.</p>
    </div>
  `;
  const ics = buildIcsAttachment({
    meetingCode, title: meetingTitle, description, scheduledAt, joinLink: link, recurrenceRule,
  });
  try {
    await sendMailAsync({ to: email, subject, html, attachments: ics ? [ics] : undefined });
  } catch (err) {
    console.warn('[meeting] member invite mail failed:', err.message);
  }
};

const sendGuestInviteEmail = async ({ email, meetingTitle, meetingCode, accessToken, accessCode, hostName, scheduledAt }) => {
  const origin = resolveFrontendOrigin();
  const link = `${origin}/guest/${accessToken}`;
  const when = scheduledAt ? new Date(scheduledAt).toLocaleString() : 'Now';
  const subject = `You're invited: ${meetingTitle || 'Meeting'}`;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 8px;">Meeting Invitation</h2>
      <p style="margin: 0 0 16px; color: #555;">${hostName ? `${hostName} has` : 'You have been'} invited you to a meeting.</p>
      <div style="background:#f5f7fb; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
        <div style="font-weight:600; font-size:18px; margin-bottom:4px;">${meetingTitle || 'Meeting'}</div>
        <div style="color:#555; font-size:13px;">${when}</div>
        <div style="color:#555; font-size:13px; margin-top:4px;">Meeting ID: <b>${meetingCode}</b></div>
      </div>
      <a href="${link}" style="display:inline-block; background:#1976d2; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600;">Join Meeting</a>
      <p style="margin: 20px 0 6px; color:#555; font-size:13px;">Or paste this link: <br/><a href="${link}" style="color:#1976d2; word-break: break-all;">${link}</a></p>
      <p style="margin: 12px 0 6px; color:#555; font-size:13px;">When prompted, enter this access code:</p>
      <div style="font-size:28px; font-weight:700; letter-spacing:6px; color:#1976d2;">${accessCode}</div>
      <p style="margin-top:28px; color:#999; font-size:12px;">You are joining as an external guest — no account required.</p>
    </div>
  `;
  const ics = buildIcsAttachment({
    meetingCode, title: meetingTitle, scheduledAt, joinLink: link,
  });
  try {
    await sendMailAsync({ to: email, subject, html, attachments: ics ? [ics] : undefined });
  } catch (err) {
    console.warn('[meeting] guest invite mail failed:', err.message);
  }
};

const resolveUser = (req) => {
  const userId = Number(req.user?.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    const err = new Error('Valid user context required');
    err.status = 401;
    throw err;
  }
  // Try multiple sources, but only accept valid positive integers
  const candidates = [req.body?.organization_id, req.query?.organization_id, req.user?.org];
  let orgId = null;
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0 && Number.isInteger(n)) { orgId = n; break; }
  }
  if (!orgId) {
    const err = new Error('organization_id required');
    err.status = 400;
    throw err;
  }
  return { userId, orgId };
};

// POST /meetings — create meeting
const createMeeting = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const { title, description, meeting_type, scheduled_at, settings, participants, passcode, recurrence_rule, recurrence_until } = req.body;

    const meeting = await meetingModel.create({
      organization_id: orgId,
      host_id: userId,
      title: title || 'Untitled Meeting',
      description,
      meeting_type: meeting_type || 'instant',
      scheduled_at,
      settings,
      passcode,
      recurrence_rule,
      recurrence_until,
    });

    // Add host as participant
    await meetingModel.addParticipant({
      meeting_id: meeting.id,
      user_id: userId,
      role: 'host',
    });

    // Add invited participants
    const invitedUserIds = [];
    if (Array.isArray(participants)) {
      for (const p of participants) {
        const pid = Number(p.user_id || p.id);
        await meetingModel.addParticipant({
          meeting_id: meeting.id,
          user_id: pid || null,
          email: p.email,
          display_name: p.display_name || p.name,
          role: p.role || 'participant',
        });
        if (Number.isFinite(pid) && pid > 0 && pid !== userId) invitedUserIds.push(pid);
      }
    }

    // Fire-and-forget member invite emails
    if (invitedUserIds.length) {
      (async () => {
        try {
          const { rows } = await db.query(
            'SELECT user_id, email FROM users WHERE user_id = ANY($1::bigint[])',
            [invitedUserIds]
          );
          for (const u of rows) {
            if (!u.email) continue;
            sendMemberInviteEmail({
              email: u.email,
              meetingTitle: meeting.title,
              meetingCode: meeting.meeting_id,
              hostName: req.user?.name,
              scheduledAt: meeting.scheduled_at,
              description: meeting.description,
              recurrenceRule: meeting.recurrence_rule,
            }).catch(() => {});
          }
        } catch (err) {
          console.warn('[meeting] member invite lookup failed:', err.message);
        }
      })();
    }

    // External guests — save + email invite with link + code
    const guestEmails = Array.isArray(req.body.guest_emails) ? req.body.guest_emails : [];
    const validGuestEmails = [...new Set(
      guestEmails
        .map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
        .filter((e) => e && emailRx.test(e))
    )].slice(0, MAX_GUESTS_PER_MEETING);

    const createdGuests = [];
    for (const gEmail of validGuestEmails) {
      try {
        const guest = await meetingModel.addGuest({
          meeting_id: meeting.id,
          email: gEmail,
          display_name: null,
          invited_by: userId,
        });
        createdGuests.push(guest);
        // fire-and-forget email
        sendGuestInviteEmail({
          email: gEmail,
          meetingTitle: meeting.title,
          meetingCode: meeting.meeting_id,
          accessToken: guest.access_token,
          accessCode: guest.access_code,
          hostName: req.user?.name,
          scheduledAt: meeting.scheduled_at,
        }).catch(() => {});
      } catch (err) {
        console.warn('[meeting] addGuest failed:', err.message);
      }
    }

    const allParticipants = await meetingModel.getParticipants(meeting.id);
    return success(res, {
      meeting,
      participants: allParticipants,
      guests: createdGuests.map((g) => ({
        guest_id: g.guest_id, email: g.email, access_code: g.access_code,
      })),
    }, 'Meeting created', 201);
  } catch (error) {
    return next(error);
  }
};

// ─── External guest (public) endpoints ───────────────────────────────────────

// GET /meetings/guest/:token — minimal meeting info (no code required)
const getGuestMeeting = async (req, res, next) => {
  try {
    const guest = await meetingModel.getGuestByToken(req.params.token);
    if (!guest) return failure(res, 'Invalid or expired invite', 404);
    if (guest.revoked_at) return failure(res, 'Invite revoked', 403);
    return success(res, {
      meeting: {
        meeting_id: guest.meeting_code,
        title: guest.title,
        status: guest.status,
        scheduled_at: guest.scheduled_at,
        host_name: guest.host_name,
      },
      guest: { email: guest.email, display_name: guest.display_name },
    }, 'Guest invite found');
  } catch (error) { return next(error); }
};

// POST /meetings/guest/:token/verify — body { code, display_name? }
// Issues short-lived guest JWT for socket handshake
const verifyGuest = async (req, res, next) => {
  try {
    const guest = await meetingModel.getGuestByToken(req.params.token);
    if (!guest) return failure(res, 'Invalid invite', 404);
    if (guest.revoked_at) return failure(res, 'Invite revoked', 403);
    if (guest.status === 'ended' || guest.status === 'cancelled') {
      return failure(res, 'Meeting has ended', 410);
    }
    const code = String(req.body?.code || '').trim();
    if (!code || code !== guest.access_code) {
      return failure(res, 'Incorrect code', 401);
    }

    // Issue a short-lived guest JWT — socket layer will recognize `guest: true`
    const displayName = (req.body?.display_name || guest.display_name || guest.email.split('@')[0]).toString().slice(0, 80);
    const token = jwt.sign({
      sub: `guest-${guest.guest_id}`,
      guest: true,
      guest_id: guest.guest_id,
      name: displayName,
      email: guest.email,
      meeting_id: guest.meeting_code,
      org: guest.organization_id,
    }, process.env.JWT_SECRET, { expiresIn: '4h' });

    await meetingModel.markGuestJoined(guest.guest_id).catch(() => {});

    return success(res, {
      token,
      meeting: {
        meeting_id: guest.meeting_code,
        title: guest.title,
      },
      display_name: displayName,
    }, 'Verified');
  } catch (error) { return next(error); }
};

// GET /meetings — list org meetings
const getMeetings = async (req, res, next) => {
  try {
    const { orgId } = resolveUser(req);
    const { status: mStatus, limit, offset } = req.query;
    const meetings = await meetingModel.findByOrg(orgId, {
      status: mStatus,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
    return success(res, { meetings }, 'Meetings retrieved');
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/upcoming — upcoming for current user
const getUpcoming = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const meetings = await meetingModel.findUpcoming(orgId, userId);
    return success(res, { meetings }, 'Upcoming meetings');
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/past — ended/past meetings for current user
const getPast = async (req, res, next) => {
  try {
    const { userId, orgId } = resolveUser(req);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const meetings = await meetingModel.findPast(orgId, userId, { limit, offset });
    return success(res, { meetings }, 'Past meetings');
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/:id
const getMeeting = async (req, res, next) => {
  try {
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    const participants = await meetingModel.getParticipants(meeting.id);
    return success(res, { meeting, participants }, 'Meeting details');
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/join/:meetingId — join by code (passcode via ?passcode= or header)
const joinByCode = async (req, res, next) => {
  try {
    const meeting = await meetingModel.findByMeetingId(req.params.meetingId);
    if (!meeting) return failure(res, 'Meeting not found', 404);
    // Passcode enforcement — host bypasses
    if (meeting.passcode) {
      const { userId } = resolveUser(req);
      if (Number(meeting.host_id) !== userId) {
        const provided = String(req.query.passcode || req.headers['x-meeting-passcode'] || '').trim();
        if (provided !== meeting.passcode) {
          return failure(res, 'Passcode required', 401);
        }
      }
    }
    if (meeting.status === 'ended' || meeting.status === 'cancelled') {
      return failure(res, 'Meeting has ended', 410);
    }
    const participants = await meetingModel.getParticipants(meeting.id);
    return success(res, { meeting, participants }, 'Meeting found');
  } catch (error) {
    return next(error);
  }
};

// PATCH /meetings/:id
const updateMeeting = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    if (Number(meeting.host_id) !== userId) return failure(res, 'Only host can update', 403);
    const updated = await meetingModel.update(meeting.id, req.body);
    return success(res, { meeting: updated }, 'Meeting updated');
  } catch (error) {
    return next(error);
  }
};

// PATCH /meetings/:id/status
const changeMeetingStatus = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    const { status: newStatus } = req.body;
    // Only the host can end or cancel a meeting
    if ((newStatus === 'ended' || newStatus === 'cancelled') && Number(meeting.host_id) !== userId) {
      return failure(res, 'Only the host can end this meeting', 403);
    }
    const extra = {};
    if (newStatus === 'active') extra.started_at = new Date();
    if (newStatus === 'ended') {
      extra.ended_at = new Date();
      if (meeting.started_at) {
        extra.duration_minutes = Math.round((Date.now() - new Date(meeting.started_at).getTime()) / 60000);
      }
    }
    const updated = await meetingModel.updateStatus(meeting.id, newStatus, extra);

    // Broadcast end to all participants via socket so UI closes meeting room + stops screen share
    if (newStatus === 'ended' || newStatus === 'cancelled') {
      try {
        const io = getIO();
        if (io && meeting.meeting_id) {
          io.to(`meeting:${meeting.meeting_id}`).emit('meeting:ended', {
            meetingRoomId: meeting.meeting_id,
            endedBy: userId,
          });
        }
      } catch (e) { /* non-fatal */ }
    }
    return success(res, { meeting: updated }, 'Status updated');
  } catch (error) {
    return next(error);
  }
};

// DELETE /meetings/:id
const deleteMeeting = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    if (Number(meeting.host_id) !== userId) return failure(res, 'Only host can delete', 403);
    await meetingModel.remove(meeting.id);
    return success(res, null, 'Meeting deleted');
  } catch (error) {
    return next(error);
  }
};

// PATCH /meetings/:id/co-host — promote/demote participant to co-host (host only)
const setCoHost = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    if (Number(meeting.host_id) !== userId) return failure(res, 'Only the host can assign co-hosts', 403);
    const targetUserId = Number(req.body.user_id);
    const makeCoHost = req.body.co_host !== false;
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) return failure(res, 'user_id required', 400);
    if (targetUserId === userId) return failure(res, 'Host is already the primary host', 400);
    const participants = await meetingModel.getParticipants(meeting.id);
    const target = participants.find((p) => Number(p.user_id) === targetUserId);
    if (!target) return failure(res, 'User is not a participant', 404);
    const updated = await meetingModel.updateParticipant(target.id, {
      role: makeCoHost ? 'co-host' : 'participant',
    });
    return success(res, { participant: updated }, makeCoHost ? 'Promoted to co-host' : 'Demoted to participant');
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/:id/attendance — attendance report (host only)
const getAttendance = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    if (Number(meeting.host_id) !== userId) {
      // Allow co-hosts too
      const parts = await meetingModel.getParticipants(meeting.id);
      const me = parts.find((p) => Number(p.user_id) === userId);
      if (!me || me.role !== 'co-host') return failure(res, 'Only host or co-host can view attendance', 403);
    }
    const sessions = await meetingModel.getAttendanceReport(meeting.id);
    // Aggregate per user: total time, first join, last leave
    const byUser = new Map();
    for (const s of sessions) {
      const key = s.user_id || `guest-${s.display_name || 'anon'}`;
      const left = s.left_at ? new Date(s.left_at).getTime() : Date.now();
      const joined = new Date(s.joined_at).getTime();
      const dur = Math.max(0, Math.round((left - joined) / 1000));
      if (!byUser.has(key)) {
        byUser.set(key, {
          user_id: s.user_id, name: s.user_name || s.display_name || 'Guest',
          email: s.user_email, avatar: s.user_avatar,
          first_join: s.joined_at, last_leave: s.left_at, total_seconds: dur, sessions: 1,
        });
      } else {
        const agg = byUser.get(key);
        agg.total_seconds += dur;
        agg.sessions += 1;
        if (new Date(s.joined_at) < new Date(agg.first_join)) agg.first_join = s.joined_at;
        if (s.left_at && (!agg.last_leave || new Date(s.left_at) > new Date(agg.last_leave))) {
          agg.last_leave = s.left_at;
        }
      }
    }
    return success(res, {
      meeting: { id: meeting.id, title: meeting.title, scheduled_at: meeting.scheduled_at, duration_minutes: meeting.duration_minutes },
      attendees: Array.from(byUser.values()).sort((a, b) => new Date(a.first_join) - new Date(b.first_join)),
      raw_sessions: sessions,
    }, 'Attendance report');
  } catch (error) {
    return next(error);
  }
};

// POST /meetings/:id/rsvp
const rsvp = async (req, res, next) => {
  try {
    const { userId } = resolveUser(req);
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    const participants = await meetingModel.getParticipants(meeting.id);
    const me = participants.find(p => Number(p.user_id) === userId);
    if (!me) return failure(res, 'Not invited', 403);
    const updated = await meetingModel.updateParticipant(me.id, { rsvp: req.body.rsvp });
    return success(res, { participant: updated }, 'RSVP updated');
  } catch (error) {
    return next(error);
  }
};

// POST /meetings/:id/participants
const addParticipant = async (req, res, next) => {
  try {
    const meeting = await meetingModel.findById(Number(req.params.id));
    if (!meeting) return failure(res, 'Meeting not found', 404);
    const participant = await meetingModel.addParticipant({
      meeting_id: meeting.id,
      user_id: req.body.user_id,
      email: req.body.email,
      display_name: req.body.display_name,
      role: req.body.role,
    });
    return success(res, { participant }, 'Participant added', 201);
  } catch (error) {
    return next(error);
  }
};

// GET /meetings/:id/messages
const getMessages = async (req, res, next) => {
  try {
    const messages = await meetingModel.getMessages(Number(req.params.id), {
      limit: Number(req.query.limit) || 100,
      offset: Number(req.query.offset) || 0,
    });
    return success(res, { messages }, 'Messages retrieved');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createMeeting,
  getMeetings,
  getUpcoming,
  getPast,
  getMeeting,
  joinByCode,
  updateMeeting,
  changeMeetingStatus,
  deleteMeeting,
  rsvp,
  addParticipant,
  getMessages,
  getGuestMeeting,
  verifyGuest,
  setCoHost,
  getAttendance,
};
