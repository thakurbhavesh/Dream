const db = require('../config/database');
const getExecutor = (tx) => (tx && typeof tx.query === 'function' ? tx : db);

const normalizePaymentStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['success', 'completed', 'paid'].includes(normalized)) return 'success';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'refunded') return 'refunded';
  return 'pending';
};

const findPlanById = async (planId, tx = null) => {
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `SELECT plan_id, plan_key, plan_name, price, default_currency, interval_days, max_users, max_storage_mb, status
     FROM plans
     WHERE plan_id = $1
     LIMIT 1`,
    [planId]
  );
  return rows[0] || null;
};

const findOrganizationById = async (organizationId, tx = null) => {
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `SELECT organization_id, name
     FROM organizations
     WHERE organization_id = $1
     LIMIT 1`,
    [organizationId]
  );
  return rows[0] || null;
};

const getDefaultBillingAddressByOrganization = async (organizationId) => {
  const { rows } = await db.query(
    `SELECT billing_address_id, organization_id, full_name, company_name, email, mobile,
            address_line1, address_line2, city, state, postal_code, country, country_id, state_id,
            is_default, status, created_at, updated_at
     FROM billing_addresses
     WHERE organization_id = $1
       AND is_default = TRUE
       AND status = 'active'
     ORDER BY billing_address_id DESC
     LIMIT 1`,
    [organizationId]
  );
  return rows[0] || null;
};

const listRecentBillingAddressesByOrganization = async (organizationId, limit = 2) => {
  const safeLimit = Math.max(Number(limit) || 2, 1);
  const { rows } = await db.query(
    `SELECT billing_address_id, organization_id, full_name, company_name, email, mobile,
            address_line1, address_line2, city, state, postal_code, country, country_id, state_id,
            is_default, status, created_at, updated_at
     FROM billing_addresses
     WHERE organization_id = $1
       AND status = 'active'
     ORDER BY updated_at DESC, billing_address_id DESC
     LIMIT $2`,
    [organizationId, safeLimit]
  );
  return rows;
};

