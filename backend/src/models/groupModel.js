const db = require('../config/database');

const createGroup = async ({
  organization_id,
  group_name,
  group_description,
  group_image,
  created_by,
  is_airtime,
  status,
}, tx = null) => {
  const executor = tx || db;
  const query = `
    INSERT INTO groups (
      organization_id,
      group_name,
      group_description,
      group_image,
      created_by,
      is_airtime,
      status
    )
    VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), COALESCE($7, 'active'))
    RETURNING *
  `;
  const values = [
    organization_id,
    group_name,
    group_description || null,
    group_image || null,
    created_by,
    is_airtime,
    status || null,
  ];

  const { rows } = await executor.query(query, values);
  return rows[0];
};

const findAll = async ({
  organization_id,
  status,
  is_airtime,
  search,
  limit = 50,
  offset = 0,
} = {}) => {
  const where = [];
  const values = [];
  let idx = 1;

  if (organization_id) {
    where.push(`g.organization_id = $${idx}`);
    values.push(organization_id);
    idx += 1;
  }

  if (status) {
    where.push(`g.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (is_airtime !== undefined && is_airtime !== null) {
    where.push(`g.is_airtime = $${idx}`);
    values.push(is_airtime);
    idx += 1;
  }

  if (search) {
    where.push(`(
      COALESCE(g.group_name, '') ILIKE $${idx}
      OR COALESCE(g.group_description, '') ILIKE $${idx}
      OR CAST(g.group_id AS TEXT) ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM groups g
    ${whereSql}
  `;
  const countResult = await db.query(countQuery, values);
  const total = Number(countResult.rows[0]?.total || 0);

  if (!total) return { rows: [], total: 0 };

  const dataValues = [...values, limit, offset];
  const query = `
    SELECT
      g.*,
      u.name AS created_by_name,
      u.email AS created_by_email,
      (
        SELECT COUNT(*)::int
        FROM group_members gm
        WHERE gm.group_id = g.group_id
          AND gm.status = 'active'
      ) AS active_member_count
    FROM groups g
    LEFT JOIN users u
      ON u.user_id = g.created_by
    ${whereSql}
    ORDER BY g.group_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const { rows } = await db.query(query, dataValues);
  return { rows, total };
};

const findById = async (groupId, tx = null) => {
  const executor = tx || db;
  const query = `
    SELECT
      g.*,
      u.name AS created_by_name,
      u.email AS created_by_email,
      (
        SELECT COUNT(*)::int
        FROM group_members gm
        WHERE gm.group_id = g.group_id
          AND gm.status = 'active'
      ) AS active_member_count
    FROM groups g
    LEFT JOIN users u
      ON u.user_id = g.created_by
    WHERE g.group_id = $1
    LIMIT 1
  `;
  const { rows } = await executor.query(query, [groupId]);
  return rows[0];
};

const findDuplicateByName = async ({ organization_id, group_name, exclude_group_id }, tx = null) => {
  const executor = tx || db;
  const values = [organization_id, group_name];
  let query = `
    SELECT group_id, organization_id, group_name, status
    FROM groups
    WHERE organization_id = $1
      AND LOWER(TRIM(group_name)) = LOWER(TRIM($2))
  `;

  if (exclude_group_id !== undefined && exclude_group_id !== null) {
    values.push(exclude_group_id);
    query += ` AND group_id <> $3`;
  }

  query += `
    ORDER BY group_id ASC
    LIMIT 1
  `;

  const { rows } = await executor.query(query, values);
  return rows[0] || null;
};

const updateGroupPut = async (groupId, payload, tx = null) => {
  const executor = tx || db;
  const query = `
    UPDATE groups
    SET organization_id = $1,
        group_name = $2,
        group_description = $3,
        group_image = $4,
        is_airtime = $5,
        status = $6,
        updated_at = NOW()
    WHERE group_id = $7
    RETURNING *
  `;

  const values = [
    payload.organization_id,
    payload.group_name,
    payload.group_description || null,
    payload.group_image || null,
    payload.is_airtime ?? false,
    payload.status || 'active',
    groupId,
  ];

  const { rows } = await executor.query(query, values);
  return rows[0];
};

const updateGroupPatch = async (groupId, payload, tx = null) => {
  const executor = tx || db;
  const allowed = ['organization_id', 'group_name', 'group_description', 'group_image', 'is_airtime', 'status'];
  const fields = [];
  const values = [];
  let idx = 1;

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
  }

  if (!fields.length) return null;

  values.push(groupId);
  const query = `
    UPDATE groups
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE group_id = $${idx}
    RETURNING *
  `;

  const { rows } = await executor.query(query, values);
  return rows[0];
};

module.exports = {
  createGroup,
  findAll,
  findById,
  findDuplicateByName,
  updateGroupPut,
  updateGroupPatch,
};
