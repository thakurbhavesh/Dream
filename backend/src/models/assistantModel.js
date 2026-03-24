const db = require('../config/database');

// ─── Feedback ────────────────────────────────────────────────────────────────
const saveFeedback = async ({ userId, messageText, responseText, rating }) => {
  const { rows } = await db.query(
    `INSERT INTO assistant_feedback (user_id, message_text, response_text, rating)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, messageText || '', responseText || '', rating]
  );
  return rows[0];
};

// ─── Conversations ──────────────────────────────────────────────────────────
const saveConversation = async ({ userId, orgId, title, messages }) => {
  const msgCount = Array.isArray(messages) ? messages.filter(m => m.role === 'user').length : 0;
  const { rows } = await db.query(
    `INSERT INTO assistant_conversations (user_id, org_id, title, messages, message_count)
     VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING conversation_id, title, message_count, created_at`,
    [userId, orgId || null, title || 'New Conversation', JSON.stringify(messages), msgCount]
  );
  return rows[0];
};

const updateConversation = async (conversationId, userId, { title, messages }) => {
  const sets = ['updated_at = NOW()'];
  const values = [];
  let idx = 1;
  if (title !== undefined) { sets.push(`title = $${idx++}`); values.push(title); }
  if (messages !== undefined) {
    sets.push(`messages = $${idx++}::jsonb`);
    values.push(JSON.stringify(messages));
    const msgCount = Array.isArray(messages) ? messages.filter(m => m.role === 'user').length : 0;
    sets.push(`message_count = $${idx++}`);
    values.push(msgCount);
  }
  values.push(conversationId, userId);
  const { rows } = await db.query(
    `UPDATE assistant_conversations SET ${sets.join(', ')}
     WHERE conversation_id = $${idx++} AND user_id = $${idx}
     RETURNING conversation_id, title, message_count, updated_at`,
    values
  );
  return rows[0] || null;
};

const getUserConversations = async (userId, { limit = 20, offset = 0 } = {}) => {
  const { rows } = await db.query(
    `SELECT conversation_id, title, message_count, created_at, updated_at
     FROM assistant_conversations WHERE user_id = $1
     ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return rows;
};

const getConversation = async (conversationId, userId) => {
  const { rows } = await db.query(
    `SELECT * FROM assistant_conversations WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rows[0] || null;
};

const deleteConversation = async (conversationId, userId) => {
  const { rowCount } = await db.query(
    `DELETE FROM assistant_conversations WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  return rowCount > 0;
};

// ─── Usage tracking ─────────────────────────────────────────────────────────
const trackUsage = async ({ userId, orgId, responseMs }) => {
  await db.query(
    `INSERT INTO assistant_usage (user_id, org_id, question_count, avg_response_ms, date)
     VALUES ($1, $2, 1, $3, CURRENT_DATE)
     ON CONFLICT (user_id, org_id, date) DO UPDATE SET
       question_count = assistant_usage.question_count + 1,
       avg_response_ms = (assistant_usage.avg_response_ms * assistant_usage.question_count + $3) / (assistant_usage.question_count + 1)`,
    [userId, orgId || null, responseMs || 0]
  );
};

const getUsageStats = async ({ orgId, days = 30 } = {}) => {
  const { rows } = await db.query(
    `SELECT date, SUM(question_count) as total_questions, COUNT(DISTINCT user_id) as unique_users,
            AVG(avg_response_ms)::int as avg_ms
     FROM assistant_usage
     WHERE ($1::bigint IS NULL OR org_id = $1) AND date >= CURRENT_DATE - $2::int
     GROUP BY date ORDER BY date DESC`,
    [orgId || null, days]
  );
  return rows;
};

// ─── Rate Limiting ──────────────────────────────────────────────────────────
// Check if user is within rate limit (50 requests/hour default)
const checkRateLimit = async (userId, orgId, maxPerHour = 50) => {
  const windowStart = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  // Try to get or create rate record
  const { rows } = await db.query(
    `SELECT request_count, window_start FROM assistant_rate_limits
     WHERE user_id = $1 AND organization_id = $2`,
    [userId, orgId]
  );
  if (!rows.length) {
    // First request
    await db.query(
      `INSERT INTO assistant_rate_limits (user_id, organization_id, window_start, request_count)
       VALUES ($1, $2, NOW(), 1) ON CONFLICT (user_id, organization_id) DO NOTHING`,
      [userId, orgId]
    );
    return { allowed: true, remaining: maxPerHour - 1, limit: maxPerHour };
  }
  const record = rows[0];
  if (new Date(record.window_start) < windowStart) {
    // Window expired — reset
    await db.query(
      `UPDATE assistant_rate_limits SET window_start = NOW(), request_count = 1
       WHERE user_id = $1 AND organization_id = $2`,
      [userId, orgId]
    );
    return { allowed: true, remaining: maxPerHour - 1, limit: maxPerHour };
  }
  if (record.request_count >= maxPerHour) {
    return { allowed: false, remaining: 0, limit: maxPerHour };
  }
  // Increment
  await db.query(
    `UPDATE assistant_rate_limits SET request_count = request_count + 1
     WHERE user_id = $1 AND organization_id = $2`,
    [userId, orgId]
  );
  return { allowed: true, remaining: maxPerHour - record.request_count - 1, limit: maxPerHour };
};

// ─── Broadcasts ─────────────────────────────────────────────────────────────
const createBroadcast = async ({ orgId, message, priority, createdBy, expiresAt }) => {
  const { rows } = await db.query(
    `INSERT INTO assistant_broadcasts (organization_id, message, priority, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [orgId, message, priority || 'normal', createdBy, expiresAt || null]
  );
  return rows[0];
};

const getActiveBroadcasts = async (orgId) => {
  const { rows } = await db.query(
    `SELECT * FROM assistant_broadcasts
     WHERE organization_id = $1 AND is_active = true
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY priority = 'urgent' DESC, priority = 'high' DESC, created_at DESC`,
    [orgId]
  );
  return rows;
};

const updateBroadcast = async (broadcastId, orgId, updates) => {
  const fields = [];
  const values = [];
  let idx = 3;
  if (updates.message !== undefined) { fields.push(`message = $${idx++}`); values.push(updates.message); }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(updates.is_active); }
  if (updates.priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(updates.priority); }
  if (updates.expires_at !== undefined) { fields.push(`expires_at = $${idx++}`); values.push(updates.expires_at); }
  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  const { rows } = await db.query(
    `UPDATE assistant_broadcasts SET ${fields.join(', ')} WHERE broadcast_id = $1 AND organization_id = $2 RETURNING *`,
    [broadcastId, orgId, ...values]
  );
  return rows[0] || null;
};

const deleteBroadcast = async (broadcastId, orgId) => {
  const { rows } = await db.query(
    `DELETE FROM assistant_broadcasts WHERE broadcast_id = $1 AND organization_id = $2 RETURNING broadcast_id`,
    [broadcastId, orgId]
  );
  return rows.length > 0;
};

// ─── Knowledge Base ─────────────────────────────────────────────────────────
const createKnowledge = async ({ orgId, title, content, category, createdBy }) => {
  const { rows } = await db.query(
    `INSERT INTO assistant_knowledge (organization_id, title, content, category, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [orgId, title, content, category || 'general', createdBy]
  );
  return rows[0];
};

const getActiveKnowledge = async (orgId) => {
  const { rows } = await db.query(
    `SELECT knowledge_id, title, content, category FROM assistant_knowledge
     WHERE organization_id = $1 AND is_active = true ORDER BY category, title`,
    [orgId]
  );
  return rows;
};

const getAllKnowledge = async (orgId) => {
  const { rows } = await db.query(
    `SELECT ak.*, u.name AS created_by_name FROM assistant_knowledge ak
     LEFT JOIN users u ON u.user_id = ak.created_by
     WHERE ak.organization_id = $1 ORDER BY ak.updated_at DESC`,
    [orgId]
  );
  return rows;
};

const updateKnowledge = async (knowledgeId, orgId, updates) => {
  const fields = [];
  const values = [];
  let idx = 3;
  if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title); }
  if (updates.content !== undefined) { fields.push(`content = $${idx++}`); values.push(updates.content); }
  if (updates.category !== undefined) { fields.push(`category = $${idx++}`); values.push(updates.category); }
  if (updates.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(updates.is_active); }
  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  const { rows } = await db.query(
    `UPDATE assistant_knowledge SET ${fields.join(', ')} WHERE knowledge_id = $1 AND organization_id = $2 RETURNING *`,
    [knowledgeId, orgId, ...values]
  );
  return rows[0] || null;
};

const deleteKnowledge = async (knowledgeId, orgId) => {
  const { rows } = await db.query(
    `DELETE FROM assistant_knowledge WHERE knowledge_id = $1 AND organization_id = $2 RETURNING knowledge_id`,
    [knowledgeId, orgId]
  );
  return rows.length > 0;
};

// ─── Conversation Search ────────────────────────────────────────────────────
const searchConversations = async (userId, query, { limit = 20, offset = 0 } = {}) => {
  const { rows } = await db.query(
    `SELECT conversation_id, title, message_count, created_at, updated_at
     FROM assistant_conversations
     WHERE user_id = $1 AND (
       title ILIKE '%' || $2 || '%'
       OR messages::text ILIKE '%' || $2 || '%'
     )
     ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
    [userId, query, limit, offset]
  );
  return rows;
};

// ─── Export Conversation ────────────────────────────────────────────────────
const getConversationForExport = async (conversationId, userId) => {
  const { rows } = await db.query(
    `SELECT ac.*, u.name AS user_name, o.organization_name
     FROM assistant_conversations ac
     LEFT JOIN users u ON u.user_id = ac.user_id
     LEFT JOIN organizations o ON o.organization_id = ac.org_id
     WHERE ac.conversation_id = $1 AND ac.user_id = $2`,
    [conversationId, userId]
  );
  return rows[0] || null;
};

module.exports = {
  saveFeedback, saveConversation, updateConversation,
  getUserConversations, getConversation, deleteConversation,
  trackUsage, getUsageStats,
  checkRateLimit,
  createBroadcast, getActiveBroadcasts, updateBroadcast, deleteBroadcast,
  createKnowledge, getActiveKnowledge, getAllKnowledge, updateKnowledge, deleteKnowledge,
  searchConversations,
  getConversationForExport,
};
