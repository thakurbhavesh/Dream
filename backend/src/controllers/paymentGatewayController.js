const paymentGatewayModel = require('../models/paymentGatewayModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');
const { encryptSensitiveConfig, sanitizeSensitiveConfig } = require('../utils/paymentGatewaySecrets');

const ENTITY = 'payment_gateways';

const asPlainObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
};

const sanitizeGatewayRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    config_json: sanitizeSensitiveConfig(asPlainObject(row.config_json)),
  };
};

const buildSecurePayload = (payload = {}) => {
  const next = { ...(payload || {}) };
  if (payload?.config_json && typeof payload.config_json === 'object' && !Array.isArray(payload.config_json)) {
    next.config_json = encryptSensitiveConfig(payload.config_json);
  }
  return next;
};

// Masked pattern from sanitizeSensitiveConfig: "********xxxx" or "********(encrypted)"
const MASKED_REGEX = /^\*{4,}/;

const deepMergePreserveMasked = (existing, incoming) => {
  if (Array.isArray(incoming)) {
    if (Array.isArray(existing)) {
      return incoming.map((newItem) => {
        if (newItem && typeof newItem === 'object' && newItem.account_id) {
          const oldItem = existing.find((o) => o?.account_id === newItem.account_id);
          return deepMergePreserveMasked(oldItem || {}, newItem);
        }
        return newItem;
      });
    }
    return incoming;
  }
  if (incoming && typeof incoming === 'object') {
    const result = { ...(existing || {}) };
    for (const [key, newVal] of Object.entries(incoming)) {
      const oldVal = (existing || {})[key];
      if (typeof newVal === 'string' && MASKED_REGEX.test(newVal)) {
        result[key] = oldVal; // preserve original — masked value means "not changed"
      } else if (newVal && typeof newVal === 'object') {
        result[key] = deepMergePreserveMasked(oldVal, newVal);
      } else {
        result[key] = newVal;
      }
    }
    return result;
  }
  if (typeof incoming === 'string' && MASKED_REGEX.test(incoming)) {
    return existing;
  }
  return incoming;
};

const validatePayload = (payload = {}, { partial = false } = {}) => {
  const gatewayKey = String(payload.gateway_key || '').trim().toLowerCase();
  const gatewayName = String(payload.gateway_name || '').trim();
  const status = String(payload.status || '').trim().toLowerCase();

  if (!partial || payload.gateway_key !== undefined) {
    if (!gatewayKey) {
      const err = new Error('gateway_key is required');
      err.status = 400;
      throw err;
    }
  }
  if (!partial || payload.gateway_name !== undefined) {
    if (!gatewayName) {
      const err = new Error('gateway_name is required');
      err.status = 400;
      throw err;
    }
  }
  if (payload.status !== undefined && !['active', 'inactive'].includes(status)) {
    const err = new Error('status must be active or inactive');
    err.status = 400;
    throw err;
  }
};

const getPaymentGateways = async (req, res, next) => {
  try {
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await paymentGatewayModel.findAll({ search, limit, offset });
      return { count: total, rows: rows.map(sanitizeGatewayRow) };
    });
    return success(res, data, 'Payment gateways retrieved');
  } catch (error) {
    return next(error);
  }
};

const getPaymentGateway = async (req, res, next) => {
  try {
    const gateway = await withEntityCache(ENTITY, req, async () => {
      const found = await paymentGatewayModel.findById(req.params.id);
      if (!found) {
        const err = new Error('Payment gateway not found');
        err.status = 404;
        throw err;
      }
      return sanitizeGatewayRow(found);
    });
    return success(res, gateway, 'Payment gateway retrieved');
  } catch (error) {
    return next(error);
  }
};

const createPaymentGateway = async (req, res, next) => {
  try {
    validatePayload(req.body, { partial: false });
    const securePayload = buildSecurePayload(req.body || {});
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const created = sanitizeGatewayRow(await paymentGatewayModel.createPaymentGateway(securePayload));
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'payment_gateway',
      target_id: created?.payment_gateway_id || null,
      action: 'payment_gateway.create',
      action_category: 'billing',
      action_subtype: 'payment_gateway_create',
      description: `Payment gateway ${created?.gateway_key || '-'} created`,
      new_values: created,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, created, 'Payment gateway created', 201);
  } catch (error) {
    return next(error);
  }
};

const updatePaymentGateway = async (req, res, next) => {
  try {
    validatePayload(req.body, { partial: true });

    let body = req.body || {};

    // Merge incoming config_json with existing DB value so masked fields are preserved
    if (body.config_json && typeof body.config_json === 'object') {
      const rawExisting = await paymentGatewayModel.findById(req.params.id);
      const existingConfig = asPlainObject(rawExisting?.config_json);
      body = { ...body, config_json: deepMergePreserveMasked(existingConfig, body.config_json) };
    }

    const securePayload = buildSecurePayload(body);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRow = sanitizeGatewayRow(await paymentGatewayModel.findById(req.params.id));
    const updated = sanitizeGatewayRow(
      await paymentGatewayModel.updatePaymentGatewayPartial(req.params.id, securePayload)
    );
    if (!updated) {
      const err = new Error('Payment gateway not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'payment_gateway',
      target_id: updated?.payment_gateway_id || null,
      action: 'payment_gateway.update',
      action_category: 'billing',
      action_subtype: 'payment_gateway_update',
      description: `Payment gateway ${updated?.gateway_key || '-'} updated`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, updated, 'Payment gateway updated');
  } catch (error) {
    return next(error);
  }
};

const deletePaymentGateway = async (req, res, next) => {
  try {
    const deleted = await paymentGatewayModel.deletePaymentGateway(req.params.id);
    if (!deleted) {
      const err = new Error('Payment gateway not found');
      err.status = 404;
      throw err;
    }
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Payment gateway deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPaymentGateways,
  getPaymentGateway,
  createPaymentGateway,
  updatePaymentGateway,
  deletePaymentGateway,
};
