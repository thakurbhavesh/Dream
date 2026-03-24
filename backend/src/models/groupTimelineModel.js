const db = require('../config/database');

const createTimelineEvent = async ({
  group_id,
  actor_user_id,
  target_user_id,
  event_type,
  event_description,
  organization_id,
  status = 'visible',
}, tx = null) => {
  const executor = tx || db;
  const query = `
    INSERT INTO group_timeline (
      group_id,
      actor_user_id,
      target_user_id,
      event_type,
      event_description,
      organization_id,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [
    group_id,
    actor_user_id,
    target_user_id ?? null,
    event_type,
    event_description,
    organization_id,
    status,
  ];
  const { rows } = await executor.query(query, values);
  return rows[0];
};

const findTimeline = async ({
  group_id,
  organization_id,
  event_type,
  status,
  limit = 50,
  offset = 0,
} = {}) => {
  const where = [];
  const values = [];
  let idx = 1;

  if (group_id) {
    where.push(`gt.group_id = $${idx}`);
    values.push(group_id);
    idx += 1;
  }

  if (organization_id) {
    where.push(`gt.organization_id = $${idx}`);
    values.push(organization_id);
    idx += 1;
  }

  if (event_type) {
    where.push(`gt.event_type = $${idx}`);
    values.push(event_type);
    idx += 1;
  }

  if (status) {
    where.push(`gt.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM group_timeline gt
    ${whereSql}
  `;
  const countResult = await db.query(countQuery, values);
  const total = Number(countResult.rows[0]?.total || 0);
  if (!total) return { rows: [], total: 0 };

  const dataValues = [...values, limit, offset];
  const query = `
    SELECT
      gt.*,
      actor.name AS actor_name,
      actor.email AS actor_email,
      target.name AS target_name,
      target.email AS target_email
    FROM group_timeline gt
    LEFT JOIN users actor
      ON actor.user_id = gt.actor_user_id
    LEFT JOIN users target
      ON target.user_id = gt.target_user_id
    ${whereSql}
    ORDER BY gt.event_at DESC, gt.timeline_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, dataValues);
  return { rows, total };
};

module.exports = {
  createTimelineEvent,
  findTimeline,
};

