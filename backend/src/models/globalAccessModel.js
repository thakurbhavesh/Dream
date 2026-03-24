const db = require('../config/database');

const mapRow = (row) => ({
  global_access_id: row.global_access_id,
  org_id: row.org_id,
  organization_name: row.organization_name || null,
  user_id: row.user_id,
  global_user_name: row.global_user_name || null,
  global_user_email: row.global_user_email || null,
  allow_user_id: row.allow_user_id,
  allow_user_name: row.allow_user_name || null,
  allow_user_email: row.allow_user_email || null,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const getGlobalAccesses = async ({
  org_id,
  user_id,
  allow_user_id,
  status,
  search,
  limit = 50,
  offset = 0,
}) => {
  const where = ['ga.org_id = $1'];
  const values = [org_id];
  let idx = 2;

  if (user_id) {
    where.push(`ga.user_id = $${idx}`);
    values.push(user_id);
    idx += 1;
  }

  if (allow_user_id) {
    where.push(`ga.allow_user_id = $${idx}`);
    values.push(allow_user_id);
    idx += 1;
  }

  if (status) {
    where.push(`ga.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    where.push(`(
      CAST(ga.user_id AS TEXT) ILIKE $${idx}
      OR CAST(ga.allow_user_id AS TEXT) ILIKE $${idx}
      OR EXISTS (
        SELECT 1
        FROM users gu
        WHERE gu.user_id = ga.user_id
          AND (
            COALESCE(gu.name, '') ILIKE $${idx}
            OR COALESCE(gu.email, '') ILIKE $${idx}
          )
      )
      OR EXISTS (
        SELECT 1
        FROM users au
        WHERE au.user_id = ga.allow_user_id
          AND (
            COALESCE(au.name, '') ILIKE $${idx}
            OR COALESCE(au.email, '') ILIKE $${idx}
          )
      )
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  const whereSql = where.join(' AND ');
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM global_access ga
    WHERE ${whereSql}
  `;
  const countResult = await db.query(countQuery, values);
  const total = Number(countResult.rows[0]?.total || 0);
  if (!total) return { rows: [], total: 0 };

  const dataValues = [...values, limit, offset];
  const query = `
    SELECT
      ga.global_access_id,
      ga.org_id,
      org.name AS organization_name,
      ga.user_id,
      global_user.name AS global_user_name,
      global_user.email AS global_user_email,
      ga.allow_user_id,
      allowed_user.name AS allow_user_name,
      allowed_user.email AS allow_user_email,
      ga.status,
      ga.created_at,
      ga.updated_at
    FROM global_access ga
    JOIN organizations org ON org.organization_id = ga.org_id
    JOIN users global_user ON global_user.user_id = ga.user_id
    JOIN users allowed_user ON allowed_user.user_id = ga.allow_user_id
    WHERE ${whereSql}
    ORDER BY ga.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const { rows } = await db.query(query, dataValues);
  return { rows: rows.map((row) => mapRow(row)), total };
};

const getGlobalAccessById = async (org_id, global_access_id) => {
  const query = `
    SELECT
      ga.global_access_id,
      ga.org_id,
      org.name AS organization_name,
      ga.user_id,
      global_user.name AS global_user_name,
      global_user.email AS global_user_email,
      ga.allow_user_id,
      allowed_user.name AS allow_user_name,
      allowed_user.email AS allow_user_email,
      ga.status,
      ga.created_at,
      ga.updated_at
    FROM global_access ga
    JOIN organizations org ON org.organization_id = ga.org_id
    JOIN users global_user ON global_user.user_id = ga.user_id
    JOIN users allowed_user ON allowed_user.user_id = ga.allow_user_id
    WHERE ga.org_id = $1
      AND ga.global_access_id = $2
    LIMIT 1
  `;
  const { rows } = await db.query(query, [org_id, global_access_id]);
  return rows[0] ? mapRow(rows[0]) : null;
};

const createGlobalAccess = async ({ org_id, user_id, allow_user_id, status = 'active' }) => {
  const query = `
    INSERT INTO global_access (org_id, user_id, allow_user_id, status)
    VALUES ($1, $2, $3, $4)
    RETURNING global_access_id
  `;
  const { rows } = await db.query(query, [org_id, user_id, allow_user_id, status]);
  return getGlobalAccessById(org_id, rows[0].global_access_id);
};

const updateGlobalAccess = async (org_id, global_access_id, payload) => {
  const query = `
    UPDATE global_access
    SET user_id = $3,
        allow_user_id = $4,
        status = $5,
        updated_at = NOW()
    WHERE org_id = $1
      AND global_access_id = $2
    RETURNING global_access_id
  `;
  const { rows } = await db.query(query, [
    org_id,
    global_access_id,
    payload.user_id,
    payload.allow_user_id,
    payload.status || 'active',
  ]);
  if (!rows.length) return null;
  return getGlobalAccessById(org_id, rows[0].global_access_id);
};

const patchGlobalAccess = async (org_id, global_access_id, payload) => {
  const query = `
    UPDATE global_access
    SET user_id = COALESCE($3, user_id),
        allow_user_id = COALESCE($4, allow_user_id),
        status = COALESCE($5, status),
        updated_at = NOW()
    WHERE org_id = $1
      AND global_access_id = $2
    RETURNING global_access_id
  `;
  const { rows } = await db.query(query, [
    org_id,
    global_access_id,
    payload.user_id ?? null,
    payload.allow_user_id ?? null,
    payload.status ?? null,
  ]);
  if (!rows.length) return null;
  return getGlobalAccessById(org_id, rows[0].global_access_id);
};

const deleteGlobalAccess = async (org_id, global_access_id) => {
  const existing = await getGlobalAccessById(org_id, global_access_id);
  if (!existing) return null;
  await db.query(
    `DELETE FROM global_access
     WHERE org_id = $1
       AND global_access_id = $2`,
    [org_id, global_access_id]
  );
  return existing;
};

const getAllowedUsersByOrgAndUser = async (org_id, user_id) => {
  const query = `
    SELECT
      ga.org_id,
      org.name AS organization_name,
      ga.user_id,
      global_user.name AS global_user_name,
      global_user.email AS global_user_email,
      ga.allow_user_id,
      allowed_user.name AS allow_user_name,
      allowed_user.email AS allow_user_email,
      ga.status,
      ga.created_at,
      ga.updated_at
    FROM global_access ga
    JOIN organizations org ON org.organization_id = ga.org_id
    JOIN users global_user ON global_user.user_id = ga.user_id
    JOIN users allowed_user ON allowed_user.user_id = ga.allow_user_id
    WHERE ga.org_id = $1
      AND ga.user_id = $2
      AND ga.status = 'active'
    ORDER BY allowed_user.name ASC, ga.allow_user_id ASC
  `;
  const { rows } = await db.query(query, [org_id, user_id]);
  return rows.map((row) => ({
    org_id: row.org_id,
    organization_name: row.organization_name,
    user_id: row.user_id,
    global_user_name: row.global_user_name,
    global_user_email: row.global_user_email,
    allow_user_id: row.allow_user_id,
    allow_user_name: row.allow_user_name,
    allow_user_email: row.allow_user_email,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
};

module.exports = {
  getGlobalAccesses,
  getGlobalAccessById,
  createGlobalAccess,
  updateGlobalAccess,
  patchGlobalAccess,
  deleteGlobalAccess,
  getAllowedUsersByOrgAndUser,
};
