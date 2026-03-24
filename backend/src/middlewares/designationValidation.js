const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validateDesignationPayload = (req, res, next) => {
  const { department_id, name, status } = req.body || {};

  if (isMissing(department_id) || isMissing(name)) {
    return failure(res, 'department_id and name are required', 400);
  }

  const departmentId = Number(department_id);
  if (!Number.isFinite(departmentId) || departmentId <= 0) {
    return failure(res, 'department_id must be a positive number', 400);
  }

  if (status && !['active', 'inactive'].includes(status)) {
    return failure(res, 'status must be active or inactive', 400);
  }

  return next();
};

const validateDesignationUpdate = (req, res, next) => {
  const { organization_id, department_id, name, status } = req.body || {};

  if (organization_id !== undefined) {
    return failure(res, 'organization_id cannot be updated', 400);
  }

  if (department_id !== undefined) {
    const departmentId = Number(department_id);
    if (!Number.isFinite(departmentId) || departmentId <= 0) {
      return failure(res, 'department_id must be a positive number', 400);
    }
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
  validateDesignationPayload,
  validateDesignationUpdate,
};
