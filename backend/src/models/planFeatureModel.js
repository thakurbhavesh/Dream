const db = require('../config/database');

const createPlanFeature = async ({
  plan_id,
  feature_name,
  feature_description = null,
  feature_icon = null,
  section_label = 'Plan Features',
  display_order = 10,
  status = 'active',
}) => {
  const { rows } = await db.query(
    `INSERT INTO plan_features
      (plan_id, feature_name, feature_description, feature_icon, section_label, display_order, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [plan_id, feature_name, feature_description, feature_icon, section_label, display_order, status]
  );
  return rows[0];
};

const findAll = async ({ search, plan_id, status, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (plan_id) {
    filters.push(`pf.plan_id = $${idx}`);
    values.push(plan_id);
    idx += 1;
  }

  if (status) {
    filters.push(`pf.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      CAST(pf.plan_feature_id AS TEXT) ILIKE $${idx} OR
      CAST(pf.plan_id AS TEXT) ILIKE $${idx} OR
      pf.feature_name ILIKE $${idx} OR
      COALESCE(pf.feature_description, '') ILIKE $${idx} OR
      COALESCE(pf.section_label, '') ILIKE $${idx} OR
      COALESCE(p.plan_name, '') ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT
       pf.*,
       p.plan_key,
       p.plan_name,
       COUNT(*) OVER() AS total_count
     FROM plan_features pf
     JOIN plans p ON p.plan_id = pf.plan_id
     ${whereClause}
     ORDER BY pf.plan_id ASC, pf.display_order ASC, pf.plan_feature_id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query(
    `SELECT pf.*, p.plan_key, p.plan_name
     FROM plan_features pf
     JOIN plans p ON p.plan_id = pf.plan_id
     WHERE pf.plan_feature_id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0];
};

const findByPlanAndName = async (plan_id, feature_name) => {
  const { rows } = await db.query(
    `SELECT *
     FROM plan_features
     WHERE plan_id = $1
       AND LOWER(feature_name) = LOWER($2)
     LIMIT 1`,
    [plan_id, feature_name]
  );
  return rows[0];
};

const updatePlanFeaturePartial = async (id, payload = {}) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = [
    'plan_id',
    'feature_name',
    'feature_description',
    'feature_icon',
    'section_label',
    'display_order',
    'status',
  ];

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(payload[key]);
      idx += 1;
    }
  }

  if (!fields.length) return null;

  values.push(id);
  const { rows } = await db.query(
    `UPDATE plan_features
     SET ${fields.join(', ')},
         updated_at = NOW()
     WHERE plan_feature_id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0];
};

module.exports = {
  createPlanFeature,
  findAll,
  findById,
  findByPlanAndName,
  updatePlanFeaturePartial,
  getStatusCountsByPlanId: async (plan_id) => {
    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'active')::int AS active,
         COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive
       FROM plan_features
       WHERE plan_id = $1`,
      [plan_id]
    );
    return rows[0] || { total: 0, active: 0, inactive: 0 };
  },
  findByPlanIdAndStatus: async ({ plan_id, status = 'all' }) => {
    const values = [plan_id];
    let where = 'WHERE plan_id = $1';
    if (status !== 'all') {
      values.push(status);
      where += ' AND status = $2';
    }
    const { rows } = await db.query(
      `SELECT *
       FROM plan_features
       ${where}
       ORDER BY display_order ASC, plan_feature_id DESC`,
      values
    );
    return rows;
  },
};
