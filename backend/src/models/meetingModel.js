const db = require('../config/database');

// Generate short meeting code
const generateMeetingId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MTG-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const create = async ({ organization_id, host_id, title, description, meeting_type, scheduled_at, settings, passcode, recurrence_rule, recurrence_until, parent_meeting_id }) => {
  const meeting_id = generateMeetingId();
  const cleanPasscode = typeof passcode === 'string' && passcode.trim().length >= 4 && passcode.trim().length <= 12
    ? passcode.trim()
    : null;
  const validRules = ['none', 'daily', 'weekly', 'monthly'];
  const rule = validRules.includes(recurrence_rule) ? recurrence_rule : 'none';
  const query = `
    INSERT INTO meetings (meeting_id, organization_id, host_id, title, description, meeting_type, scheduled_at, settings, passcode, recurrence_rule, recurrence_until, parent_meeting_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::jsonb, '{}'::jsonb), $9, $10, $11, $12)
    RETURNING *
  `;
  const { rows } = await db.query(query, [
    meeting_id, organization_id, host_id, title, description,
    meeting_type || 'instant', scheduled_at,
    settings ? JSON.stringify(settings) : null,
    cleanPasscode, rule, recurrence_until || null, parent_meeting_id || null,
  ]);
  return rows[0];
};

// Fetch meetings that need reminder emails (scheduled within next `minutesAhead`, not yet reminded)
const findDueReminders = async (minutesAhead = 10) => {
  const { rows } = await db.query(
    `SELECT * FROM meetings
     WHERE meeting_type = 'scheduled'
       AND status = 'waiting'
       AND reminder_sent_at IS NULL
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= NOW() + ($1 || ' minutes')::INTERVAL
       AND scheduled_at >= NOW() - INTERVAL '2 minutes'
     LIMIT 50`,
    [String(minutesAhead)]
  );
  return rows;
};

const markReminderSent = async (meetingId) => {
  await db.query('UPDATE meetings SET reminder_sent_at = NOW() WHERE id = $1', [meetingId]);
};

