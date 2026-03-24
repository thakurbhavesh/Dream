const planModel = require('../models/planModel');
const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validatePlanPayload = (req, res, next) => {
  const { plan_key, plan_name, interval_days, status, default_currency } = req.body || {};

  if (isMissing(plan_key) || isMissing(plan_name) || isMissing(interval_days)) {
    return failure(res, 'plan_key, plan_name, interval_days are required', 400);
  }

  const intervalValue = Number(interval_days);
  if (Number.isNaN(intervalValue) || intervalValue <= 0) {
    return failure(res, 'interval_days must be a positive number', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }
  if (default_currency !== undefined && default_currency !== null) {
    const normalized = String(default_currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      return failure(res, 'default_currency must be a valid 3-letter currency code', 400);
    }
    req.body.default_currency = normalized;
  }

  return next();
};

const validatePlanUpdate = (req, res, next) => {
  const { interval_days, status, default_currency } = req.body || {};

  if (interval_days !== undefined && interval_days !== null) {
    const intervalValue = Number(interval_days);
    if (Number.isNaN(intervalValue) || intervalValue <= 0) {
      return failure(res, 'interval_days must be a positive number', 400);
    }
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }
  if (default_currency !== undefined && default_currency !== null) {
    const normalized = String(default_currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      return failure(res, 'default_currency must be a valid 3-letter currency code', 400);
    }
    req.body.default_currency = normalized;
  }

  return next();
};

const ensureUniquePlanKey = async (req, res, next) => {
  try {
    const { plan_key } = req.body || {};
    if (isMissing(plan_key)) return next();

    const existing = await planModel.findByKey(plan_key);
    if (!existing) return next();

    const currentId = req.params.id ? Number(req.params.id) : null;
    if (currentId && existing.plan_id === currentId) {
      return next();
    }

    return failure(res, 'plan_key already exists', 409);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validatePlanPayload,
  validatePlanUpdate,
  ensureUniquePlanKey,
};
