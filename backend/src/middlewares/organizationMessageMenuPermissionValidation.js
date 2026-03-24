const { failure } = require('../utils/response');

const PERMISSION_TYPES = ['show', 'hide', 'disable'];
const STATUSES = ['active', 'inactive'];

const isPositiveInt = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const validatePermissionType = (value) =>
  value === undefined || PERMISSION_TYPES.includes(String(value).toLowerCase());

const validateStatus = (value) => value === undefined || STATUSES.includes(String(value).toLowerCase());

const validateCreatePermission = (req, res, next) => {
  const { menu_item_id, permission_type, status } = req.body || {};

  if (!isPositiveInt(menu_item_id)) {
    return failure(res, 'menu_item_id must be a positive integer', 400);
  }

  if (!validatePermissionType(permission_type)) {
    return failure(res, 'permission_type must be show, hide, or disable', 400);
  }

  if (!validateStatus(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validatePutPermission = (req, res, next) => {
  const { menu_item_id, permission_type, status } = req.body || {};

  if (menu_item_id !== undefined && !isPositiveInt(menu_item_id)) {
    return failure(res, 'menu_item_id must be a positive integer', 400);
  }

  if (!permission_type || !validatePermissionType(permission_type)) {
    return failure(res, 'permission_type must be show, hide, or disable', 400);
  }

  if (!validateStatus(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validatePatchPermission = (req, res, next) => {
  const body = req.body || {};
  const hasAny =
    body.menu_item_id !== undefined ||
    body.permission_type !== undefined ||
    body.note !== undefined ||
    body.status !== undefined;

  if (!hasAny) {
    return failure(res, 'At least one field is required for patch', 400);
  }

  if (body.menu_item_id !== undefined && !isPositiveInt(body.menu_item_id)) {
    return failure(res, 'menu_item_id must be a positive integer', 400);
  }

  if (!validatePermissionType(body.permission_type)) {
    return failure(res, 'permission_type must be show, hide, or disable', 400);
  }

  if (!validateStatus(body.status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

module.exports = {
  validateCreatePermission,
  validatePutPermission,
  validatePatchPermission,
};

