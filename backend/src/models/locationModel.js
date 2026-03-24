const db = require('../config/database');

const createLocation = async ({ organization_id, label, country, status }) => {
  const query = `
    INSERT INTO locations (organization_id, label, country, status)
    VALUES ($1, $2, COALESCE($3, 'India'), COALESCE($4, 'active'))
    RETURNING *
  `;
  const values = [organization_id, label, country || null, status || null];
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
      CAST(location_id AS TEXT) ILIKE $${idx} OR
      label ILIKE $${idx} OR
      country ILIKE $${idx} OR
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
    FROM locations
    ${whereClause}
    ORDER BY location_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM locations WHERE location_id = $1', [id]);
  return rows[0];
};

const updateLocation = async (id, payload) => {
  const query = `
    UPDATE locations
    SET organization_id = $1,
        label = $2,
        country = $3,
        status = $4,
        updated_at = NOW()
    WHERE location_id = $5
    RETURNING *
  `;
  const values = [
    payload.organization_id,
    payload.label,
    payload.country || 'India',
    payload.status || 'active',
    id,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const updateLocationPartial = async (id, payload) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['label', 'country', 'status'];

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
    UPDATE locations
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE location_id = $${idx}
    RETURNING *
  `;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const deleteLocation = async (id) => {
  const { rows } = await db.query('DELETE FROM locations WHERE location_id = $1 RETURNING location_id', [id]);
  return rows[0];
};

module.exports = {
  createLocation,
  findAll,
  findById,
  updateLocation,
  updateLocationPartial,
  deleteLocation,
};
