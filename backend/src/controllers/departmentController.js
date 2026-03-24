const departmentModel = require('../models/departmentModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'departments';
const resolveOrganizationId = (req, fallback = null) => {
  const tokenOrgId = Number(req.user?.org || 0);
  if (Number.isFinite(tokenOrgId) && tokenOrgId > 0) return tokenOrgId;

  const bodyOrgId = Number(req.body?.organization_id || 0);
  if (Number.isFinite(bodyOrgId) && bodyOrgId > 0) return bodyOrgId;

  const queryOrgId = Number(req.query?.organization_id || 0);
  if (Number.isFinite(queryOrgId) && queryOrgId > 0) return queryOrgId;

  return fallback;
};

const createDepartment = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error('Valid organization context is required');
      err.status = 400;
      throw err;
    }

    const requestMeta = buildRequestMeta(req);
    const department = await departmentModel.createDepartment({
      ...req.body,
      organization_id: organizationId,
    });
    await logActivitySafe({
      ...buildActorFromRequest(req, { context_organization_id: department.organization_id }),
      ...requestMeta,
      context_organization_id: department.organization_id,
      target_type: 'department',
      target_id: department.department_id,
      action: 'department.create',
      action_category: 'organization_management',
      action_subtype: 'department_create',
      description: `Department ${department.name} created`,
      new_values: department,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, department, 'Department created', 201);
  } catch (error) {
    return next(error);
  }
};

const getDepartments = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await departmentModel.findAll({
        organization_id: organizationId,
        search,
        limit,
        offset,
      });
      return { count: total, rows };
    });

    return success(res, data, 'Departments retrieved');
  } catch (error) {
    return next(error);
  }
};

const getDepartment = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const department = await withEntityCache(ENTITY, req, async () => {
      const found = await departmentModel.findById(req.params.id);
      if (!found || Number(found.organization_id) !== Number(organizationId)) {
        const err = new Error('Department not found');
        err.status = 404;
        throw err;
      }
      return found;
    });

    return success(res, department, 'Department retrieved');
  } catch (error) {
    return next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const oldDepartment = await departmentModel.findById(req.params.id);
    if (!oldDepartment || Number(oldDepartment.organization_id) !== Number(organizationId)) {
      const err = new Error('Department not found');
      err.status = 404;
      throw err;
    }
    const department = await departmentModel.updateDepartmentPartial(req.params.id, req.body);
    if (!department) {
      const err = new Error('Department not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...buildActorFromRequest(req, { context_organization_id: department.organization_id }),
      ...requestMeta,
      context_organization_id: department.organization_id,
      target_type: 'department',
      target_id: department.department_id,
      action: 'department.update',
      action_category: 'organization_management',
      action_subtype: 'department_update',
      description: `Department ${department.department_id} updated`,
      old_values: oldDepartment,
      new_values: department,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, department, 'Department updated');
  } catch (error) {
    return next(error);
  }
};

const patchDepartment = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const oldDepartment = await departmentModel.findById(req.params.id);
    if (!oldDepartment || Number(oldDepartment.organization_id) !== Number(organizationId)) {
      const err = new Error('Department not found');
      err.status = 404;
      throw err;
    }
    const department = await departmentModel.updateDepartmentPartial(req.params.id, req.body);
    if (!department) {
      const err = new Error('Department not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...buildActorFromRequest(req, { context_organization_id: department.organization_id }),
      ...requestMeta,
      context_organization_id: department.organization_id,
      target_type: 'department',
      target_id: department.department_id,
      action: 'department.patch',
      action_category: 'organization_management',
      action_subtype: 'department_patch',
      description: `Department ${department.department_id} patched`,
      old_values: oldDepartment,
      new_values: department,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, department, 'Department updated');
  } catch (error) {
    return next(error);
  }
};

const deleteDepartment = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const oldDepartment = await departmentModel.findById(req.params.id);
    if (!oldDepartment || Number(oldDepartment.organization_id) !== Number(organizationId)) {
      const err = new Error('Department not found');
      err.status = 404;
      throw err;
    }
    const deleted = await departmentModel.deleteDepartment(req.params.id);
    if (!deleted) {
      const err = new Error('Department not found');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...buildActorFromRequest(req, { context_organization_id: oldDepartment?.organization_id }),
      ...requestMeta,
      context_organization_id: oldDepartment?.organization_id || null,
      target_type: 'department',
      target_id: oldDepartment?.department_id || Number(req.params.id),
      action: 'department.delete',
      action_category: 'organization_management',
      action_subtype: 'department_delete',
      description: `Department ${req.params.id} deleted`,
      old_values: oldDepartment || deleted,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Department deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createDepartment,
  getDepartments,
  getDepartment,
  updateDepartment,
  patchDepartment,
  deleteDepartment,
};
