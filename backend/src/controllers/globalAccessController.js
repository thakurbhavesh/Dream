const db = require('../config/database');
const globalAccessModel = require('../models/globalAccessModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');

const ENTITY = 'global_access';

const parsePositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const err = new Error(`${fieldName} must be a positive number`);
    err.status = 400;
    throw err;
  }
  return parsed;
};

const resolveOrganizationId = async (req) => {
  const tokenOrgId = Number(req.user?.org);
  const requestedOrgId = Number(req.query?.org_id || req.body?.org_id || req.query?.organization_id);
  const orgId = Number.isFinite(requestedOrgId) && requestedOrgId > 0 ? requestedOrgId : tokenOrgId;

  if (!Number.isFinite(orgId) || orgId <= 0) {
    const err = new Error('Valid organization context is required');
    err.status = 400;
    throw err;
  }

  const requesterUserId = Number(req.user?.sub);
  if (!Number.isFinite(requesterUserId) || requesterUserId <= 0) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const membershipResult = await db.query(
    `SELECT membership_id
     FROM organization_members
     WHERE organization_id = $1
       AND user_id = $2
       AND status = 'active'
     LIMIT 1`,
    [orgId, requesterUserId]
  );

  if (!membershipResult.rows.length) {
    const err = new Error('Access denied for requested organization');
    err.status = 403;
    throw err;
  }

  return orgId;
};

const handlePgError = (error) => {
  if (error?.code === '23505') {
    error.status = 409;
    error.message = 'Global access mapping already exists';
    return error;
  }

  if (error?.code === '23503') {
    error.status = 400;
    if (error.constraint === 'fk_global_access_allow_user') {
      error.message = 'Invalid allow_user_id: user does not exist';
    } else if (error.constraint === 'fk_global_access_allow_user_org_member') {
      error.message = 'Invalid allow_user_id: user does not belong to the requested organization';
    } else if (error.constraint === 'fk_global_access_user') {
      error.message = 'Invalid user_id: global member user does not exist';
    } else if (error.constraint === 'fk_global_access_org') {
      error.message = 'Invalid org_id: organization does not exist';
    } else {
      error.message = 'Invalid reference data for global access';
    }
    return error;
  }

  if (error?.code === 'P0001' || error?.code === '23514') {
    error.status = 400;
    return error;
  }

  return error;
};

const getGlobalAccesses = async (req, res, next) => {
  try {
    const org_id = await resolveOrganizationId(req);
    const data = await withEntityCache(ENTITY, req, async () => {
      const all = ['1', 'true', 'yes'].includes(String(req.query?.all || '').toLowerCase());
      const { limit, offset } = all
        ? { limit: 100000, offset: 0 }
        : parsePagination(req.query);

      const user_id = req.query?.user_id ? parsePositiveInt(req.query.user_id, 'user_id') : undefined;
      const allow_user_id = req.query?.allow_user_id
        ? parsePositiveInt(req.query.allow_user_id, 'allow_user_id')
        : undefined;
      const status = req.query?.status ? String(req.query.status).trim().toLowerCase() : undefined;
      const search = parseSearch(req.query);

      if (status && !['active', 'inactive'].includes(status)) {
        const err = new Error('status must be active or inactive');
        err.status = 400;
        throw err;
      }

      const { rows, total } = await globalAccessModel.getGlobalAccesses({
        org_id,
        user_id,
        allow_user_id,
        status,
        search,
        limit,
        offset,
      });

      return { count: total, rows };
    });

    return success(res, data, 'Global access list retrieved');
  } catch (error) {
    return next(error);
  }
};

const getGlobalAccess = async (req, res, next) => {
  try {
    const org_id = await resolveOrganizationId(req);
    const global_access_id = parsePositiveInt(req.params.id, 'id');
    const row = await withEntityCache(ENTITY, req, async () =>
      globalAccessModel.getGlobalAccessById(org_id, global_access_id)
    );
    if (!row) {
      const err = new Error('Global access record not found');
      err.status = 404;
      throw err;
    }
    return success(res, row, 'Global access record retrieved');
  } catch (error) {
    return next(error);
  }
};

