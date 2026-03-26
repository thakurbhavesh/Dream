const db = require('../config/database');

/**
 * Set/update disappearing message timer for a thread.
 */
const setTimer = async (threadId, orgId, userId, durationSeconds) => {
  const { rows } = await db.query(
    `INSERT INTO disappearing_threads (thread_id, organization_id, set_by, duration_seconds)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (thread_id, organization_id)
     DO UPDATE SET set_by = $3, duration_seconds = $4, created_at = NOW()
     RETURNING *`,
    [threadId, orgId, userId, durationSeconds]
  );
  return rows[0];
};

/**
 * Get the disappearing timer for a thread.
 */
const getTimer = async (threadId, orgId) => {
  const { rows } = await db.query(
    `SELECT * FROM disappearing_threads
     WHERE thread_id = $1 AND organization_id = $2`,
    [threadId, orgId]
  );
  return rows[0] || null;
};

/**
 * Remove the disappearing timer.
 */
const removeTimer = async (threadId, orgId) => {
  await db.query(
    `DELETE FROM disappearing_threads
     WHERE thread_id = $1 AND organization_id = $2`,
    [threadId, orgId]
  );
};

/**
 * Cleanup expired messages from both tables.
 */
const cleanupExpiredMessages = async () => {
  const r1 = await db.query(
    `DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < NOW()`
  );
  const r2 = await db.query(
    `DELETE FROM group_messages WHERE expires_at IS NOT NULL AND expires_at < NOW()`
  );
  return { dmDeleted: r1.rowCount, groupDeleted: r2.rowCount };
};

module.exports = {
  setTimer,
  getTimer,
  removeTimer,
  cleanupExpiredMessages,
};
