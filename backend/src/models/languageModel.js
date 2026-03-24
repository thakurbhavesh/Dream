const db = require('../config/database');

const createLanguage = async ({ language_code, full_name, native_name, direction, status }) => {
  const query = `
    INSERT INTO languages (language_code, full_name, native_name, direction, status)
    VALUES ($1, $2, $3, COALESCE($4, 'ltr'), COALESCE($5, 'active'))
    RETURNING *
  `;
  const values = [language_code, full_name, native_name, direction || null, status || null];
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
      CAST(language_id AS TEXT) ILIKE $${idx} OR
      language_code ILIKE $${idx} OR
      full_name ILIKE $${idx} OR
      native_name ILIKE $${idx} OR
      direction ILIKE $${idx} OR
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
    FROM languages
    ${whereClause}
    ORDER BY language_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM languages WHERE language_id = $1', [id]);
  return rows[0];
};

const findByCode = async (code) => {
  const { rows } = await db.query('SELECT * FROM languages WHERE language_code = $1', [code]);
  return rows[0];
};

const updateLanguage = async (id, payload) => {
  const query = `
    UPDATE languages
    SET language_code = $1,
        full_name = $2,
        native_name = $3,
        direction = $4,
        status = $5,
        updated_at = NOW()
    WHERE language_id = $6
    RETURNING *
  `;
  const values = [
    payload.language_code,
    payload.full_name,
    payload.native_name,
    payload.direction || 'ltr',
    payload.status || 'active',
    id,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const updateLanguagePartial = async (id, payload) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['language_code', 'full_name', 'native_name', 'direction', 'status'];

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
    UPDATE languages
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE language_id = $${idx}
    RETURNING *
  `;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const deleteLanguage = async (id) => {
  const { rows } = await db.query('DELETE FROM languages WHERE language_id = $1 RETURNING language_id', [id]);
  return rows[0];
};

module.exports = {
  createLanguage,
  findAll,
  findById,
  findByCode,
  updateLanguage,
  updateLanguagePartial,
  deleteLanguage,
};
