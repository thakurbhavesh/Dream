const timezoneModel = require('../models/timezoneModel');
const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validateTimezonePayload = (req, res, next) => {
  const { timezone_code, display_name, utc_offset, status } = req.body || {};

  if (isMissing(timezone_code) || isMissing(display_name) || isMissing(utc_offset)) {
    return failure(res, 'timezone_code, display_name, utc_offset are required', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validateTimezoneUpdate = (req, res, next) => {
  const { status } = req.body || {};

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const ensureUniqueTimezoneCode = async (req, res, next) => {
  try {
    const { timezone_code } = req.body || {};
    if (isMissing(timezone_code)) return next();

    const existing = await timezoneModel.findByCode(timezone_code);
    if (!existing) return next();

    const currentId = req.params.id ? Number(req.params.id) : null;
    if (currentId && existing.timezone_id === currentId) {
      return next();
    }

    return failure(res, 'timezone_code already exists', 409);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validateTimezonePayload,
  validateTimezoneUpdate,
  ensureUniqueTimezoneCode,
};
