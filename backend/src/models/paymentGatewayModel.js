const db = require('../config/database');

const normalizeGatewayPayload = (payload = {}) => ({
  // Accept boolean and string booleans from forms.
  gateway_key: String(payload.gateway_key || '').trim().toLowerCase(),
  gateway_name: String(payload.gateway_name || '').trim(),
  provider: String(payload.provider || '').trim() || null,
  is_enabled:
    payload.is_enabled === undefined
      ? undefined
      : typeof payload.is_enabled === 'string'
        ? String(payload.is_enabled).trim().toLowerCase() === 'true'
        : Boolean(payload.is_enabled),
  status: String(payload.status || '').trim().toLowerCase() || undefined,
  display_order: payload.display_order === undefined ? undefined : Number(payload.display_order),
  config_json:
    payload.config_json && typeof payload.config_json === 'object' && !Array.isArray(payload.config_json)
      ? payload.config_json
      : undefined,
});

const ensureDefaultPaymentGateways = async () => {
  await db.query(
    `INSERT INTO payment_gateways (
      gateway_key, gateway_name, provider, is_enabled, status, display_order, config_json
    )
    VALUES
      ('stripe', 'Stripe', 'stripe', TRUE, 'active', 1, '{}'::jsonb),
      ('paypal', 'PayPal', 'paypal', FALSE, 'active', 2, '{}'::jsonb)
    ON CONFLICT (gateway_key) DO NOTHING`
  );
};

const createPaymentGateway = async (payload = {}) => {
  const normalized = normalizeGatewayPayload(payload);
  const { rows } = await db.query(
    `INSERT INTO payment_gateways (
      gateway_key, gateway_name, provider, is_enabled, status, display_order, config_json
    )
    VALUES ($1, $2, $3, COALESCE($4, FALSE), COALESCE($5, 'active'), COALESCE($6, 0), COALESCE($7, '{}'::jsonb))
    RETURNING *`,
    [
      normalized.gateway_key,
      normalized.gateway_name,
      normalized.provider,
      normalized.is_enabled,
      normalized.status,
      Number.isFinite(normalized.display_order) ? normalized.display_order : 0,
      normalized.config_json ? JSON.stringify(normalized.config_json) : null,
    ]
  );
  return rows[0] || null;
};

const findAll = async ({ search = '', limit = 50, offset = 0 } = {}) => {
  await ensureDefaultPaymentGateways();

  const values = [];
  const filters = [];
  let idx = 1;
  const normalizedSearch = String(search || '').trim();

  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);
    filters.push(`(
      CAST(payment_gateway_id AS TEXT) ILIKE $${idx}
      OR gateway_key ILIKE $${idx}
      OR gateway_name ILIKE $${idx}
      OR COALESCE(provider, '') ILIKE $${idx}
      OR COALESCE(status, '') ILIKE $${idx}
    )`);
    idx += 1;
  }

  values.push(limit, offset);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT *, COUNT(*) OVER() AS total_count
     FROM payment_gateways
     ${whereClause}
     ORDER BY display_order ASC, payment_gateway_id DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const total = rows.length ? Number(rows[0].total_count || 0) : 0;
  const cleaned = rows.map(({ total_count, ...rest }) => rest);
  return { rows: cleaned, total };
};

const findById = async (id) => {
  const { rows } = await db.query('SELECT * FROM payment_gateways WHERE payment_gateway_id = $1 LIMIT 1', [id]);
  return rows[0] || null;
};

const findByKey = async (gatewayKey) => {
  const key = String(gatewayKey || '').trim().toLowerCase();
  if (!key) return null;
  const { rows } = await db.query('SELECT * FROM payment_gateways WHERE gateway_key = $1 LIMIT 1', [key]);
  return rows[0] || null;
};

const updatePaymentGatewayPartial = async (id, payload = {}) => {
  const normalized = normalizeGatewayPayload(payload);
  const fields = [];
  const values = [];
  let idx = 1;

  const setField = (column, value) => {
    fields.push(`${column} = $${idx}`);
    values.push(value);
    idx += 1;
  };

  if (normalized.gateway_key) setField('gateway_key', normalized.gateway_key);
  if (normalized.gateway_name) setField('gateway_name', normalized.gateway_name);
  if (payload.provider !== undefined) setField('provider', normalized.provider);
  if (normalized.is_enabled !== undefined) setField('is_enabled', normalized.is_enabled);
  if (normalized.status) setField('status', normalized.status);
  if (normalized.display_order !== undefined && Number.isFinite(normalized.display_order)) {
    setField('display_order', normalized.display_order);
  }
  if (normalized.config_json !== undefined) {
    setField('config_json', JSON.stringify(normalized.config_json || {}));
  }

  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  values.push(id);

  const { rows } = await db.query(
    `UPDATE payment_gateways
     SET ${fields.join(', ')}
     WHERE payment_gateway_id = $${idx}
     RETURNING *`,
    values
  );
  return rows[0] || null;
};

const deletePaymentGateway = async (id) => {
  const { rows } = await db.query(
    'DELETE FROM payment_gateways WHERE payment_gateway_id = $1 RETURNING payment_gateway_id',
    [id]
  );
  return rows[0] || null;
};

module.exports = {
  ensureDefaultPaymentGateways,
  createPaymentGateway,
  findAll,
  findById,
  findByKey,
  updatePaymentGatewayPartial,
  deletePaymentGateway,
};
