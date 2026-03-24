const platformModel = require('../models/platformModel');
const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validatePlatformPayload = (req, res, next) => {
  const { platform_key, platform_name, category } = req.body || {};

  if (isMissing(platform_key) || isMissing(platform_name)) {
    return failure(res, 'platform_key and platform_name are required', 400);
  }

  if (category && !['browser', 'os', 'device', 'other'].includes(category)) {
    return failure(res, 'category must be browser, os, device, or other', 400);
  }

  return next();
};

const validatePlatformUpdate = (req, res, next) => {
  const { category } = req.body || {};

  if (category && !['browser', 'os', 'device', 'other'].includes(category)) {
    return failure(res, 'category must be browser, os, device, or other', 400);
  }

  return next();
};

const ensureUniquePlatformKey = async (req, res, next) => {
  try {
    const { platform_key } = req.body || {};
    if (isMissing(platform_key)) return next();

    const existing = await platformModel.findByKey(platform_key);
    if (!existing) return next();

    const currentId = req.params.id ? Number(req.params.id) : null;
    if (currentId && existing.platform_id === currentId) {
      return next();
    }

    return failure(res, 'platform_key already exists', 409);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validatePlatformPayload,
  validatePlatformUpdate,
  ensureUniquePlatformKey,
};
