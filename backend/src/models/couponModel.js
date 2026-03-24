const db = require('../config/database');

const normalizeCode = (value) => String(value || '').trim().toUpperCase();

const createCoupon = async ({
  coupon_code,
  coupon_name,
  description,
  discount_type,
  discount_value,
  max_discount_amount,
  min_order_amount,
  max_uses,
  valid_from,
  valid_to,
  status,
}) => {
  const { rows } = await db.query(
    `INSERT INTO coupons (
      coupon_code, coupon_name, description, discount_type, discount_value,
      max_discount_amount, min_order_amount, max_uses, valid_from, valid_to, status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11,'active'))
    RETURNING *`,
    [
      normalizeCode(coupon_code),
      coupon_name || null,
      description || null,
      discount_type,
      discount_value,
      max_discount_amount ?? null,
      min_order_amount ?? null,
      max_uses ?? null,
      valid_from || null,
      valid_to || null,
      status || null,
    ]
  );
  return rows[0] || null;
};

const findAll = async ({ search, status, limit = 50, offset = 0 } = {}) => {
  const filters = [];
  const values = [];
  let idx = 1;

  if (status) {
    filters.push(`c.status = $${idx}`);
    values.push(status);
    idx += 1;
  }

  if (search) {
    filters.push(`(
      c.coupon_code ILIKE $${idx}
      OR COALESCE(c.coupon_name, '') ILIKE $${idx}
      OR COALESCE(c.description, '') ILIKE $${idx}
    )`);
    values.push(`%${search}%`);
    idx += 1;
  }

  values.push(limit, offset);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT c.*, COUNT(*) OVER() AS total_count
     FROM coupons c
     ${whereClause}
     ORDER BY c.created_at DESC, c.coupon_id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    rows: rows.map(({ total_count, ...rest }) => rest),
    total,
  };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM coupons WHERE coupon_id = $1 LIMIT 1', [id]);
  return rows[0] || null;
};

const findByCode = async (couponCode) => {
  const { rows } = await db.query(
    'SELECT * FROM coupons WHERE UPPER(coupon_code) = UPPER($1) LIMIT 1',
    [normalizeCode(couponCode)]
  );
  return rows[0] || null;
};

const updateCouponPartial = async (id, payload = {}) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const allowed = [
    'coupon_code',
    'coupon_name',
    'description',
    'discount_type',
    'discount_value',
    'max_discount_amount',
    'min_order_amount',
    'max_uses',
    'valid_from',
    'valid_to',
    'status',
  ];

  for (const key of allowed) {
    if (payload[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      if (key === 'coupon_code') {
        values.push(normalizeCode(payload[key]));
      } else {
        values.push(payload[key]);
      }
      idx += 1;
    }
  }

  if (!fields.length) return null;

  values.push(id);
  const { rows } = await db.query(
    `UPDATE coupons
     SET ${fields.join(', ')},
         updated_at = NOW()
     WHERE coupon_id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
};

const incrementUsage = async (couponId) => {
  const { rows } = await db.query(
    `UPDATE coupons
     SET used_count = used_count + 1,
         updated_at = NOW()
     WHERE coupon_id = $1
     RETURNING *`,
    [couponId]
  );
  return rows[0] || null;
};

module.exports = {
  createCoupon,
  findAll,
  findById,
  findByCode,
  updateCouponPartial,
  incrementUsage,
};
