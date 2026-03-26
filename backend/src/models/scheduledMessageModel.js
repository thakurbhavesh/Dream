const db = require('../config/database');

/**
 * Create a scheduled message.
 */
const create = async (userId, orgId, threadId, message, messageType, metadata, sendAt) => {
  const { rows } = await db.query(
    `INSERT INTO scheduled_messages (user_id, organization_id, thread_id, message, message_type, metadata, send_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING *`,
    [userId, orgId, threadId, message, messageType || 'text', metadata ? JSON.stringify(metadata) : null, sendAt]
  );
  return rows[0];
};

/**
 * Get pending scheduled messages for a user.
 */
const getByUser = async (userId, orgId) => {
  const { rows } = await db.query(
    `SELECT * FROM scheduled_messages
     WHERE user_id = $1 AND organization_id = $2 AND status = 'pending'
     ORDER BY send_at ASC`,
    [userId, orgId]
  );
  return rows;
};

/**
 * Get all due messages (ready to send).
 */
const getDueMessages = async () => {
  const { rows } = await db.query(
    `SELECT * FROM scheduled_messages
     WHERE status = 'pending' AND send_at <= NOW()
     ORDER BY send_at ASC
     LIMIT 100`
  );
  return rows;
};

/**
 * Mark a message as sent.
 */
const markSent = async (id) => {
  await db.query(
    `UPDATE scheduled_messages SET status = 'sent' WHERE id = $1`,
    [id]
  );
};

/**
 * Cancel a scheduled message.
 */
const cancel = async (id, userId) => {
  const { rows } = await db.query(
    `UPDATE scheduled_messages SET status = 'cancelled'
     WHERE id = $1 AND user_id = $2 AND status = 'pending'
     RETURNING *`,
    [id, userId]
  );
  return rows[0] || null;
};

/**
 * Get a single scheduled message by id.
 */
const getById = async (id) => {
  const { rows } = await db.query(
    `SELECT * FROM scheduled_messages WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

module.exports = {
  create,
  getByUser,
  getDueMessages,
  markSent,
  cancel,
  getById,
};