const createGlobalAccess = async (req, res, next) => {
  try {
    const org_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: org_id });
    const payload = {
      org_id,
      user_id: parsePositiveInt(req.body.user_id, 'user_id'),
      allow_user_id: parsePositiveInt(req.body.allow_user_id, 'allow_user_id'),
      status: req.body.status ? String(req.body.status).trim().toLowerCase() : 'active',
    };
    const row = await globalAccessModel.createGlobalAccess(payload);

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: org_id,
      target_type: 'global_access',
      target_id: row.global_access_id,
      action: 'global_access.create',
      action_category: 'authorization',
      action_subtype: 'global_member_access_create',
      description: `Global access created for user ${row.user_id} -> allow_user ${row.allow_user_id} in org ${org_id}`,
      new_values: row,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);

    return success(res, row, 'Global access created', 201);
  } catch (error) {
    return next(handlePgError(error));
  }
};

const updateGlobalAccess = async (req, res, next) => {
  try {
    const org_id = await resolveOrganizationId(req);
    const global_access_id = parsePositiveInt(req.params.id, 'id');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: org_id });
    const oldRow = await globalAccessModel.getGlobalAccessById(org_id, global_access_id);
    const payload = {
      user_id: parsePositiveInt(req.body.user_id, 'user_id'),
      allow_user_id: parsePositiveInt(req.body.allow_user_id, 'allow_user_id'),
      status: req.body.status ? String(req.body.status).trim().toLowerCase() : 'active',
    };
    const row = await globalAccessModel.updateGlobalAccess(org_id, global_access_id, payload);
    if (!row) {
      const err = new Error('Global access record not found');
      err.status = 404;
      throw err;
    }

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: org_id,
      target_type: 'global_access',
      target_id: row.global_access_id,
      action: 'global_access.update',
      action_category: 'authorization',
      action_subtype: 'global_member_access_update',
      description: `Global access ${row.global_access_id} updated in org ${org_id}`,
      old_values: oldRow,
      new_values: row,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);

    return success(res, row, 'Global access updated');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const patchGlobalAccess = async (req, res, next) => {
  try {
    const org_id = await resolveOrganizationId(req);
    const global_access_id = parsePositiveInt(req.params.id, 'id');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: org_id });
    const oldRow = await globalAccessModel.getGlobalAccessById(org_id, global_access_id);
    const payload = {
      user_id: req.body.user_id !== undefined ? parsePositiveInt(req.body.user_id, 'user_id') : undefined,
      allow_user_id:
        req.body.allow_user_id !== undefined
          ? parsePositiveInt(req.body.allow_user_id, 'allow_user_id')
          : undefined,
      status: req.body.status !== undefined ? String(req.body.status).trim().toLowerCase() : undefined,
    };

    const row = await globalAccessModel.patchGlobalAccess(org_id, global_access_id, payload);
    if (!row) {
      const err = new Error('Global access record not found');
      err.status = 404;
      throw err;
    }

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: org_id,
      target_type: 'global_access',
      target_id: row.global_access_id,
      action: 'global_access.patch',
      action_category: 'authorization',
      action_subtype: 'global_member_access_patch',
      description: `Global access ${row.global_access_id} patched in org ${org_id}`,
      old_values: oldRow,
      new_values: row,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);

    return success(res, row, 'Global access patched');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const deleteGlobalAccess = async (req, res, next) => {
  try {
    const org_id = await resolveOrganizationId(req);
    const global_access_id = parsePositiveInt(req.params.id, 'id');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: org_id });
    const row = await globalAccessModel.deleteGlobalAccess(org_id, global_access_id);
    if (!row) {
      const err = new Error('Global access record not found');
      err.status = 404;
      throw err;
    }

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: org_id,
      target_type: 'global_access',
      target_id: row.global_access_id,
      action: 'global_access.delete',
      action_category: 'authorization',
      action_subtype: 'global_member_access_delete',
      description: `Global access ${row.global_access_id} deleted in org ${org_id}`,
      old_values: row,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);

    return success(res, row, 'Global access deleted');
  } catch (error) {
    return next(error);
  }
};

const getAllowedUsersByOrgAndUser = async (req, res, next) => {
  try {
    const org_id = await resolveOrganizationId(req);
    const user_id = parsePositiveInt(req.query.user_id, 'user_id');
    const rows = await withEntityCache(ENTITY, req, async () =>
      globalAccessModel.getAllowedUsersByOrgAndUser(org_id, user_id)
    );

    return success(
      res,
      {
        org_id,
        user_id,
        count: rows.length,
        rows,
      },
      'Allowed users for global member retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getGlobalAccesses,
  getGlobalAccess,
  createGlobalAccess,
  updateGlobalAccess,
  patchGlobalAccess,
  deleteGlobalAccess,
  getAllowedUsersByOrgAndUser,
};
