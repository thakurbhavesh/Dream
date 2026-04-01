const db = require('../config/database');

// Generate short meeting code
const generateMeetingId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'MTG-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const create = async ({ organization_id, host_id, title, description, meeting_type, scheduled_at, settings }) => {
  const meeting_id = generateMeetingId();
  const query = `
    INSERT INTO meetings (meeting_id, organization_id, host_id, title, description, meeting_type, scheduled_at, settings)
    VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::jsonb, '{}'::jsonb))
    RETURNING *
  `;
  const { rows } = await db.query(query, [meeting_id, organization_id, host_id, title, description, meeting_type || 'instant', scheduled_at, settings ? JSON.stringify(settings) : null]);
  return rows[0];
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM meetings WHERE id = $1', [id]);
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
    ORDER BY m.id, COALESCE(m.scheduled_at, m.created_at) ASC
  `;
  const { rows } = await db.query(query, [organization_id, user_id]);
  return rows;
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

module.exports = {
  generateMeetingId,
  create,
  findById,
  findByMeetingId,
  findByOrg,
  findUpcoming,
  updateStatus,
  update,
  remove,
  addParticipant,
  getParticipants,
  updateParticipant,
  removeParticipant,
  addMessage,
  getMessages,
};
