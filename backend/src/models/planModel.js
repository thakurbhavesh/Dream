const db = require('../config/database');

const createPlan = async ({
  plan_key,
  plan_name,
  price,
  default_currency,
  interval_days,
  max_users,
  max_storage_mb,
  status,
}) => {
  const query = `
    INSERT INTO plans (
      plan_key,
      plan_name,
      price,
      default_currency,
      interval_days,
      max_users,
      max_storage_mb,
      status
    )
    VALUES ($1, $2, $3, COALESCE($4, 'INR'), $5, $6, $7, COALESCE($8, 'active'))
    RETURNING *
  `;
  const values = [
    plan_key,
    plan_name,
    price ?? 0,
    String(default_currency || 'INR').trim().toUpperCase(),
    interval_days,
    max_users ?? 10,
    max_storage_mb ?? 500,
    status || null,
  ];
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
      CAST(plan_id AS TEXT) ILIKE $${idx} OR
      plan_key ILIKE $${idx} OR
      plan_name ILIKE $${idx} OR
      CAST(price AS TEXT) ILIKE $${idx} OR
      default_currency ILIKE $${idx} OR
      CAST(interval_days AS TEXT) ILIKE $${idx} OR
      CAST(max_users AS TEXT) ILIKE $${idx} OR
      CAST(max_storage_mb AS TEXT) ILIKE $${idx} OR
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
    FROM plans
    ${whereClause}
    ORDER BY plan_id DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const { rows } = await db.query(query, values);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM plans WHERE plan_id = $1', [id]);
  return rows[0];
};

const findByKey = async (planKey) => {
  const { rows } = await db.query('SELECT * FROM plans WHERE plan_key = $1', [planKey]);
  return rows[0];
};

const updatePlan = async (id, payload) => {
  const query = `
    UPDATE plans
    SET plan_key = $1,
        plan_name = $2,
        price = $3,
        default_currency = $4,
        interval_days = $5,
        max_users = $6,
        max_storage_mb = $7,
        status = $8,
        updated_at = NOW()
    WHERE plan_id = $9
    RETURNING *
  `;
  const values = [
    payload.plan_key,
    payload.plan_name,
    payload.price ?? 0,
    String(payload.default_currency || 'INR').trim().toUpperCase(),
    payload.interval_days,
    payload.max_users ?? 10,
    payload.max_storage_mb ?? 500,
    payload.status || 'active',
    id,
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
};

const updatePlanPartial = async (id, payload) => {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['plan_key', 'plan_name', 'price', 'default_currency', 'interval_days', 'max_users', 'max_storage_mb', 'status'];
  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      if (key === 'default_currency') {
        values.push(String(payload[key] || 'INR').trim().toUpperCase());
      } else {
        values.push(payload[key]);
      }
      idx += 1;
    }
  }

  if (!fields.length) {
    return null;
  }

  values.push(id);
  const query = `
    UPDATE plans
    SET ${fields.join(', ')},
        updated_at = NOW()
    WHERE plan_id = $${idx}
    RETURNING *
  `;
  const { rows } = await db.query(query, values);
  return rows[0];
};

const deletePlan = async (id) => {
  const { rows } = await db.query('DELETE FROM plans WHERE plan_id = $1 RETURNING plan_id', [id]);
  return rows[0];
};


module.exports = {
  createPlan,
  findAll,
  findById,
  findByKey,
  updatePlan,
  updatePlanPartial,
  deletePlan,
};
