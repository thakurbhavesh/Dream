const { failure } = require('../utils/response');

const GROUP_STATUSES = ['active', 'inactive', 'archived', 'deleted'];

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validateStatus = (status) => {
  if (status === undefined) return null;
  if (!GROUP_STATUSES.includes(status)) return 'status must be active, inactive, archived, or deleted';
  return null;
};

const validateBoolean = (key, value) => {
  if (value === undefined) return null;
  if (typeof value !== 'boolean') return `${key} must be boolean`;
  return null;
};

const validateGroupPayload = (req, res, next) => {
  const { organization_id, group_name, status, is_airtime } = req.body || {};

  if (isMissing(group_name)) {
    return failure(res, 'group_name is required', 400);
  }

  if (organization_id !== undefined && (!Number.isFinite(Number(organization_id)) || Number(organization_id) <= 0)) {
    return failure(res, 'organization_id must be a positive number', 400);
  }

  const statusError = validateStatus(status);
  if (statusError) return failure(res, statusError, 400);

  const boolError = validateBoolean('is_airtime', is_airtime);
  if (boolError) return failure(res, boolError, 400);

  return next();
};

const validateGroupPut = (req, res, next) => {
  const { organization_id, group_name, status, is_airtime } = req.body || {};

  if (isMissing(group_name)) {
    return failure(res, 'group_name is required for PUT', 400);
  }

  if (organization_id !== undefined && (!Number.isFinite(Number(organization_id)) || Number(organization_id) <= 0)) {
    return failure(res, 'organization_id must be a positive number', 400);
  }

  const statusError = validateStatus(status);
  if (statusError) return failure(res, statusError, 400);

  const boolError = validateBoolean('is_airtime', is_airtime);
  if (boolError) return failure(res, boolError, 400);

  return next();
};

const validateGroupPatch = (req, res, next) => {
  const payload = req.body || {};
  const allowed = ['organization_id', 'group_name', 'group_description', 'group_image', 'is_airtime', 'status'];
  const keys = Object.keys(payload);

  if (!keys.length || !keys.some((key) => allowed.includes(key))) {
    return failure(res, 'At least one updatable field is required', 400);
  }

  if (payload.organization_id !== undefined) {
    if (!Number.isFinite(Number(payload.organization_id)) || Number(payload.organization_id) <= 0) {
      return failure(res, 'organization_id must be a positive number', 400);
    }
  }

  const statusError = validateStatus(payload.status);
  if (statusError) return failure(res, statusError, 400);

  const boolError = validateBoolean('is_airtime', payload.is_airtime);
  if (boolError) return failure(res, boolError, 400);

  return next();
};

module.exports = {
  validateGroupPayload,
  validateGroupPut,
  validateGroupPatch,
};
