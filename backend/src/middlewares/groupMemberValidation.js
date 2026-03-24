const { failure } = require('../utils/response');

const MEMBER_STATUSES = ['active', 'left', 'kicked', 'banned'];

const isPositiveNumber = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const validateStatus = (status) => {
  if (status === undefined) return null;
  if (!MEMBER_STATUSES.includes(status)) return 'status must be active, left, kicked, or banned';
  return null;
};

const validateBoolean = (value, field) => {
  if (value === undefined) return null;
  if (typeof value !== 'boolean') return `${field} must be boolean`;
  return null;
};

const validateCreateGroupMember = (req, res, next) => {
  const { group_id, user_id, organization_id, status, is_admin } = req.body || {};

  if (!isPositiveNumber(group_id) || !isPositiveNumber(user_id)) {
    return failure(res, 'group_id and user_id must be positive numbers', 400);
  }

  if (organization_id !== undefined && !isPositiveNumber(organization_id)) {
    return failure(res, 'organization_id must be a positive number', 400);
  }

  const statusError = validateStatus(status);
  if (statusError) return failure(res, statusError, 400);

  const boolError = validateBoolean(is_admin, 'is_admin');
  if (boolError) return failure(res, boolError, 400);

  return next();
};

const validatePutGroupMember = (req, res, next) => {
  return validateCreateGroupMember(req, res, next);
};

const validatePatchGroupMember = (req, res, next) => {
  const payload = req.body || {};
  const allowed = ['group_id', 'user_id', 'organization_id', 'status', 'is_admin'];
  const keys = Object.keys(payload);

  if (!keys.length || !keys.some((key) => allowed.includes(key))) {
    return failure(res, 'At least one updatable field is required', 400);
  }

  if (payload.group_id !== undefined && !isPositiveNumber(payload.group_id)) {
    return failure(res, 'group_id must be a positive number', 400);
  }

  if (payload.user_id !== undefined && !isPositiveNumber(payload.user_id)) {
    return failure(res, 'user_id must be a positive number', 400);
  }

  if (payload.organization_id !== undefined && !isPositiveNumber(payload.organization_id)) {
    return failure(res, 'organization_id must be a positive number', 400);
  }

  const statusError = validateStatus(payload.status);
  if (statusError) return failure(res, statusError, 400);

  const boolError = validateBoolean(payload.is_admin, 'is_admin');
  if (boolError) return failure(res, boolError, 400);

  return next();
};

module.exports = {
  validateCreateGroupMember,
  validatePutGroupMember,
  validatePatchGroupMember,
};
