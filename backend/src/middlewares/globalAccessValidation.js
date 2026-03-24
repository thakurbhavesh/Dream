const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const isPositiveNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

const validateStatus = (status) => ['active', 'inactive'].includes(String(status).trim().toLowerCase());

const validateCreateGlobalAccess = (req, res, next) => {
  const { user_id, allow_user_id, status } = req.body || {};

  if (isMissing(user_id) || isMissing(allow_user_id)) {
    return failure(res, 'user_id and allow_user_id are required', 400);
  }

  if (!isPositiveNumber(user_id) || !isPositiveNumber(allow_user_id)) {
    return failure(res, 'user_id and allow_user_id must be positive numbers', 400);
  }

  if (Number(user_id) === Number(allow_user_id)) {
    return failure(res, 'user_id and allow_user_id must be different', 400);
  }

  if (status !== undefined && !validateStatus(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validatePutGlobalAccess = (req, res, next) => {
  const { user_id, allow_user_id, status } = req.body || {};

  if (isMissing(user_id) || isMissing(allow_user_id)) {
    return failure(res, 'user_id and allow_user_id are required', 400);
  }

  if (!isPositiveNumber(user_id) || !isPositiveNumber(allow_user_id)) {
    return failure(res, 'user_id and allow_user_id must be positive numbers', 400);
  }

  if (Number(user_id) === Number(allow_user_id)) {
    return failure(res, 'user_id and allow_user_id must be different', 400);
  }

  if (status !== undefined && !validateStatus(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validatePatchGlobalAccess = (req, res, next) => {
  const { user_id, allow_user_id, status } = req.body || {};

  if (user_id === undefined && allow_user_id === undefined && status === undefined) {
    return failure(res, 'At least one field is required: user_id, allow_user_id, status', 400);
  }

  if (user_id !== undefined && !isPositiveNumber(user_id)) {
    return failure(res, 'user_id must be a positive number', 400);
  }

  if (allow_user_id !== undefined && !isPositiveNumber(allow_user_id)) {
    return failure(res, 'allow_user_id must be a positive number', 400);
  }

  if (status !== undefined && !validateStatus(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  if (user_id !== undefined && allow_user_id !== undefined && Number(user_id) === Number(allow_user_id)) {
    return failure(res, 'user_id and allow_user_id must be different', 400);
  }

  return next();
};

module.exports = {
  validateCreateGlobalAccess,
  validatePutGlobalAccess,
  validatePatchGlobalAccess,
};
