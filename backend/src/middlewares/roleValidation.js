const roleModel = require('../models/roleModel');
const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validateRolePayload = (req, res, next) => {
  const { role_key, role_name, status } = req.body || {};

  if (isMissing(role_key) || isMissing(role_name)) {
    return failure(res, 'role_key and role_name are required', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validateRoleUpdate = (req, res, next) => {
  const { status } = req.body || {};

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const ensureUniqueRoleKey = async (req, res, next) => {
  try {
    const { role_key } = req.body || {};
    if (isMissing(role_key)) return next();

    const existing = await roleModel.findByKey(role_key);
    if (!existing) return next();

    const currentId = req.params.id ? Number(req.params.id) : null;
    if (currentId && existing.role_id === currentId) {
      return next();
    }

    return failure(res, 'role_key already exists', 409);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validateRolePayload,
  validateRoleUpdate,
  ensureUniqueRoleKey,
};
