const db = require('../config/database');

const createActivityLog = async (payload, tx = null) => {
  const executor = tx || db;
  const query = `
    INSERT INTO activity_log (
      actor_id,
      actor_role_key,
      context_organization_id,
      target_type,
      target_id,
      action,
      action_category,
      action_subtype,
      description,
      old_values,
      new_values,
      ip_address,
      user_agent,
      is_successful,
      status
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::inet, $13, $14, $15
    )
    RETURNING log_id
  `;

  const values = [
    payload.actor_id ?? null,
    payload.actor_role_key || 'system',
    payload.context_organization_id ?? null,
    payload.target_type,
    payload.target_id ?? null,
    payload.action,
    payload.action_category,
    payload.action_subtype ?? null,
    payload.description ?? null,
    payload.old_values ? JSON.stringify(payload.old_values) : null,
    payload.new_values ? JSON.stringify(payload.new_values) : null,
    payload.ip_address ?? null,
    payload.user_agent ?? null,
    payload.is_successful ?? true,
    payload.status || 'success',
  ];

  const { rows } = await executor.query(query, values);
  return rows[0];
};

module.exports = {
  createActivityLog,
  findActivityLogs: async ({
    context_organization_id,
    user_id,
    actor_id,
    action,
    action_category,
    exclude_actions,
    status,
    is_successful,
    search,
    occurred_from,
    occurred_to,
    limit = 50,
    offset = 0,
  }) => {
    const where = [];
    const values = [];
    let idx = 1;

    const pushWhere = (clause, value) => {
      where.push(clause.split('?').join(`$${idx}`));
      values.push(value);
      idx += 1;
    };

    if (context_organization_id !== undefined && context_organization_id !== null) {
      pushWhere('al.context_organization_id = ?', context_organization_id);
    }

    if (user_id !== undefined && user_id !== null) {
      pushWhere('(al.actor_id = ? OR (al.target_type = \'user\' AND al.target_id = ?))', user_id);
    }

    if (actor_id !== undefined && actor_id !== null) {
      pushWhere('al.actor_id = ?', actor_id);
    }

    if (action) {
      pushWhere('al.action = ?', action);
    }

    if (action_category) {
      pushWhere('al.action_category = ?', action_category);
    }

    if (Array.isArray(exclude_actions) && exclude_actions.length) {
      where.push(`al.action NOT IN (${exclude_actions.map(() => `$${idx++}`).join(', ')})`);
      values.push(...exclude_actions);
    }

    if (status) {
      pushWhere('al.status = ?', status);
    }

    if (is_successful !== undefined && is_successful !== null) {
      pushWhere('al.is_successful = ?', is_successful);
    }

    if (occurred_from) {
      pushWhere('al.occurred_at >= ?', occurred_from);
    }

    if (occurred_to) {
      pushWhere('al.occurred_at <= ?', occurred_to);
    }

    if (search) {
      pushWhere(
        `(
          COALESCE(al.description, '') ILIKE ?
          OR COALESCE(al.action, '') ILIKE ?
          OR COALESCE(al.action_category, '') ILIKE ?
          OR COALESCE(al.action_subtype, '') ILIKE ?
          OR EXISTS (
            SELECT 1
            FROM users actor_s
            WHERE actor_s.user_id = al.actor_id
              AND (
                COALESCE(actor_s.email, '') ILIKE ?
                OR COALESCE(actor_s.name, '') ILIKE ?
              )
          )
        )`,
        `%${search}%`
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM activity_log al
      ${whereSql}
    `;

    const countResult = await db.query(countQuery, values);
    const total = Number(countResult.rows[0]?.total || 0);
    if (!total) return { rows: [], total: 0 };

    const dataValues = [...values, limit, offset];
    const dataQuery = `
      WITH paged_logs AS (
        SELECT
          al.log_id,
          al.actor_id,
          al.actor_role_key,
          al.context_organization_id,
          al.target_type,
          al.target_id,
          al.action,
          al.action_category,
          al.action_subtype,
          al.description,
          al.old_values,
          al.new_values,
          al.ip_address,
          al.user_agent,
          al.occurred_at,
          al.is_successful,
          al.status
        FROM activity_log al
        ${whereSql}
        ORDER BY al.occurred_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      )
      SELECT
        pl.log_id,
        pl.actor_id,
        pl.actor_role_key,
        pl.context_organization_id,
        pl.target_type,
        pl.target_id,
        pl.action,
        pl.action_category,
        pl.action_subtype,
        pl.description,
        pl.old_values,
        pl.new_values,
        pl.ip_address,
        pl.user_agent,
        pl.occurred_at,
        pl.is_successful,
        pl.status,
        org.name AS context_organization_name,
        actor.name AS actor_name,
        actor.email AS actor_email,
        target_user.name AS target_user_name,
        target_user.email AS target_user_email,
        COALESCE(target_user.name, actor.name) AS user_name,
        COALESCE(target_user.email, actor.email) AS user_email
      FROM paged_logs pl
      LEFT JOIN organizations org
        ON org.organization_id = pl.context_organization_id
      LEFT JOIN users actor
        ON actor.user_id = pl.actor_id
      LEFT JOIN users target_user
        ON target_user.user_id = pl.target_id
       AND pl.target_type = 'user'
      ORDER BY pl.occurred_at DESC
    `;

    const { rows } = await db.query(dataQuery, dataValues);
    return { rows, total };
  },
};
