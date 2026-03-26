const db = require('../config/database');

/**
 * Check if a thread is muted for a user (active mute only).
 */
const isMuted = async (userId, orgId, threadId) => {
  const { rows } = await db.query(
    `SELECT 1 FROM user_thread_mutes
     WHERE user_id = $1 AND organization_id = $2 AND thread_id = $3
       AND (mute_until IS NULL OR mute_until > NOW())
     LIMIT 1`,
    [userId, orgId, threadId]
  );
  return rows.length > 0;
};

/**
 * Get all active mutes for a user in an org.
 */
const getMutedThreads = async (userId, orgId) => {
  const { rows } = await db.query(
    `SELECT thread_id, mute_until FROM user_thread_mutes
     WHERE user_id = $1 AND organization_id = $2
       AND (mute_until IS NULL OR mute_until > NOW())`,
    [userId, orgId]
  );
  return rows;
};

/**
 * Upsert a mute for a thread. muteUntil = null means forever.
 */
const upsertMute = async (userId, orgId, threadId, muteUntil) => {
  const { rows } = await db.query(
    `INSERT INTO user_thread_mutes (user_id, organization_id, thread_id, mute_until)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, organization_id, thread_id)
     DO UPDATE SET mute_until = $4, created_at = NOW()
     RETURNING *`,
    [userId, orgId, threadId, muteUntil]
  );
  return rows[0];
};

/**
 * Remove a mute.
 */
const removeMute = async (userId, orgId, threadId) => {
  await db.query(
    `DELETE FROM user_thread_mutes
     WHERE user_id = $1 AND organization_id = $2 AND thread_id = $3`,
    [userId, orgId, threadId]
  );
};

/**
 * Lazy cleanup of expired mutes.
 */
const cleanupExpired = async () => {
  await db.query(
    `DELETE FROM user_thread_mutes WHERE mute_until IS NOT NULL AND mute_until < NOW()`
  );
};

module.exports = {
  isMuted,
  getMutedThreads,
  upsertMute,
  removeMute,
  cleanupExpired,
};
