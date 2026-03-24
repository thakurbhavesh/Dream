const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validateDepartmentPayload = (req, res, next) => {
  const { name, status } = req.body || {};

  if (isMissing(name)) {
    return failure(res, 'name is required', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validateDepartmentUpdate = (req, res, next) => {
  const { name, status, organization_id } = req.body || {};

  if (organization_id !== undefined) {
    return failure(res, 'organization_id cannot be updated', 400);
  }

  if (name !== undefined && isMissing(name)) {
    return failure(res, 'name cannot be empty', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

module.exports = {
  validateDepartmentPayload,
  validateDepartmentUpdate,
};