const saveDefaultBillingAddressForOrganization = async ({
  organizationId,
  actorUserId,
  fullName,
  companyName,
  email,
  mobile,
  addressLine1,
  addressLine2,
  city,
  state,
  postalCode,
  country,
  countryId,
  stateId,
  createNew = false,
}) =>
  db.withTransaction(async (client) => {
    const normalized = {
      fullName: String(fullName || '').trim(),
      companyName: companyName || null,
      email: String(email || '').trim().toLowerCase(),
      mobile: mobile || null,
      addressLine1: String(addressLine1 || '').trim(),
      addressLine2: addressLine2 || null,
      city: String(city || '').trim(),
      state: state || null,
      postalCode: postalCode || null,
      country: String(country || '').trim(),
      countryId: countryId || null,
      stateId: stateId || null,
    };

    const existingResult = await client.query(
      `SELECT *
       FROM billing_addresses
       WHERE organization_id = $1
         AND is_default = TRUE
       LIMIT 1`,
      [organizationId]
    );
    const existingDefault = existingResult.rows[0] || null;
    const existingId = existingDefault?.billing_address_id || null;

    if (
      existingDefault &&
      String(existingDefault.full_name || '') === normalized.fullName &&
      String(existingDefault.company_name || '') === String(normalized.companyName || '') &&
      String(existingDefault.email || '').toLowerCase() === normalized.email &&
      String(existingDefault.mobile || '') === String(normalized.mobile || '') &&
      String(existingDefault.address_line1 || '') === normalized.addressLine1 &&
      String(existingDefault.address_line2 || '') === String(normalized.addressLine2 || '') &&
      String(existingDefault.city || '') === normalized.city &&
      String(existingDefault.state || '') === String(normalized.state || '') &&
      String(existingDefault.postal_code || '') === String(normalized.postalCode || '') &&
      String(existingDefault.country || '') === normalized.country &&
      Number(existingDefault.country_id || 0) === Number(normalized.countryId || 0) &&
      Number(existingDefault.state_id || 0) === Number(normalized.stateId || 0) &&
      String(existingDefault.status || '').toLowerCase() === 'active'
    ) {
      return existingDefault;
    }

    const duplicateResult = await client.query(
      `SELECT *
       FROM billing_addresses
       WHERE organization_id = $1
         AND status = 'active'
         AND full_name = $2
         AND COALESCE(company_name, '') = COALESCE($3, '')
         AND LOWER(email) = LOWER($4)
         AND COALESCE(mobile, '') = COALESCE($5, '')
         AND address_line1 = $6
         AND COALESCE(address_line2, '') = COALESCE($7, '')
         AND city = $8
         AND COALESCE(state, '') = COALESCE($9, '')
         AND COALESCE(postal_code, '') = COALESCE($10, '')
         AND country = $11
         AND COALESCE(country_id, 0) = COALESCE($12, 0)
         AND COALESCE(state_id, 0) = COALESCE($13, 0)
       ORDER BY billing_address_id DESC
       LIMIT 1`,
      [
        organizationId,
        normalized.fullName,
        normalized.companyName,
        normalized.email,
        normalized.mobile,
        normalized.addressLine1,
        normalized.addressLine2,
        normalized.city,
        normalized.state,
        normalized.postalCode,
        normalized.country,
        normalized.countryId,
        normalized.stateId,
      ]
    );

    const duplicateRow = duplicateResult.rows[0] || null;
    if (duplicateRow?.billing_address_id) {
      await client.query(
        `UPDATE billing_addresses
         SET is_default = CASE WHEN billing_address_id = $1 THEN TRUE ELSE FALSE END,
             updated_at = NOW()
         WHERE organization_id = $2`,
        [duplicateRow.billing_address_id, organizationId]
      );
      const refreshed = await client.query(
        `SELECT *
         FROM billing_addresses
         WHERE billing_address_id = $1
         LIMIT 1`,
        [duplicateRow.billing_address_id]
      );
      return refreshed.rows[0] || duplicateRow;
    }

    let savedRow;
    let action = 'create';
    if (existingId && !createNew) {
      const updated = await client.query(
        `UPDATE billing_addresses
         SET full_name = $1,
             company_name = $2,
             email = $3,
             mobile = $4,
             address_line1 = $5,
             address_line2 = $6,
             city = $7,
             state = $8,
             postal_code = $9,
             country = $10,
             country_id = $11,
             state_id = $12,
             status = 'active',
             updated_at = NOW()
        WHERE billing_address_id = $13
         RETURNING *`,
        [
          normalized.fullName,
          normalized.companyName,
          normalized.email,
          normalized.mobile,
          normalized.addressLine1,
          normalized.addressLine2,
          normalized.city,
          normalized.state,
          normalized.postalCode,
          normalized.country,
          normalized.countryId,
          normalized.stateId,
          existingId,
        ]
      );
      savedRow = updated.rows[0] || null;
      action = 'update';
    } else {
      await client.query(
        `UPDATE billing_addresses
         SET is_default = FALSE,
             updated_at = NOW()
         WHERE organization_id = $1
           AND is_default = TRUE`,
        [organizationId]
      );
      const inserted = await client.query(
        `INSERT INTO billing_addresses (
           organization_id, full_name, company_name, email, mobile,
           address_line1, address_line2, city, state, postal_code, country, country_id, state_id,
           is_default, status
         )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, 'active')
         RETURNING *`,
        [
          organizationId,
          normalized.fullName,
          normalized.companyName,
          normalized.email,
          normalized.mobile,
          normalized.addressLine1,
          normalized.addressLine2,
          normalized.city,
          normalized.state,
          normalized.postalCode,
          normalized.country,
          normalized.countryId,
          normalized.stateId,
        ]
      );
      savedRow = inserted.rows[0] || null;
    }

    if (savedRow?.billing_address_id) {
      await client.query(
        `INSERT INTO billing_address_audit (
          billing_address_id, organization_id, actor_user_id, action, payload
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          savedRow.billing_address_id,
          organizationId,
          actorUserId || null,
          action,
          JSON.stringify({
            full_name: savedRow.full_name,
            company_name: savedRow.company_name,
            email: savedRow.email,
            mobile: savedRow.mobile,
            address_line1: savedRow.address_line1,
            address_line2: savedRow.address_line2,
            city: savedRow.city,
            state: savedRow.state,
            postal_code: savedRow.postal_code,
            country: savedRow.country,
            country_id: savedRow.country_id,
            state_id: savedRow.state_id,
          }),
        ]
      );
    }

    return savedRow;
  });

const findLatestSubscriptionByOrganization = async (organizationId, tx = null) => {
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `SELECT subscription_id, organization_id, plan_id, status, start_date, end_date, max_users, max_storage_mb
     FROM subscriptions
     WHERE organization_id = $1
     ORDER BY created_at DESC, subscription_id DESC
     LIMIT 1`,
    [organizationId]
  );
  return rows[0] || null;
};

const createSubscriptionForOrganization = async ({
  organizationId,
  planId,
  startDate,
  endDate,
  maxUsers,
  maxStorageMb,
}, tx = null) => {
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `INSERT INTO subscriptions (
      organization_id, plan_id, status, start_date, end_date, max_users, max_storage_mb
    )
    VALUES ($1, $2, 'active', $3, $4, $5, $6)
    RETURNING *`,
    [organizationId, planId, startDate, endDate, maxUsers, maxStorageMb]
  );
  return rows[0] || null;
};

const updateSubscriptionPlan = async ({
  subscriptionId,
  planId,
  startDate,
  endDate,
  maxUsers,
  maxStorageMb,
}, tx = null) => {
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `UPDATE subscriptions
     SET plan_id = $1,
         status = 'active',
         start_date = $2,
         end_date = $3,
         max_users = $4,
         max_storage_mb = $5,
         updated_at = NOW()
     WHERE subscription_id = $6
     RETURNING *`,
    [planId, startDate, endDate, maxUsers, maxStorageMb, subscriptionId]
  );
  return rows[0] || null;
};

const findPaymentByTransactionId = async (transactionId, tx = null) => {
  if (!transactionId) return null;
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `SELECT *
     FROM payment_history
     WHERE transaction_id = $1
     LIMIT 1`,
    [transactionId]
  );
  return rows[0] || null;
};

const findPaymentByInvoiceNumber = async (invoiceNumber, tx = null) => {
  if (!invoiceNumber) return null;
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `SELECT *
     FROM payment_history
     WHERE invoice_number = $1
     LIMIT 1`,
    [invoiceNumber]
  );
  return rows[0] || null;
};

const buildPaymentInvoiceNumber = (paymentId) => {
  const numericId = Number(paymentId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  return `INV-TCX${100 + numericId}`;
};

const createPaymentHistory = async ({
  organizationId,
  subscriptionId,
  planId,
  amount,
  paymentStatus = 'pending',
  invoiceNumber,
  transactionId,
  paymentMethod,
  currencyCode,
  periodMonths,
  userCount,
  billingType,
  couponCode,
  discountAmount,
  country,
  state,
  city,
  postalCode,
  billingName,
  billingEmail,
  companyName,
  addressLine1,
  failureReason,
}, tx = null) => {
  const exec = getExecutor(tx);
  const sequenceResult = await exec.query(`SELECT nextval(pg_get_serial_sequence('payment_history', 'payment_id')) AS payment_id`);
  const nextPaymentId = Number(sequenceResult.rows[0]?.payment_id || 0);
  const resolvedInvoiceNumber = String(invoiceNumber || '').trim() || buildPaymentInvoiceNumber(nextPaymentId);
  const { rows } = await exec.query(
    `INSERT INTO payment_history (
      payment_id, organization_id, subscription_id, plan_id, amount, payment_status,
      invoice_number, transaction_id, payment_method, currency_code, period_months, user_count,
      billing_type, coupon_code, discount_amount, country, state, city, postal_code,
      billing_name, billing_email, company_name, address_line1, failure_reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24::jsonb)
    RETURNING *`,
    [
      nextPaymentId,
      organizationId,
      subscriptionId || null,
      planId || null,
      amount,
      normalizePaymentStatus(paymentStatus),
      resolvedInvoiceNumber,
      transactionId || null,
      paymentMethod || null,
      currencyCode || null,
      Math.max(Number(periodMonths) || 1, 1),
      userCount || null,
      billingType || null,
      couponCode || null,
      discountAmount ?? null,
      country || null,
      state || null,
      city || null,
      postalCode || null,
      billingName || null,
      billingEmail || null,
      companyName || null,
      addressLine1 || null,
      failureReason ? JSON.stringify(failureReason) : null,
    ]
  );
  return rows[0] || null;
};

const listPaymentHistoryByOrganization = async ({ organizationId, limit = 50, offset = 0 }) => {
  const { rows } = await db.query(
    `SELECT payment_id, organization_id, subscription_id, plan_id, amount,
            payment_date, payment_status, invoice_number, transaction_id, payment_method,
            currency_code, period_months, user_count, billing_type, coupon_code, discount_amount,
            country, state, city, postal_code, billing_name, billing_email, company_name, address_line1,
            failure_reason, plan_name, checkout_session_id
     FROM (
       SELECT ph.payment_id, ph.organization_id, ph.subscription_id, ph.plan_id, ph.amount,
              ph.payment_date, ph.payment_status, ph.invoice_number, ph.transaction_id, ph.payment_method,
              ph.currency_code, ph.period_months, ph.user_count, ph.billing_type, ph.coupon_code, ph.discount_amount,
              ph.country, ph.state, ph.city, ph.postal_code, ph.billing_name, ph.billing_email, ph.company_name, ph.address_line1,
              ph.failure_reason,
              p.plan_name,
              NULL::varchar AS checkout_session_id
       FROM payment_history ph
       LEFT JOIN plans p ON p.plan_id = ph.plan_id
       WHERE ph.organization_id = $1

       UNION ALL

       SELECT NULL::integer AS payment_id,
              bcs.organization_id,
              NULL::integer AS subscription_id,
              (bcs.metadata->>'plan_id')::integer AS plan_id,
              bcs.amount,
              bcs.created_at AS payment_date,
              'pending'::varchar AS payment_status,
              NULL::varchar AS invoice_number,
              NULL::varchar AS transaction_id,
              bcs.gateway AS payment_method,
              bcs.currency_code,
              (bcs.metadata->>'period_months')::integer AS period_months,
              (bcs.metadata->>'user_count')::integer AS user_count,
              bcs.metadata->>'billing_type' AS billing_type,
              bcs.metadata->>'coupon_code' AS coupon_code,
              NULL::numeric AS discount_amount,
              bcs.metadata->>'billing_country' AS country,
              NULL::varchar AS state,
              NULL::varchar AS city,
              NULL::varchar AS postal_code,
              bcs.metadata->>'billing_name' AS billing_name,
              bcs.metadata->>'billing_email' AS billing_email,
              bcs.metadata->>'billing_company' AS company_name,
              NULL::varchar AS address_line1,
              NULL::jsonb AS failure_reason,
              bcs.metadata->>'plan_name' AS plan_name,
              bcs.session_id AS checkout_session_id
       FROM billing_checkout_sessions bcs
       WHERE bcs.organization_id = $1
         AND bcs.status = 'pending'
         AND bcs.created_at > NOW() - INTERVAL '24 hours'
     ) combined
     ORDER BY payment_date DESC, payment_id DESC NULLS LAST
     LIMIT $2 OFFSET $3`,
    [organizationId, limit, offset]
  );
  return rows;
};

const listEnabledPaymentGateways = async () => {
  await db.query(
    `INSERT INTO payment_gateways (
      gateway_key, gateway_name, provider, is_enabled, status, display_order, config_json
    )
    VALUES
      ('stripe', 'Stripe', 'stripe', TRUE, 'active', 1, '{}'::jsonb),
      ('paypal', 'PayPal', 'paypal', FALSE, 'active', 2, '{}'::jsonb)
    ON CONFLICT (gateway_key) DO NOTHING`
  );

  const { rows } = await db.query(
    `SELECT payment_gateway_id, gateway_key, gateway_name, provider, is_enabled, status, display_order, config_json
     FROM payment_gateways
     WHERE is_enabled = TRUE
       AND status = 'active'
     ORDER BY display_order ASC, payment_gateway_id ASC`
  );
  return rows;
};

const findPaymentGatewayByKey = async (gatewayKey, tx = null) => {
  const key = String(gatewayKey || '').trim().toLowerCase();
  if (!key) return null;
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `SELECT payment_gateway_id, gateway_key, gateway_name, provider, is_enabled, status, display_order, config_json
     FROM payment_gateways
     WHERE gateway_key = $1
     LIMIT 1`,
    [key]
  );
  return rows[0] || null;
};

const upsertBillingCheckoutSession = async (
  { sessionId, gateway, organizationId, actorUserId = null, amount = null, currencyCode = null, status = 'pending', metadata = {}, failureReason = null },
  tx = null
) => {
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `INSERT INTO billing_checkout_sessions (
      session_id, gateway, organization_id, actor_user_id, amount, currency_code, status, metadata, failure_reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
    ON CONFLICT (session_id)
    DO UPDATE SET
      gateway = EXCLUDED.gateway,
      organization_id = EXCLUDED.organization_id,
      actor_user_id = EXCLUDED.actor_user_id,
      amount = EXCLUDED.amount,
      currency_code = EXCLUDED.currency_code,
      status = EXCLUDED.status,
      metadata = EXCLUDED.metadata,
      failure_reason = EXCLUDED.failure_reason,
      updated_at = NOW()
    RETURNING *`,
    [
      String(sessionId || '').trim(),
      String(gateway || '').trim().toLowerCase(),
      organizationId,
      actorUserId || null,
      amount === null || amount === undefined ? null : Number(amount),
      currencyCode ? String(currencyCode).trim().toUpperCase() : null,
      String(status || 'pending').trim().toLowerCase(),
      JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {}),
      failureReason ? JSON.stringify(failureReason) : null,
    ]
  );
  return rows[0] || null;
};

const findBillingCheckoutSessionBySessionId = async (sessionId, tx = null) => {
  const normalized = String(sessionId || '').trim();
  if (!normalized) return null;
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `SELECT *
     FROM billing_checkout_sessions
     WHERE session_id = $1
     LIMIT 1`,
    [normalized]
  );
  return rows[0] || null;
};

const markBillingCheckoutSessionStatus = async (sessionId, { status, failureReason = null } = {}, tx = null) => {
  const normalized = String(sessionId || '').trim();
  if (!normalized) return null;
  const nextStatus = String(status || '').trim().toLowerCase();
  if (!nextStatus) return null;
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `UPDATE billing_checkout_sessions
     SET status = ($1)::varchar,
         failure_reason = $2::jsonb,
         confirmed_at = CASE WHEN ($1)::text = 'confirmed' THEN NOW() ELSE confirmed_at END,
         updated_at = NOW()
     WHERE session_id = $3
     RETURNING *`,
    [nextStatus, failureReason ? JSON.stringify(failureReason) : null, normalized]
  );
  return rows[0] || null;
};

const getPlanComparisonFromFeatureItems = async ({ status = 'active', limitPlans = 20 } = {}) => {
  const normalizedStatus = String(status || 'active').trim().toLowerCase();
  const planStatus = normalizedStatus === 'all' ? null : normalizedStatus;
  const itemStatus = normalizedStatus === 'all' ? null : normalizedStatus;
  const categoryStatus = normalizedStatus === 'all' ? null : normalizedStatus;

  const values = [];
  let idx = 1;
  let planStatusClause = '';
  let itemStatusClause = '';
  let categoryStatusClause = '';

  if (planStatus) {
    planStatusClause = `WHERE p.status = $${idx}`;
    values.push(planStatus);
    idx += 1;
  }
  if (categoryStatus) {
    categoryStatusClause = `AND fc.status = $${idx}`;
    values.push(categoryStatus);
    idx += 1;
  }
  if (itemStatus) {
    itemStatusClause = `AND fi.status = $${idx}`;
    values.push(itemStatus);
    idx += 1;
  }

  values.push(limitPlans);

  const query = `
    WITH selected_plans AS (
      SELECT p.plan_id, p.plan_key, p.plan_name, p.price, p.default_currency, p.interval_days, p.max_users, p.max_storage_mb, p.status
      FROM plans p
      ${planStatusClause}
      ORDER BY p.price ASC, p.plan_id ASC
      LIMIT $${idx}
    )
    SELECT
      sp.plan_id,
      sp.plan_key,
      sp.plan_name,
      sp.price,
      sp.default_currency,
      sp.interval_days,
      sp.max_users,
      sp.max_storage_mb,
      sp.status AS plan_status,
      fc.feature_category_id,
      fc.category_key,
      fc.category_label,
      fc.display_order AS category_display_order,
      fi.feature_item_id,
      fi.title AS feature_item_title,
      fi.description AS feature_item_description,
      fi.display_order AS feature_item_display_order,
      fi.status AS feature_item_status,
      pf.plan_feature_id,
      pf.feature_name,
      pf.feature_description,
      pf.status AS plan_feature_status,
      CASE
        WHEN pf.plan_feature_id IS NOT NULL AND LOWER(COALESCE(pf.status, '')) = 'active' THEN TRUE
        ELSE FALSE
      END AS is_included
    FROM selected_plans sp
    JOIN feature_categories fc ON 1=1 ${categoryStatusClause}
    JOIN feature_items fi ON fi.feature_category_id = fc.feature_category_id ${itemStatusClause}
    LEFT JOIN plan_features pf
      ON pf.plan_id = sp.plan_id
     AND LOWER(TRIM(pf.feature_name)) = LOWER(TRIM(fi.title))
    ORDER BY
      sp.price ASC,
      sp.plan_id ASC,
      fc.display_order ASC,
      fc.feature_category_id ASC,
      fi.display_order ASC,
      fi.feature_item_id ASC
  `;

  const { rows } = await db.query(query, values);
  return rows;
};

const updatePaymentHistoryToSuccess = async (
  paymentId,
  { transactionId, subscriptionId, amount, paymentMethod, currencyCode, billingEmail },
  tx = null
) => {
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `UPDATE payment_history
     SET payment_status = 'success',
         transaction_id = COALESCE($1, transaction_id),
         subscription_id = COALESCE($2, subscription_id),
         amount = COALESCE($3, amount),
         payment_method = COALESCE($4, payment_method),
         currency_code = COALESCE($5, currency_code),
         billing_email = COALESCE($6, billing_email),
         failure_reason = NULL
     WHERE payment_id = $7
     RETURNING *`,
    [
      transactionId || null,
      subscriptionId || null,
      amount || null,
      paymentMethod || null,
      currencyCode || null,
      billingEmail || null,
      paymentId,
    ]
  );
  return rows[0] || null;
};

const updatePaymentHistoryStatus = async (paymentId, { status, retriedByPaymentId = null }, tx = null) => {
  const exec = getExecutor(tx);
  const { rows } = await exec.query(
    `UPDATE payment_history
     SET payment_status = $1,
         retried_by_payment_id = COALESCE($2, retried_by_payment_id)
     WHERE payment_id = $3
     RETURNING *`,
    [status, retriedByPaymentId || null, paymentId]
  );
  return rows[0] || null;
};

module.exports = {
  findOrganizationById,
  getDefaultBillingAddressByOrganization,
  listRecentBillingAddressesByOrganization,
  saveDefaultBillingAddressForOrganization,
  findPlanById,
  findLatestSubscriptionByOrganization,
  createSubscriptionForOrganization,
  updateSubscriptionPlan,
  findPaymentByTransactionId,
  findPaymentByInvoiceNumber,
  createPaymentHistory,
  buildPaymentInvoiceNumber,
  listPaymentHistoryByOrganization,
  listEnabledPaymentGateways,
  findPaymentGatewayByKey,
  upsertBillingCheckoutSession,
  findBillingCheckoutSessionBySessionId,
  markBillingCheckoutSessionStatus,
  updatePaymentHistoryToSuccess,
  updatePaymentHistoryStatus,
  getPlanComparisonFromFeatureItems,
};
