const db = require('../config/database');

const createPlatform = async ({ platform_key, platform_name, category, icon_class }) => {
  const query = `
    INSERT INTO platforms (platform_key, platform_name, category, icon_class)
    VALUES ($1, $2, COALESCE($3, 'other'), $4)
    RETURNING *
  `;
  const values = [platform_key, platform_name, category || null, icon_class || null];
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
      CAST(platform_id AS TEXT) ILIKE $${idx} OR
      platform_key ILIKE $${idx} OR
      platform_name ILIKE $${idx} OR
      category ILIKE $${idx} OR
      COALESCE(icon_class, '') ILIKE $${idx} OR
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
    FROM platforms
    ${whereClause}
    ORDER BY platform_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM platforms WHERE platform_id = $1', [id]);
  return rows[0];
};

const findByKey = async (key) => {
  const { rows } = await db.query('SELECT * FROM platforms WHERE platform_key = $1', [key]);
  return rows[0];
};

const updatePlatform = async (id, payload) => {
  const query = `
    UPDATE platforms
    SET platform_key = $1,
        platform_name = $2,
        category = $3,
        icon_class = $4,
        updated_at = NOW()
    WHERE platform_id = $5
    RETURNING *
  `;
  const values = [
    payload.platform_key,
    payload.platform_name,
    payload.category || 'other',
    payload.icon_class || null,
    id,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const updatePlatformPartial = async (id, payload) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['platform_key', 'platform_name', 'category', 'icon_class'];

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
    UPDATE platforms
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE platform_id = $${idx}
    RETURNING *
  `;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const deletePlatform = async (id) => {
  const { rows } = await db.query('DELETE FROM platforms WHERE platform_id = $1 RETURNING platform_id', [id]);
  return rows[0];
};

module.exports = {
  createPlatform,
  findAll,
  findById,
  findByKey,
  updatePlatform,
  updatePlatformPartial,
  deletePlatform,
};
