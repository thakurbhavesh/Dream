const db = require('../config/database');

const MAX_PINS_PER_USER = 20;

const pin = async (user_id, organization_id, thread_id) => {
  // Enforce a soft cap so a user can't pin unbounded threads
  const { rows: cnt } = await db.query(
    `SELECT COUNT(*)::int AS n FROM user_thread_pins WHERE user_id = $1 AND organization_id = $2`,
    [user_id, organization_id]
  );
  if ((cnt[0]?.n || 0) >= MAX_PINS_PER_USER) {
    const err = new Error(`Max ${MAX_PINS_PER_USER} pinned chats`);
    err.status = 400;
    throw err;
  }
  const { rows } = await db.query(
    `INSERT INTO user_thread_pins (user_id, organization_id, thread_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, organization_id, thread_id) DO UPDATE
       SET pinned_at = NOW()
     RETURNING *`,
    [user_id, organization_id, thread_id]
  );
  return rows[0];
};

const unpin = async (user_id, organization_id, thread_id) => {
  await db.query(
    `DELETE FROM user_thread_pins WHERE user_id = $1 AND organization_id = $2 AND thread_id = $3`,
    [user_id, organization_id, thread_id]
  );
};

const getPinsForUser = async (user_id, organization_id) => {
  const { rows } = await db.query(
    `SELECT thread_id, pinned_at FROM user_thread_pins
     WHERE user_id = $1 AND organization_id = $2
     ORDER BY pinned_at DESC`,
    [user_id, organization_id]
  );
  return rows;
};

module.exports = { pin, unpin, getPinsForUser, MAX_PINS_PER_USER };
