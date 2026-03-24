const { failure } = require('../utils/response');
const { isValidEmail, isBusinessEmail } = require('../utils/businessEmail');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validateCreateOrgUser = (req, res, next) => {
  const { name, email, role_id, department_id, designation_id, location_id } = req.body || {};

  if (isMissing(name) || isMissing(email)) {
    return failure(res, 'name and email are required', 400);
  }

  if (!isValidEmail(email)) {
    return failure(res, 'Valid email is required', 400);
  }
  if (!isBusinessEmail(email)) {
    return failure(res, 'Only business email is allowed', 400);
  }

  if (role_id !== undefined) {
    const roleId = Number(role_id);
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return failure(res, 'role_id must be a positive number', 400);
    }
  }

  if (department_id !== undefined && department_id !== null && String(department_id).trim() !== '') {
    const departmentId = Number(department_id);
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      return failure(res, 'department_id must be a positive number', 400);
    }
  }

  if (designation_id !== undefined && designation_id !== null && String(designation_id).trim() !== '') {
    const designationId = Number(designation_id);
    if (!Number.isFinite(designationId) || designationId <= 0) {
      return failure(res, 'designation_id must be a positive number', 400);
    }
  }

  if (location_id !== undefined && location_id !== null && String(location_id).trim() !== '') {
    const locationId = Number(location_id);
    if (!Number.isFinite(locationId) || locationId <= 0) {
      return failure(res, 'location_id must be a positive number', 400);
    }
  }

  return next();
};

const validateUpdateOrgUser = (req, res, next) => {
  const payload = req.body || {};
  const allowed = new Set([
    'name',
    'email',
    'mobile',
    'role_id',
    'is_platform_admin',
    'is_global_member',
    'user_status',
    'membership_status',
    'department_id',
    'designation_id',
    'location_id',
  ]);

  const keys = Object.keys(payload);
  if (!keys.length) {
    return failure(res, 'At least one field is required for update', 400);
  }

  for (const key of keys) {
    if (!allowed.has(key)) {
      return failure(res, `Unsupported field: ${key}`, 400);
    }
  }

  if (payload.email !== undefined && !isValidEmail(payload.email)) {
    return failure(res, 'Valid email is required', 400);
  }
  if (payload.email !== undefined && !isBusinessEmail(payload.email)) {
    return failure(res, 'Only business email is allowed', 400);
  }

  if (payload.role_id !== undefined) {
    const roleId = Number(payload.role_id);
    if (!Number.isFinite(roleId) || roleId <= 0) {
      return failure(res, 'role_id must be a positive number', 400);
    }
  }

  if (payload.user_status && !['active', 'suspended', 'invited', 'archived'].includes(payload.user_status)) {
    return failure(res, 'user_status must be active, suspended, invited, or archived', 400);
  }

  if (payload.membership_status && !['active', 'invited', 'suspended', 'left'].includes(payload.membership_status)) {
    return failure(res, 'membership_status must be active, invited, suspended, or left', 400);
  }

  if (payload.department_id !== undefined) {
    const departmentId = Number(payload.department_id);
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      return failure(res, 'department_id must be a positive number', 400);
    }
  }

  if (payload.designation_id !== undefined) {
    const designationId = Number(payload.designation_id);
    if (!Number.isFinite(designationId) || designationId <= 0) {
      return failure(res, 'designation_id must be a positive number', 400);
    }
  }

  if (payload.location_id !== undefined) {
    const locationId = Number(payload.location_id);
    if (!Number.isFinite(locationId) || locationId <= 0) {
      return failure(res, 'location_id must be a positive number', 400);
    }
  }

  return next();
};

const validateBulkUpdateOrgUsers = (req, res, next) => {
  const updates = req.body?.updates;
  if (!Array.isArray(updates) || !updates.length) {
    return failure(res, 'updates array is required', 400);
  }

  const allowed = new Set([
    'name',
    'email',
    'mobile',
    'role_id',
    'is_platform_admin',
    'is_global_member',
    'user_status',
    'membership_status',
    'department_id',
    'designation_id',
    'location_id',
  ]);

  for (const item of updates) {
    const userId = Number(item?.user_id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return failure(res, 'Each update item must include a valid user_id', 400);
    }

    const payloadKeys = Object.keys(item || {}).filter((k) => k !== 'user_id');
    if (!payloadKeys.length) {
      return failure(res, `At least one field is required for user_id ${userId}`, 400);
    }

    for (const key of payloadKeys) {
      if (!allowed.has(key)) {
        return failure(res, `Unsupported field in bulk update: ${key}`, 400);
      }
    }

    if (item.email !== undefined && !isValidEmail(item.email)) {
      return failure(res, `Valid email is required for user_id ${userId}`, 400);
    }
    if (item.email !== undefined && !isBusinessEmail(item.email)) {
      return failure(res, `Only business email is allowed for user_id ${userId}`, 400);
    }

    if (item.role_id !== undefined) {
      const roleId = Number(item.role_id);
      if (!Number.isFinite(roleId) || roleId <= 0) {
        return failure(res, `role_id must be a positive number for user_id ${userId}`, 400);
      }
    }

    if (item.department_id !== undefined) {
      const departmentId = Number(item.department_id);
      if (!Number.isFinite(departmentId) || departmentId <= 0) {
        return failure(res, `department_id must be a positive number for user_id ${userId}`, 400);
      }
    }

    if (item.designation_id !== undefined) {
      const designationId = Number(item.designation_id);
      if (!Number.isFinite(designationId) || designationId <= 0) {
        return failure(res, `designation_id must be a positive number for user_id ${userId}`, 400);
      }
    }

    if (item.location_id !== undefined) {
      const locationId = Number(item.location_id);
      if (!Number.isFinite(locationId) || locationId <= 0) {
        return failure(res, `location_id must be a positive number for user_id ${userId}`, 400);
      }
    }
  }

  return next();
};

const validateResetOrgUserPassword = (req, res, next) => {
  const email = String(req.body?.email || '').trim();
  if (!email) {
    return failure(res, 'email is required', 400);
  }
  if (!isValidEmail(email)) {
    return failure(res, 'Valid email is required', 400);
  }

  if (req.body?.new_password !== undefined && String(req.body.new_password).length < 8) {
    return failure(res, 'new_password must be at least 8 characters', 400);
  }

  return next();
};

const validateBulkDeleteOrgUsers = (req, res, next) => {
  const user_ids = req.body?.user_ids;
  if (!Array.isArray(user_ids) || !user_ids.length) {
    return failure(res, 'user_ids array is required', 400);
  }

  for (const id of user_ids) {
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return failure(res, `Invalid user_id: ${id}`, 400);
    }
  }

  return next();
};

module.exports = {
  validateCreateOrgUser,
  validateUpdateOrgUser,
  validateBulkUpdateOrgUsers,
  validateBulkDeleteOrgUsers,
  validateResetOrgUserPassword,
};
