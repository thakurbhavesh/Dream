const roleModel = require('../models/roleModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'roles';

const createRole = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const role = await roleModel.createRole(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'role',
      target_id: role.role_id,
      action: 'role.create',
      action_category: 'master_data',
      action_subtype: 'role_create',
      description: `Role ${role.role_key} created`,
      new_values: role,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, role, 'Role created', 201);
  } catch (error) {
    return next(error);
  }
};

const getRoles = async (req, res, next) => {
  try {
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await roleModel.findAll({ search, limit, offset });
      return { count: total, rows };
    });
    return success(res, data, 'Roles retrieved');
  } catch (error) {
    return next(error);
  }
};

const getRole = async (req, res, next) => {
  try {
    const role = await withEntityCache(ENTITY, req, async () => {
      const found = await roleModel.findById(req.params.id);
      if (!found) {
        const err = new Error('Role not found');
        err.status = 404;
        throw err;
      }
      return found;
    });

    return success(res, role, 'Role retrieved');
  } catch (error) {
    return next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRole = await roleModel.findById(req.params.id);
    const role = await roleModel.updateRolePartial(req.params.id, req.body);
    if (!role) {
      const err = new Error('Role not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'role',
      target_id: role.role_id,
      action: 'role.update',
      action_category: 'master_data',
      action_subtype: 'role_update',
      description: `Role ${role.role_key} updated`,
      old_values: oldRole,
      new_values: role,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, role, 'Role updated');
  } catch (error) {
    return next(error);
  }
};

const patchRole = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRole = await roleModel.findById(req.params.id);
    const role = await roleModel.updateRolePartial(req.params.id, req.body);
    if (!role) {
      const err = new Error('Role not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'role',
      target_id: role.role_id,
      action: 'role.patch',
      action_category: 'master_data',
      action_subtype: 'role_patch',
      description: `Role ${role.role_key} patched`,
      old_values: oldRole,
      new_values: role,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, role, 'Role updated');
  } catch (error) {
    return next(error);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    const deleted = await roleModel.deleteRole(req.params.id);
    if (!deleted) {
      const err = new Error('Role not found');
      err.status = 404;
      throw err;
    }
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Role deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createRole,
  getRoles,
  getRole,
  updateRole,
  patchRole,
  deleteRole,
};
