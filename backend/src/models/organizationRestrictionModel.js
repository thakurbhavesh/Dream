const db = require('../config/database');

const createIpRestriction = async ({ organization_id, ip_address, status = 'active', note = null }) => {
  const { rows } = await db.query(
    `INSERT INTO organization_ip_restrictions
      (organization_id, ip_address, status, note)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [organization_id, ip_address, status, note]
  );
  return rows[0];
};

const findIpRestrictions = async ({ organization_id, search, status, limit = 50, offset = 0 } = {}) => {
  const filters = ['organization_id = $1'];
  const values = [organization_id];
  let idx = 2;

  if (status) {
    filters.push(`status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      CAST(restriction_id AS TEXT) ILIKE $${idx}
      OR ip_address ILIKE $${idx}
      OR COALESCE(note, '') ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const { rows } = await db.query(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM organization_ip_restrictions
     WHERE ${filters.join(' AND ')}
     ORDER BY restriction_id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    rows: rows.map(({ total_count, ...rest }) => rest),
    total,
  };
};

const findIpRestrictionById = async (organization_id, restriction_id) => {
  const { rows } = await db.query(
    `SELECT *
     FROM organization_ip_restrictions
     WHERE organization_id = $1
       AND restriction_id = $2
     LIMIT 1`,
    [organization_id, restriction_id]
  );
  return rows[0];
};

const updateIpRestriction = async (organization_id, restriction_id, payload = {}, { partial = false } = {}) => {
  if (!partial) {
    const { rows } = await db.query(
      `UPDATE organization_ip_restrictions
       SET ip_address = $1,
           status = $2,
           note = $3,
           updated_at = NOW()
       WHERE organization_id = $4
         AND restriction_id = $5
       RETURNING *`,
      [payload.ip_address, payload.status ?? 'active', payload.note ?? null, organization_id, restriction_id]
    );
    return rows[0];
  }

  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['ip_address', 'status', 'note'];
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
  }

  if (!fields.length) return null;

  values.push(organization_id, restriction_id);
  const { rows } = await db.query(
    `UPDATE organization_ip_restrictions
     SET ${fields.join(', ')},
         updated_at = NOW()
     WHERE organization_id = $${idx}
       AND restriction_id = $${idx + 1}
     RETURNING *`,
    values
  );
  return rows[0];
};

const createPlatformRestriction = async ({
  organization_id,
  platform_id,
  restriction_type,
  status = 'active',
  note = null,
}) => {
  const { rows } = await db.query(
    `INSERT INTO organization_platform_restrictions
      (organization_id, platform_id, restriction_type, status, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [organization_id, platform_id, restriction_type, status, note]
  );
  return rows[0];
};

const findPlatformRestrictions = async ({
  organization_id,
  search,
  platform_id,
  restriction_type,
  status,
  limit = 50,
  offset = 0,
} = {}) => {
  const filters = ['opr.organization_id = $1'];
  const values = [organization_id];
  let idx = 2;

  if (platform_id) {
    filters.push(`opr.platform_id = $${idx}`);
    values.push(platform_id);
    idx += 1;
  }

  if (restriction_type) {
    filters.push(`opr.restriction_type = $${idx}`);
    values.push(restriction_type);
    idx += 1;
  }

  if (status) {
    filters.push(`opr.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      CAST(opr.restriction_id AS TEXT) ILIKE $${idx}
      OR CAST(opr.platform_id AS TEXT) ILIKE $${idx}
      OR COALESCE(p.platform_key, '') ILIKE $${idx}
      OR COALESCE(p.platform_name, '') ILIKE $${idx}
      OR COALESCE(opr.note, '') ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);

  const { rows } = await db.query(
    `SELECT
       opr.*,
       p.platform_key,
       p.platform_name,
       p.category AS platform_category,
       COUNT(*) OVER() AS total_count
     FROM organization_platform_restrictions opr
     LEFT JOIN platforms p ON p.platform_id = opr.platform_id
     WHERE ${filters.join(' AND ')}
     ORDER BY opr.restriction_id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    rows: rows.map(({ total_count, ...rest }) => rest),
    total,
  };
};

const findPlatformRestrictionById = async (organization_id, restriction_id) => {
  const { rows } = await db.query(
    `SELECT
       opr.*,
       p.platform_key,
       p.platform_name,
       p.category AS platform_category
     FROM organization_platform_restrictions opr
     LEFT JOIN platforms p ON p.platform_id = opr.platform_id
     WHERE opr.organization_id = $1
       AND opr.restriction_id = $2
     LIMIT 1`,
    [organization_id, restriction_id]
  );
  return rows[0];
};

const updatePlatformRestriction = async (
  organization_id,
  restriction_id,
  payload = {},
  { partial = false } = {}
) => {
  if (!partial) {
    const { rows } = await db.query(
      `UPDATE organization_platform_restrictions
       SET platform_id = $1,
           restriction_type = $2,
           status = $3,
           note = $4,
           updated_at = NOW()
       WHERE organization_id = $5
         AND restriction_id = $6
       RETURNING *`,
      [
        payload.platform_id,
        payload.restriction_type,
        payload.status ?? 'active',
        payload.note ?? null,
        organization_id,
        restriction_id,
      ]
    );
    return rows[0];
  }

  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = ['platform_id', 'restriction_type', 'status', 'note'];
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
  }

  if (!fields.length) return null;

  values.push(organization_id, restriction_id);
  const { rows } = await db.query(
    `UPDATE organization_platform_restrictions
     SET ${fields.join(', ')},
         updated_at = NOW()
     WHERE organization_id = $${idx}
       AND restriction_id = $${idx + 1}
     RETURNING *`,
    values
  );
  return rows[0];
};

module.exports = {
  createIpRestriction,
  findIpRestrictions,
  findIpRestrictionById,
  updateIpRestriction,
  createPlatformRestriction,
  findPlatformRestrictions,
  findPlatformRestrictionById,
  updatePlatformRestriction,
};
