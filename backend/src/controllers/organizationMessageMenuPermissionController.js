const permissionModel = require('../models/organizationMessageMenuPermissionModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const resolveOrganizationId = (req) => {
  const tokenOrgId = Number(req.user?.org);
  const organization_id = tokenOrgId;

  if (!Number.isFinite(organization_id) || organization_id <= 0) {
    const err = new Error('Valid organization context is required in login token');
    err.status = 400;
    throw err;
  }

  return organization_id;
};

const createPermission = async (req, res, next) => {
  try {
    const organization_id = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const created = await permissionModel.createPermission({
      organization_id,
      menu_item_id: Number(req.body.menu_item_id),
      permission_type: req.body.permission_type || 'show',
      note: req.body.note ?? null,
      status: req.body.status || 'active',
    });
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_message_menu_permission',
      target_id: created.permission_id,
      action: 'organization_message_menu_permission.create',
      action_category: 'authorization',
      action_subtype: 'message_menu_permission_create',
      description: `Menu permission ${created.permission_id} created for org ${organization_id}`,
      new_values: created,
      is_successful: true,
      status: 'success',
    });
    return success(res, created, 'Organization message menu permission created', 201);
  } catch (error) {
    return next(error);
  }
};

const getPermissions = async (req, res, next) => {
  try {
    const organization_id = resolveOrganizationId(req);
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);

    const data = await permissionModel.findAll({
      organization_id,
      search,
      menu_item_id: req.query.menu_item_id ? Number(req.query.menu_item_id) : undefined,
      permission_type: req.query.permission_type,
      status: req.query.status,
      limit,
      offset,
    });

    return success(
      res,
      { count: data.total, rows: data.rows },
      'Organization message menu permissions retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

const getPermission = async (req, res, next) => {
  try {
    const organization_id = resolveOrganizationId(req);
    const found = await permissionModel.findById(req.params.id, organization_id);
    if (!found) {
      const err = new Error('Organization message menu permission not found');
      err.status = 404;
      throw err;
    }
    return success(res, found, 'Organization message menu permission retrieved');
  } catch (error) {
    return next(error);
  }
};

const updatePermission = async (req, res, next) => {
  try {
    const organization_id = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const existing = await permissionModel.findById(req.params.id, organization_id);
    if (!existing) {
      const err = new Error('Organization message menu permission not found');
      err.status = 404;
      throw err;
    }

    const payload = {
      menu_item_id: req.body.menu_item_id ?? existing.menu_item_id,
      permission_type: req.body.permission_type ?? existing.permission_type,
      note: req.body.note !== undefined ? req.body.note : existing.note,
      status: req.body.status ?? existing.status,
    };

    const updated = await permissionModel.updatePermission(req.params.id, organization_id, payload, {
      partial: false,
    });
    if (!updated) {
      const err = new Error('Organization message menu permission not found');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_message_menu_permission',
      target_id: updated.permission_id,
      action: 'organization_message_menu_permission.update',
      action_category: 'authorization',
      action_subtype: 'message_menu_permission_update',
      description: `Menu permission ${updated.permission_id} updated for org ${organization_id}`,
      old_values: existing,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    return success(res, updated, 'Organization message menu permission updated');
  } catch (error) {
    return next(error);
  }
};

const patchPermission = async (req, res, next) => {
  try {
    const organization_id = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const existing = await permissionModel.findById(req.params.id, organization_id);
    if (!existing) {
      const err = new Error('Organization message menu permission not found');
      err.status = 404;
      throw err;
    }
    const updated = await permissionModel.updatePermission(req.params.id, organization_id, req.body, {
      partial: true,
    });
    if (!updated) {
      const err = new Error('Organization message menu permission not found or no fields provided');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_message_menu_permission',
      target_id: updated.permission_id,
      action: 'organization_message_menu_permission.patch',
      action_category: 'authorization',
      action_subtype: 'message_menu_permission_patch',
      description: `Menu permission ${updated.permission_id} patched for org ${organization_id}`,
      old_values: existing,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    return success(res, updated, 'Organization message menu permission patched');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPermission,
  getPermissions,
  getPermission,
  updatePermission,
  patchPermission,
};
