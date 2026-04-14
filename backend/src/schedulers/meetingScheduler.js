const meetingModel = require('../models/meetingModel');
const db = require('../config/database');
const { sendMailAsync } = require('../utils/mail');

const resolveFrontendOrigin = () => {
  const raw = (process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
  return raw.replace(/\/$/, '');
};

const sendReminderForMeeting = async (meeting) => {
  try {
    const origin = resolveFrontendOrigin();
    const link = `${origin}/app/meeting?join=${encodeURIComponent(meeting.meeting_id)}`;
    const when = new Date(meeting.scheduled_at).toLocaleString();

    // Build recipient list: host + all participants with user_id (fetch their emails)
    const { rows: parts } = await db.query(
      `SELECT mp.user_id, u.email, u.name
       FROM meeting_participants mp
       LEFT JOIN users u ON u.user_id = mp.user_id
       WHERE mp.meeting_id = $1 AND u.email IS NOT NULL`,
      [meeting.id]
    );
    // Also guest emails
    const { rows: guests } = await db.query(
      'SELECT email FROM meeting_guests WHERE meeting_id = $1 AND revoked_at IS NULL',
      [meeting.id]
    );
    const recipients = [
      ...parts.filter((p) => p.email).map((p) => p.email),
      ...guests.map((g) => g.email),
    ];
    const uniq = [...new Set(recipients)];
    if (uniq.length === 0) return;

    const subject = `Reminder: ${meeting.title} starts soon`;
    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
        <h2 style="margin: 0 0 8px;">Meeting starts soon</h2>
        <p style="margin: 0 0 16px; color: #555;">Your meeting <b>${meeting.title}</b> starts in under 10 minutes.</p>
        <div style="background:#f5f7fb; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
          <div style="color:#555; font-size:13px;">${when}</div>
          <div style="color:#555; font-size:13px; margin-top:4px;">Meeting ID: <b>${meeting.meeting_id}</b></div>
        </div>
        <a href="${link}" style="display:inline-block; background:#1976d2; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; font-weight:600;">Join Meeting</a>
      </div>
    `;
    for (const email of uniq) {
      sendMailAsync({ to: email, subject, html }).catch(() => {});
    }
    await meetingModel.markReminderSent(meeting.id);
    console.log(`[meeting-reminder] sent for ${meeting.meeting_id} to ${uniq.length} recipient(s)`);
  } catch (err) {
    console.warn('[meeting-reminder] failed:', err.message);
  }
};

// Generate next instance for a recurring meeting after it ends/passes its scheduled time
const rollRecurrence = async () => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM meetings
       WHERE recurrence_rule IS NOT NULL AND recurrence_rule <> 'none'
         AND meeting_type = 'scheduled'
         AND status IN ('ended', 'waiting')
         AND scheduled_at < NOW() - INTERVAL '5 minutes'
         AND (recurrence_until IS NULL OR recurrence_until > NOW())
         AND NOT EXISTS (
           SELECT 1 FROM meetings m2
           WHERE m2.parent_meeting_id = meetings.id OR m2.parent_meeting_id = meetings.parent_meeting_id
         )
       LIMIT 20`
    );
    for (const m of rows) {
      const addDays = m.recurrence_rule === 'daily' ? 1 : m.recurrence_rule === 'weekly' ? 7 : m.recurrence_rule === 'monthly' ? 30 : 0;
      if (!addDays) continue;
      const nextStart = new Date(new Date(m.scheduled_at).getTime() + addDays * 24 * 60 * 60 * 1000);
      if (m.recurrence_until && nextStart > new Date(m.recurrence_until)) continue;
      try {
        const created = await meetingModel.create({
          organization_id: m.organization_id,
          host_id: m.host_id,
          title: m.title,
          description: m.description,
          meeting_type: 'scheduled',
          scheduled_at: nextStart.toISOString(),
          settings: m.settings,
          passcode: m.passcode,
          recurrence_rule: m.recurrence_rule,
          recurrence_until: m.recurrence_until,
          parent_meeting_id: m.parent_meeting_id || m.id,
        });
        // Copy participants
        const parts = await meetingModel.getParticipants(m.id);
        for (const p of parts) {
          if (p.user_id) {
            await meetingModel.addParticipant({
              meeting_id: created.id,
              user_id: p.user_id,
              role: p.role === 'host' ? 'host' : (p.role === 'co-host' ? 'co-host' : 'participant'),
            });
          }
        }
        console.log(`[meeting-recurrence] rolled ${m.meeting_id} → ${created.meeting_id} at ${nextStart.toISOString()}`);
      } catch (err) {
        console.warn('[meeting-recurrence] roll failed:', err.message);
      }
    }
  } catch (err) {
    console.warn('[meeting-recurrence] query failed:', err.message);
  }
};

let _timer = null;
const startMeetingScheduler = () => {
  if (_timer) return;
  const tick = async () => {
    try {
      const due = await meetingModel.findDueReminders(10);
      for (const m of due) await sendReminderForMeeting(m);
      await rollRecurrence();
    } catch (err) {
      console.warn('[meeting-scheduler] tick error:', err.message);
    }
  };
  // First tick after 30s, then every 60s
  setTimeout(tick, 30 * 1000);
  _timer = setInterval(tick, 60 * 1000);
  console.log('[meeting-scheduler] started (60s interval)');
};

const stopMeetingScheduler = () => {
  if (_timer) clearInterval(_timer);
  _timer = null;
};

module.exports = { startMeetingScheduler, stopMeetingScheduler };
