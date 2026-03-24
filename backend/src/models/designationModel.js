const db = require('../config/database');

const createDesignation = async ({ organization_id, department_id, name, status }) => {
  const query = `
    INSERT INTO designations (organization_id, department_id, name, status)
    VALUES ($1, $2, $3, COALESCE($4, 'active'))
    RETURNING *
  `;
  const values = [organization_id, department_id, name, status || null];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const findAll = async ({ organization_id, department_id, search, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (organization_id) {
    values.push(organization_id);
    filters.push(`d.organization_id = $${idx}`);
    idx += 1;
  }

  if (department_id) {
    values.push(department_id);
    filters.push(`d.department_id = $${idx}`);
    idx += 1;
  }

  if (search) {
    values.push(`%${search}%`);
    filters.push(`(
      CAST(d.designation_id AS TEXT) ILIKE $${idx} OR
      d.name ILIKE $${idx} OR
      d.status ILIKE $${idx} OR
      CAST(d.created_at AS TEXT) ILIKE $${idx} OR
      CAST(d.updated_at AS TEXT) ILIKE $${idx} OR
      COALESCE(dept.name, '') ILIKE $${idx}
    )`);
    idx += 1;
  }

  values.push(limit);
  values.push(offset);

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const query = `
    SELECT
      d.designation_id,
      d.organization_id,
      d.department_id,
      d.name,
      dept.name AS department_name,
      d.status,
      dept.status AS department_status,
      d.created_at,
      d.updated_at,
      COUNT(*) OVER() AS total_count
    FROM designations d
    LEFT JOIN departments dept ON dept.department_id = d.department_id
    ${whereClause}
    ORDER BY d.designation_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const query = `
    SELECT
      d.designation_id,
      d.organization_id,
      d.department_id,
      d.name,
      dept.name AS department_name,
      d.status,
      dept.status AS department_status,
      d.created_at,
      d.updated_at
    FROM designations d
    LEFT JOIN departments dept ON dept.department_id = d.department_id
    WHERE d.designation_id = $1
  `;
  const { rows } = await db.query(query, [id]);
  return rows[0];
};

const updateDesignation = async (id, payload) => {
  const query = `
    UPDATE designations
    SET organization_id = $1,
        department_id = $2,
        name = $3,
        status = $4,
        updated_at = NOW()
    WHERE designation_id = $5
    RETURNING *
  `;
  const values = [
    payload.organization_id,
    payload.department_id,
    payload.name,
    payload.status || 'active',
    id,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const updateDesignationPartial = async (id, payload) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['department_id', 'name', 'status'];

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
    UPDATE designations
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE designation_id = $${idx}
    RETURNING *
  `;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const deleteDesignation = async (id) => {
  const { rows } = await db.query('DELETE FROM designations WHERE designation_id = $1 RETURNING designation_id', [id]);
  return rows[0];
};

module.exports = {
  createDesignation,
  findAll,
  findById,
  updateDesignation,
  updateDesignationPartial,
  deleteDesignation,
};
