const db = require('../config/database');

const createSession = async ({
  user_id,
  organization_id,
  refresh_token_hash,
  user_agent,
  ip_address,
  device_id,
  expires_at,
}) => {
  const query = `
    INSERT INTO user_sessions (
      user_id, organization_id, refresh_token_hash, user_agent,
      ip_address, device_id, expires_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [
    user_id,
    organization_id || null,
    refresh_token_hash,
    user_agent || null,
    ip_address || null,
    device_id || null,
    expires_at,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const findByTokenHash = async (refresh_token_hash) => {
  const query = `
    SELECT *
    FROM user_sessions
    WHERE refresh_token_hash = $1
    LIMIT 1
  `;
  const { rows } = await db.query(query, [refresh_token_hash]);
  return rows[0];
};

const markUsed = async (session_id) => {
  await db.query('UPDATE user_sessions SET last_used_at = NOW() WHERE session_id = $1', [session_id]);
};

const revokeById = async (session_id) => {
  await db.query(
    `UPDATE user_sessions
     SET status = 'revoked', revoked_at = NOW()
     WHERE session_id = $1`,
    [session_id]
  );
};

const revokeByTokenHash = async (refresh_token_hash) => {
  await db.query(
    `UPDATE user_sessions
     SET status = 'revoked', revoked_at = NOW()
     WHERE refresh_token_hash = $1`,
    [refresh_token_hash]
  );
};

const revokeActiveByUserAndDevice = async ({ user_id, device_id }) => {
  if (!user_id || !device_id) return;
  await db.query(
    `UPDATE user_sessions
     SET status = 'revoked', revoked_at = NOW()
     WHERE user_id = $1
       AND device_id = $2
       AND status = 'active'`,
    [user_id, device_id]
  );
};

const revokeAllActiveByUser = async (user_id) => {
  if (!user_id) return;
  await db.query(
    `UPDATE user_sessions
     SET status = 'revoked', revoked_at = NOW()
     WHERE user_id = $1
       AND status = 'active'`,
    [user_id]
  );
};

const countActiveByDevice = async (device_id) => {
  if (!device_id) return 0;
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM user_sessions
     WHERE device_id = $1 AND status = 'active'`,
    [device_id]
  );
  return rows[0]?.total || 0;
};

const hasAnyByUserAndDevice = async ({ user_id, device_id }) => {
  if (!user_id || !device_id) return false;
  const { rows } = await db.query(
    `SELECT 1
     FROM user_sessions
     WHERE user_id = $1
       AND device_id = $2
     LIMIT 1`,
    [user_id, device_id]
  );
  return Boolean(rows[0]);
};

module.exports = {
  createSession,
  findByTokenHash,
  markUsed,
  revokeById,
  revokeByTokenHash,
  revokeActiveByUserAndDevice,
  revokeAllActiveByUser,
  countActiveByDevice,
  hasAnyByUserAndDevice,
};
