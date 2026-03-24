const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validateLocationPayload = (req, res, next) => {
  const { label, status } = req.body || {};

  if (isMissing(label)) {
    return failure(res, 'label is required', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validateLocationUpdate = (req, res, next) => {
  const { organization_id, label, status } = req.body || {};

  if (organization_id !== undefined) {
    return failure(res, 'organization_id cannot be updated', 400);
  }

  if (label !== undefined && isMissing(label)) {
    return failure(res, 'label cannot be empty', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

module.exports = {
  validateLocationPayload,
  validateLocationUpdate,
};