// Attendance sessions
const openAttendanceSession = async ({ meeting_id, user_id, display_name, socket_id }) => {
  const { rows } = await db.query(
    `INSERT INTO meeting_attendance_sessions (meeting_id, user_id, display_name, socket_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [meeting_id, user_id || null, display_name || null, socket_id]
  );
  return rows[0];
};

const closeAttendanceSession = async ({ meeting_id, socket_id }) => {
  await db.query(
    `UPDATE meeting_attendance_sessions
     SET left_at = NOW()
     WHERE meeting_id = $1 AND socket_id = $2 AND left_at IS NULL`,
    [meeting_id, socket_id]
  );
};

const getAttendanceReport = async (meeting_id) => {
  const { rows } = await db.query(
    `SELECT mas.*, u.name AS user_name, u.email AS user_email, u.profile_url AS user_avatar
     FROM meeting_attendance_sessions mas
     LEFT JOIN users u ON u.user_id = mas.user_id
     WHERE mas.meeting_id = $1
     ORDER BY mas.joined_at ASC`,
    [meeting_id]
  );
  return rows;
};

const findById = async (id) => {
  // Join host so the details dialog can render name + avatar without a
  // second round trip. Falls back to the raw row if the host user was
  // deleted.
  const { rows } = await db.query(
    `SELECT m.*, u.name AS host_name, u.email AS host_email, u.profile_url AS host_avatar
     FROM meetings m
     LEFT JOIN users u ON u.user_id = m.host_id
     WHERE m.id = $1`,
    [id]
  );
  return rows[0];
};

const findByMeetingId = async (meeting_id) => {
  const { rows } = await db.query('SELECT * FROM meetings WHERE meeting_id = $1', [meeting_id]);
  return rows[0];
};

const findByOrg = async (organization_id, { status, limit = 50, offset = 0 } = {}) => {
  let query = 'SELECT * FROM meetings WHERE organization_id = $1';
  const params = [organization_id];
  if (status) {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }
  query += ' ORDER BY COALESCE(scheduled_at, created_at) DESC';
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const { rows } = await db.query(query, params);
  return rows;
};

const findUpcoming = async (organization_id, user_id) => {
  const query = `
    SELECT DISTINCT ON (m.id) m.* FROM meetings m
    LEFT JOIN meeting_participants mp ON mp.meeting_id = m.id
    WHERE m.organization_id = $1
      AND m.status IN ('waiting', 'active')
      AND (m.host_id = $2 OR mp.user_id = $2)
      AND (
        m.status = 'active'
        OR (m.scheduled_at IS NOT NULL AND m.scheduled_at >= NOW() - INTERVAL '4 hours')
        OR (m.scheduled_at IS NULL AND m.created_at >= NOW() - INTERVAL '4 hours')
      )
    ORDER BY m.id, COALESCE(m.scheduled_at, m.created_at) ASC
  `;
  const { rows } = await db.query(query, [organization_id, user_id]);
  return rows;
};

const findPast = async (organization_id, user_id, { limit = 50, offset = 0 } = {}) => {
  const query = `
    SELECT DISTINCT ON (m.id) m.*,
           u.name AS host_name, u.profile_url AS host_avatar
    FROM meetings m
    LEFT JOIN meeting_participants mp ON mp.meeting_id = m.id
    LEFT JOIN users u ON u.user_id = m.host_id
    WHERE m.organization_id = $1
      AND (m.host_id = $2 OR mp.user_id = $2)
      AND (m.status IN ('ended', 'cancelled')
           OR (m.scheduled_at IS NOT NULL AND m.scheduled_at < NOW() - INTERVAL '4 hours')
           OR (m.status = 'waiting' AND m.scheduled_at IS NULL AND m.created_at < NOW() - INTERVAL '4 hours'))
    ORDER BY m.id, COALESCE(m.ended_at, m.scheduled_at, m.created_at) DESC
    LIMIT $3 OFFSET $4
  `;
  const { rows } = await db.query(query, [organization_id, user_id, limit, offset]);
  // DISTINCT ON forces ORDER BY id first; re-sort for display
  return rows.sort((a, b) => {
    const ta = new Date(a.ended_at || a.scheduled_at || a.created_at).getTime();
    const tb = new Date(b.ended_at || b.scheduled_at || b.created_at).getTime();
    return tb - ta;
  });
};

const updateStatus = async (id, status, extra = {}) => {
  const sets = ['status = $2', 'updated_at = NOW()'];
  const params = [id, status];
  if (extra.started_at) { params.push(extra.started_at); sets.push(`started_at = $${params.length}`); }
  if (extra.ended_at) { params.push(extra.ended_at); sets.push(`ended_at = $${params.length}`); }
  if (extra.duration_minutes != null) { params.push(extra.duration_minutes); sets.push(`duration_minutes = $${params.length}`); }
  const query = `UPDATE meetings SET ${sets.join(', ')} WHERE id = $1 RETURNING *`;
  const { rows } = await db.query(query, params);
  return rows[0];
};

const update = async (id, payload) => {
  const allowed = ['title', 'description', 'scheduled_at', 'settings'];
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(key === 'settings' ? JSON.stringify(payload[key]) : payload[key]);
      idx++;
    }
  }
  if (!fields.length) return null;
  values.push(id);
  fields.push('updated_at = NOW()');
  const query = `UPDATE meetings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const remove = async (id) => {
  const { rows } = await db.query('DELETE FROM meetings WHERE id = $1 RETURNING *', [id]);
  return rows[0];
};

// Participants
const addParticipant = async ({ meeting_id, user_id, email, display_name, role }) => {
  const query = `
    INSERT INTO meeting_participants (meeting_id, user_id, email, display_name, role)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (meeting_id, user_id) WHERE user_id IS NOT NULL DO UPDATE SET role = EXCLUDED.role
    RETURNING *
  `;
  const { rows } = await db.query(query, [meeting_id, user_id, email, display_name, role || 'participant']);
  return rows[0];
};

const getParticipants = async (meeting_id) => {
  const query = `
    SELECT mp.*, u.name AS user_name, u.email AS user_email, u.profile_url AS user_avatar
    FROM meeting_participants mp
    LEFT JOIN users u ON u.user_id = mp.user_id
    WHERE mp.meeting_id = $1
    ORDER BY mp.created_at ASC
  `;
  const { rows } = await db.query(query, [meeting_id]);
  return rows;
};

const updateParticipant = async (id, payload) => {
  const allowed = ['rsvp', 'joined_at', 'left_at', 'role'];
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx++;
    }
  }
  if (!fields.length) return null;
  values.push(id);
  const query = `UPDATE meeting_participants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const removeParticipant = async (meeting_id, user_id) => {
  const { rows } = await db.query(
    'DELETE FROM meeting_participants WHERE meeting_id = $1 AND user_id = $2 RETURNING *',
    [meeting_id, user_id]
  );
  return rows[0];
};

// Meeting messages
const addMessage = async ({ meeting_id, user_id, message, message_type }) => {
  const query = `
    INSERT INTO meeting_messages (meeting_id, user_id, message, message_type)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const { rows } = await db.query(query, [meeting_id, user_id, message, message_type || 'text']);
  return rows[0];
};

