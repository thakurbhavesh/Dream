const db = require('../config/database');

const insert = async ({ organization_id, caller_id, callee_id, call_type = 'audio', outcome, ended_at = null, duration_seconds = null }) => {
  const { rows } = await db.query(
    `INSERT INTO call_logs (organization_id, caller_id, callee_id, call_type, outcome, ended_at, duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [organization_id, caller_id, callee_id, call_type, outcome, ended_at, duration_seconds]
  );
  return rows[0];
};

// Recent call history for a user — both incoming (callee) and outgoing (caller)
// Optionally filter to calls involving a specific peer_id
const getForUser = async (user_id, { limit = 50, offset = 0, peerId = null } = {}) => {
  const params = [user_id];
  let peerClause = '';
  if (peerId) {
    params.push(Number(peerId));
    peerClause = ` AND (cl.caller_id = $${params.length} OR cl.callee_id = $${params.length})`;
  }
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT cl.*,
            CASE WHEN cl.caller_id = $1 THEN 'outgoing' ELSE 'incoming' END AS direction,
            CASE WHEN cl.caller_id = $1 THEN cl.callee_id ELSE cl.caller_id END AS peer_id,
            CASE WHEN cl.caller_id = $1 THEN cu.name ELSE cau.name END AS peer_name,
            CASE WHEN cl.caller_id = $1 THEN cu.profile_url ELSE cau.profile_url END AS peer_avatar
     FROM call_logs cl
     LEFT JOIN users cau ON cau.user_id = cl.caller_id
     LEFT JOIN users cu ON cu.user_id = cl.callee_id
     WHERE (cl.caller_id = $1 OR cl.callee_id = $1)${peerClause}
     ORDER BY cl.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
};

module.exports = { insert, getForUser };
