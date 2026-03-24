const db = require('../config/database');

const createTimezone = async ({ timezone_code, display_name, utc_offset, country_code, status }) => {
  const query = `
    INSERT INTO timezones (timezone_code, display_name, utc_offset, country_code, status)
    VALUES ($1, $2, $3, $4, COALESCE($5, 'active'))
    RETURNING *
  `;
  const values = [timezone_code, display_name, utc_offset, country_code || null, status || null];
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
      CAST(timezone_id AS TEXT) ILIKE $${idx} OR
      timezone_code ILIKE $${idx} OR
      display_name ILIKE $${idx} OR
      utc_offset ILIKE $${idx} OR
      COALESCE(country_code, '') ILIKE $${idx} OR
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
    FROM timezones
    ${whereClause}
    ORDER BY timezone_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM timezones WHERE timezone_id = $1', [id]);
  return rows[0];
};

const findByCode = async (code) => {
  const { rows } = await db.query('SELECT * FROM timezones WHERE timezone_code = $1', [code]);
  return rows[0];
};

const updateTimezone = async (id, payload) => {
  const query = `
    UPDATE timezones
    SET timezone_code = $1,
        display_name = $2,
        utc_offset = $3,
        country_code = $4,
        status = $5,
        updated_at = NOW()
    WHERE timezone_id = $6
    RETURNING *
  `;
  const values = [
    payload.timezone_code,
    payload.display_name,
    payload.utc_offset,
    payload.country_code || null,
    payload.status || 'active',
    id,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const updateTimezonePartial = async (id, payload) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['timezone_code', 'display_name', 'utc_offset', 'country_code', 'status'];

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
    UPDATE timezones
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE timezone_id = $${idx}
    RETURNING *
  `;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const deleteTimezone = async (id) => {
  const { rows } = await db.query('DELETE FROM timezones WHERE timezone_id = $1 RETURNING timezone_id', [id]);
  return rows[0];
};

module.exports = {
  createTimezone,
  findAll,
  findById,
  findByCode,
  updateTimezone,
  updateTimezonePartial,
  deleteTimezone,
};
