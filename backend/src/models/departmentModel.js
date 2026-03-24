const db = require('../config/database');

const createDepartment = async ({ organization_id, name, status }) => {
  const query = `
    INSERT INTO departments (organization_id, name, status)
    VALUES ($1, $2, COALESCE($3, 'active'))
    RETURNING *
  `;
  const values = [organization_id, name, status || null];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const findAll = async ({ organization_id, search, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (organization_id) {
    values.push(organization_id);
    filters.push(`organization_id = $${idx}`);
    idx += 1;
  }

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(
      CAST(department_id AS TEXT) ILIKE $${idx} OR
      name ILIKE $${idx} OR
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
    FROM departments
    ${whereClause}
    ORDER BY department_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM departments WHERE department_id = $1', [id]);
  return rows[0];
};

const updateDepartment = async (id, payload) => {
  const query = `
    UPDATE departments
    SET organization_id = $1,
        name = $2,
        status = $3,
        updated_at = NOW()
    WHERE department_id = $4
    RETURNING *
  `;
  const values = [
    payload.organization_id,
    payload.name,
    payload.status || 'active',
    id,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const updateDepartmentPartial = async (id, payload) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['name', 'status'];

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
  }

  if (!fields.length) return null;

  values.push(id);
  const query = `
    UPDATE departments
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE department_id = $${idx}
    RETURNING *
  `;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const deleteDepartment = async (id) => {
  const { rows } = await db.query('DELETE FROM departments WHERE department_id = $1 RETURNING department_id', [id]);
  return rows[0];
};

module.exports = {
  createDepartment,
  findAll,
  findById,
  updateDepartment,
  updateDepartmentPartial,
  deleteDepartment,
};
