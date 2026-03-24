const db = require('../config/database');

const upsertControl = async (organization_id, feature_key, { enabled, time_limit_minutes, allowed_roles }) => {
  const { rows } = await db.query(
    `INSERT INTO organization_controls
       (organization_id, feature_key, enabled, time_limit_minutes, allowed_roles)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (organization_id, feature_key) DO UPDATE
       SET enabled            = EXCLUDED.enabled,
           time_limit_minutes = EXCLUDED.time_limit_minutes,
           allowed_roles      = EXCLUDED.allowed_roles,
           updated_at         = NOW()
     RETURNING *`,
    [
      organization_id,
      feature_key,
      enabled ?? true,
      time_limit_minutes ?? null,
      allowed_roles != null ? JSON.stringify(allowed_roles) : null,
    ]
  );
  return rows[0];
};

const findControl = async (organization_id, feature_key) => {
  const { rows } = await db.query(
    `SELECT * FROM organization_controls
     WHERE organization_id = $1 AND feature_key = $2
     LIMIT 1`,
    [organization_id, feature_key]
  );
  return rows[0];
};

const findAllControls = async (organization_id) => {
  const { rows } = await db.query(
    `SELECT * FROM organization_controls
     WHERE organization_id = $1
     ORDER BY feature_key`,
    [organization_id]
  );
  return rows;
};

module.exports = { upsertControl, findControl, findAllControls };