const getMessages = async (meeting_id, { limit = 100, offset = 0 } = {}) => {
  const query = `
    SELECT mm.*, u.name AS user_name, u.profile_url AS user_avatar
    FROM meeting_messages mm
    LEFT JOIN users u ON u.user_id = mm.user_id
    WHERE mm.meeting_id = $1
    ORDER BY mm.created_at ASC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await db.query(query, [meeting_id, limit, offset]);
  return rows;
};

// ─── External guests ──────────────────────────────────────────────────────
const crypto = require('crypto');

const generateGuestToken = () => crypto.randomBytes(24).toString('base64url');
const generateGuestCode = () => String(Math.floor(100000 + Math.random() * 900000));

const addGuest = async ({ meeting_id, email, display_name, invited_by }) => {
  const access_token = generateGuestToken();
  const access_code = generateGuestCode();
  const { rows } = await db.query(
    `INSERT INTO meeting_guests (meeting_id, email, display_name, access_token, access_code, invited_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (meeting_id, email) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           access_code = EXCLUDED.access_code,
           display_name = EXCLUDED.display_name,
           invited_by = EXCLUDED.invited_by,
           invited_at = NOW(),
           revoked_at = NULL
     RETURNING *`,
    [meeting_id, email.toLowerCase(), display_name || null, access_token, access_code, invited_by || null]
  );
  return rows[0];
};

const getGuestByToken = async (access_token) => {
  const { rows } = await db.query(
    `SELECT g.*, m.meeting_id AS meeting_code, m.title, m.status, m.scheduled_at,
            m.organization_id, u.name AS host_name
     FROM meeting_guests g
     JOIN meetings m ON m.id = g.meeting_id
     LEFT JOIN users u ON u.user_id = m.host_id
     WHERE g.access_token = $1`,
    [access_token]
  );
  return rows[0] || null;
};

const getGuestsByMeeting = async (meeting_id) => {
  const { rows } = await db.query(
    `SELECT guest_id, meeting_id, email, display_name, access_code, invited_at, joined_at, revoked_at
     FROM meeting_guests WHERE meeting_id = $1 ORDER BY invited_at ASC`,
    [meeting_id]
  );
  return rows;
};

const countGuestsByMeeting = async (meeting_id) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS cnt FROM meeting_guests WHERE meeting_id = $1 AND revoked_at IS NULL`,
    [meeting_id]
  );
  return rows[0]?.cnt || 0;
};

const markGuestJoined = async (guest_id) => {
  await db.query(`UPDATE meeting_guests SET joined_at = NOW() WHERE guest_id = $1`, [guest_id]);
};

module.exports = {
  generateMeetingId,
  create,
  findById,
  findByMeetingId,
  findByOrg,
  findUpcoming,
  findPast,
  updateStatus,
  update,
  remove,
  addParticipant,
  getParticipants,
  updateParticipant,
  removeParticipant,
  addMessage,
  getMessages,
  addGuest,
  getGuestByToken,
  getGuestsByMeeting,
  countGuestsByMeeting,
  markGuestJoined,
  findDueReminders,
  markReminderSent,
  openAttendanceSession,
  closeAttendanceSession,
  getAttendanceReport,
};
