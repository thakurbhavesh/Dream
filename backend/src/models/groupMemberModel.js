const db = require('../config/database');

const createGroupMember = async ({
  group_id,
  user_id,
  is_admin,
  organization_id,
  status,
}, tx = null) => {
  const executor = tx || db;
  const query = `
    INSERT INTO group_members (
      group_id,
      user_id,
      is_admin,
      organization_id,
      status
    )
    VALUES ($1, $2, COALESCE($3, false), $4, COALESCE($5, 'active'))
    RETURNING *
  `;
  const values = [group_id, user_id, is_admin, organization_id, status || null];
  const { rows } = await executor.query(query, values);
  return rows[0];
};

const findGroupMembers = async ({
  group_id,
  organization_id,
  user_id,
  status,
  limit = 50,
  offset = 0,
} = {}) => {
  const where = [];
  const values = [];
  let idx = 1;

  if (group_id) {
    where.push(`gm.group_id = $${idx}`);
    values.push(group_id);
    idx += 1;
  }

  if (organization_id) {
    where.push(`gm.organization_id = $${idx}`);
    values.push(organization_id);
    idx += 1;
  }

  if (user_id) {
    where.push(`gm.user_id = $${idx}`);
    values.push(user_id);
    idx += 1;
  }

  if (status) {
    where.push(`gm.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM group_members gm
    ${whereSql}
  `;
  const countResult = await db.query(countQuery, values);
  const total = Number(countResult.rows[0]?.total || 0);
  if (!total) return { rows: [], total: 0 };

  const dataValues = [...values, limit, offset];
  const query = `
    SELECT
      gm.*,
      u.name AS user_name,
      u.email AS user_email,
      g.group_name
    FROM group_members gm
    LEFT JOIN users u
      ON u.user_id = gm.user_id
    LEFT JOIN groups g
      ON g.group_id = gm.group_id
    ${whereSql}
    ORDER BY gm.group_member_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const { rows } = await db.query(query, dataValues);
  return { rows, total };
};

const findMembersByGroupName = async ({
  group_name,
  organization_id,
  status,
  limit = 50,
  offset = 0,
} = {}) => {
  const where = ['LOWER(g.group_name) = LOWER($1)'];
  const values = [group_name];
  let idx = 2;

  if (organization_id) {
    where.push(`g.organization_id = $${idx}`);
    values.push(organization_id);
    idx += 1;
  }

  if (status) {
    where.push(`gm.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM group_members gm
    JOIN groups g ON g.group_id = gm.group_id
    ${whereSql}
  `;
  const countResult = await db.query(countQuery, values);
  const total = Number(countResult.rows[0]?.total || 0);
  if (!total) return { rows: [], total: 0 };

  const dataValues = [...values, limit, offset];
  const query = `
    SELECT
      gm.group_member_id,
      gm.group_id,
      g.group_name,
      g.organization_id,
      gm.user_id,
      u.name,
      u.email,
      gm.is_admin,
      gm.status AS member_status
    FROM group_members gm
    JOIN groups g
      ON g.group_id = gm.group_id
    JOIN users u
      ON u.user_id = gm.user_id
    ${whereSql}
    ORDER BY gm.group_member_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, dataValues);
  return { rows, total };
};

const findGroupMemberById = async (groupMemberId, tx = null) => {
  const executor = tx || db;
  const query = `
    SELECT
      gm.*,
      u.name AS user_name,
      u.email AS user_email,
      g.group_name
    FROM group_members gm
    LEFT JOIN users u
      ON u.user_id = gm.user_id
    LEFT JOIN groups g
      ON g.group_id = gm.group_id
    WHERE gm.group_member_id = $1
    LIMIT 1
  `;
  const { rows } = await executor.query(query, [groupMemberId]);
  return rows[0];
};

const updateGroupMemberPut = async (groupMemberId, payload, tx = null) => {
  const executor = tx || db;
  const query = `
    UPDATE group_members
    SET group_id = $1,
        user_id = $2,
        is_admin = $3,
        organization_id = $4,
        status = $5,
        updated_at = NOW()
    WHERE group_member_id = $6
    RETURNING *
  `;
  const values = [
    payload.group_id,
    payload.user_id,
    payload.is_admin ?? false,
    payload.organization_id,
    payload.status || 'active',
    groupMemberId,
  ];
  const { rows } = await executor.query(query, values);
  return rows[0];
};

const updateGroupMemberPatch = async (groupMemberId, payload, tx = null) => {
  const executor = tx || db;
  const allowed = ['group_id', 'user_id', 'is_admin', 'organization_id', 'status'];
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

  values.push(groupMemberId);
  const query = `
    UPDATE group_members
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE group_member_id = $${idx}
    RETURNING *
  `;
  const { rows } = await executor.query(query, values);
  return rows[0];
};

module.exports = {
  createGroupMember,
  findGroupMembers,
  findMembersByGroupName,
  findGroupMemberById,
  updateGroupMemberPut,
  updateGroupMemberPatch,
};
