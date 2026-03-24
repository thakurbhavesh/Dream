const languageModel = require('../models/languageModel');
const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validateLanguagePayload = (req, res, next) => {
  const { language_code, full_name, native_name, direction, status } = req.body || {};

  if (isMissing(language_code) || isMissing(full_name) || isMissing(native_name)) {
    return failure(res, 'language_code, full_name, native_name are required', 400);
  }

  if (direction && !['ltr', 'rtl'].includes(direction)) {
    return failure(res, 'direction must be ltr or rtl', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validateLanguageUpdate = (req, res, next) => {
  const { direction, status } = req.body || {};

  if (direction && !['ltr', 'rtl'].includes(direction)) {
    return failure(res, 'direction must be ltr or rtl', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const ensureUniqueLanguageCode = async (req, res, next) => {
  try {
    const { language_code } = req.body || {};
    if (isMissing(language_code)) return next();

    const existing = await languageModel.findByCode(language_code);
    if (!existing) return next();

    const currentId = req.params.id ? Number(req.params.id) : null;
    if (currentId && existing.language_id === currentId) {
      return next();
    }

    return failure(res, 'language_code already exists', 409);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validateLanguagePayload,
  validateLanguageUpdate,
  ensureUniqueLanguageCode,
};
