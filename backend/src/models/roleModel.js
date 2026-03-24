const db = require('../config/database');

const createRole = async ({ role_key, role_name, description, status }) => {
  const query = `
    INSERT INTO roles (role_key, role_name, description, status)
    VALUES ($1, $2, $3, COALESCE($4, 'active'))
    RETURNING *
  `;
  const values = [role_key, role_name, description || null, status || null];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const findAll = async ({ search, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(
      CAST(role_id AS TEXT) ILIKE $${idx} OR
      role_key ILIKE $${idx} OR
      role_name ILIKE $${idx} OR
      COALESCE(description, '') ILIKE $${idx} OR
      status ILIKE $${idx} OR
      CAST(created_at AS TEXT) ILIKE $${idx} OR
      CAST(updated_at AS TEXT) ILIKE $${idx}
    )`);
    idx += 1;
  }

  values.push(limit);
  values.push(offset);

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `
    SELECT *, COUNT(*) OVER() AS total_count
    FROM roles
    ${whereClause}
    ORDER BY role_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM roles WHERE role_id = $1', [id]);
  return rows[0];
};

const findByKey = async (roleKey) => {
  const { rows } = await db.query('SELECT * FROM roles WHERE role_key = $1', [roleKey]);
  return rows[0];
};

const updateRole = async (id, payload) => {
  const query = `
    UPDATE roles
    SET role_key = $1,
        role_name = $2,
        description = $3,
        status = $4,
        updated_at = NOW()
    WHERE role_id = $5
    RETURNING *
  `;
  const values = [
    payload.role_key,
    payload.role_name,
    payload.description || null,
    payload.status || 'active',
    id,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const updateRolePartial = async (id, payload) => {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['role_key', 'role_name', 'description', 'status'];
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
  }

  if (!fields.length) {
    return null;
  }

  values.push(id);
  const query = `
    UPDATE roles
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE role_id = $${idx}
    RETURNING *
  `;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const deleteRole = async (id) => {
  const { rows } = await db.query('DELETE FROM roles WHERE role_id = $1 RETURNING role_id', [id]);
  return rows[0];
};

module.exports = {
  createRole,
  findAll,
  findById,
  findByKey,
  updateRole,
  updateRolePartial,
  deleteRole,
};
