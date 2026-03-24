const db = require('../config/database');
const restrictionModel = require('../models/organizationRestrictionModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const parsePositiveInt = (value, fieldName = 'id') => {
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
  const requestedOrgId = Number(req.query?.organization_id || req.body?.organization_id);
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
    const duplicateIpConstraint =
      error.constraint === 'uk_org_ip_restriction' ||
      error.constraint === 'organization_ip_restrictions_organization_id_ip_address_key' ||
      String(error.detail || '').includes('(organization_id, ip_address)');

    const duplicatePlatformConstraint =
      error.constraint === 'uk_org_platform_restriction' ||
      error.constraint === 'organization_platform_restrictions_organization_id_platform_id_key' ||
      String(error.detail || '').includes('(organization_id, platform_id)');

    if (duplicateIpConstraint) {
      error.message = 'IP restriction already exists for this organization';
    } else if (duplicatePlatformConstraint) {
      error.message = 'Platform restriction already exists for this organization';
    }
    return error;
  }

  if (error?.code === '23503') {
    error.status = 400;
    if (error.constraint === 'fk_plat_platform') {
      error.message = 'Invalid platform_id: platform does not exist';
    } else if (error.constraint === 'fk_ip_org' || error.constraint === 'fk_plat_org') {
      error.message = 'Invalid organization_id: organization does not exist';
    }
    return error;
  }

  return error;
};

const getIpRestrictions = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);
    const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;

    if (status && !['active', 'inactive'].includes(status)) {
      const err = new Error('status must be active or inactive');
      err.status = 400;
      throw err;
    }

    const data = await restrictionModel.findIpRestrictions({
      organization_id,
      search,
      status,
      limit,
      offset,
    });

    return success(res, { count: data.total, rows: data.rows }, 'Organization IP restrictions retrieved');
  } catch (error) {
    return next(error);
  }
};

const getIpRestrictionById = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const restriction_id = parsePositiveInt(req.params.id, 'id');
    const found = await restrictionModel.findIpRestrictionById(organization_id, restriction_id);
    if (!found) {
      const err = new Error('Organization IP restriction not found');
      err.status = 404;
      throw err;
    }

    return success(res, found, 'Organization IP restriction retrieved');
  } catch (error) {
    return next(error);
  }
};

const createIpRestriction = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });

    const created = await restrictionModel.createIpRestriction({
      organization_id,
      ip_address: req.body.ip_address,
      status: req.body.status || 'active',
      note: req.body.note ?? null,
    });

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_ip_restriction',
      target_id: created.restriction_id,
      action: 'organization_ip_restriction.create',
      action_category: 'security',
      action_subtype: 'ip_restriction_create',
      description: `IP restriction ${created.restriction_id} created in organization ${organization_id}`,
      new_values: created,
      is_successful: true,
      status: 'success',
    });

    return success(res, created, 'Organization IP restriction created', 201);
  } catch (error) {
    return next(handlePgError(error));
  }
};

const putIpRestriction = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const restriction_id = parsePositiveInt(req.params.id, 'id');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const oldRow = await restrictionModel.findIpRestrictionById(organization_id, restriction_id);

    const updated = await restrictionModel.updateIpRestriction(
      organization_id,
      restriction_id,
      {
        ip_address: req.body.ip_address,
        status: req.body.status || 'active',
        note: req.body.note ?? null,
      },
      { partial: false }
    );

    if (!updated) {
      const err = new Error('Organization IP restriction not found');
      err.status = 404;
      throw err;
    }

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_ip_restriction',
      target_id: updated.restriction_id,
      action: 'organization_ip_restriction.update',
      action_category: 'security',
      action_subtype: 'ip_restriction_update',
      description: `IP restriction ${updated.restriction_id} updated in organization ${organization_id}`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });

    return success(res, updated, 'Organization IP restriction updated');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const patchIpRestriction = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const restriction_id = parsePositiveInt(req.params.id, 'id');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const oldRow = await restrictionModel.findIpRestrictionById(organization_id, restriction_id);

    const updated = await restrictionModel.updateIpRestriction(organization_id, restriction_id, req.body, {
      partial: true,
    });

    if (!updated) {
      const err = new Error('Organization IP restriction not found');
      err.status = 404;
      throw err;
    }

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_ip_restriction',
      target_id: updated.restriction_id,
      action: 'organization_ip_restriction.patch',
      action_category: 'security',
      action_subtype: 'ip_restriction_patch',
      description: `IP restriction ${updated.restriction_id} patched in organization ${organization_id}`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });

    return success(res, updated, 'Organization IP restriction patched');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const getPlatformRestrictions = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);
    const platform_id = req.query.platform_id ? parsePositiveInt(req.query.platform_id, 'platform_id') : undefined;
    const restriction_type = req.query.restriction_type
      ? String(req.query.restriction_type).toLowerCase()
      : undefined;
    const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;

    if (restriction_type && !['allow', 'block'].includes(restriction_type)) {
      const err = new Error('restriction_type must be allow or block');
      err.status = 400;
      throw err;
    }
    if (status && !['active', 'inactive'].includes(status)) {
      const err = new Error('status must be active or inactive');
      err.status = 400;
      throw err;
    }

    const data = await restrictionModel.findPlatformRestrictions({
      organization_id,
      search,
      platform_id,
      restriction_type,
      status,
      limit,
      offset,
    });

    return success(res, { count: data.total, rows: data.rows }, 'Organization platform restrictions retrieved');
  } catch (error) {
    return next(error);
  }
};

const getPlatformRestrictionById = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const restriction_id = parsePositiveInt(req.params.id, 'id');
    const found = await restrictionModel.findPlatformRestrictionById(organization_id, restriction_id);
    if (!found) {
      const err = new Error('Organization platform restriction not found');
      err.status = 404;
      throw err;
    }

    return success(res, found, 'Organization platform restriction retrieved');
  } catch (error) {
    return next(error);
  }
};

const createPlatformRestriction = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });

    const created = await restrictionModel.createPlatformRestriction({
      organization_id,
      platform_id: req.body.platform_id,
      restriction_type: req.body.restriction_type,
      status: req.body.status || 'active',
      note: req.body.note ?? null,
    });
    const row = await restrictionModel.findPlatformRestrictionById(organization_id, created.restriction_id);

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_platform_restriction',
      target_id: created.restriction_id,
      action: 'organization_platform_restriction.create',
      action_category: 'security',
      action_subtype: 'platform_restriction_create',
      description: `Platform restriction ${created.restriction_id} created in organization ${organization_id}`,
      new_values: row || created,
      is_successful: true,
      status: 'success',
    });

    return success(res, row || created, 'Organization platform restriction created', 201);
  } catch (error) {
    return next(handlePgError(error));
  }
};

const putPlatformRestriction = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const restriction_id = parsePositiveInt(req.params.id, 'id');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const oldRow = await restrictionModel.findPlatformRestrictionById(organization_id, restriction_id);

    const updated = await restrictionModel.updatePlatformRestriction(
      organization_id,
      restriction_id,
      {
        platform_id: req.body.platform_id,
        restriction_type: req.body.restriction_type,
        status: req.body.status || 'active',
        note: req.body.note ?? null,
      },
      { partial: false }
    );

    if (!updated) {
      const err = new Error('Organization platform restriction not found');
      err.status = 404;
      throw err;
    }

    const row = await restrictionModel.findPlatformRestrictionById(organization_id, restriction_id);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_platform_restriction',
      target_id: restriction_id,
      action: 'organization_platform_restriction.update',
      action_category: 'security',
      action_subtype: 'platform_restriction_update',
      description: `Platform restriction ${restriction_id} updated in organization ${organization_id}`,
      old_values: oldRow,
      new_values: row || updated,
      is_successful: true,
      status: 'success',
    });

    return success(res, row || updated, 'Organization platform restriction updated');
  } catch (error) {
    return next(handlePgError(error));
  }
};

const patchPlatformRestriction = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const restriction_id = parsePositiveInt(req.params.id, 'id');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });
    const oldRow = await restrictionModel.findPlatformRestrictionById(organization_id, restriction_id);

    const updated = await restrictionModel.updatePlatformRestriction(
      organization_id,
      restriction_id,
      req.body,
      { partial: true }
    );

    if (!updated) {
      const err = new Error('Organization platform restriction not found');
      err.status = 404;
      throw err;
    }

    const row = await restrictionModel.findPlatformRestrictionById(organization_id, restriction_id);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_platform_restriction',
      target_id: restriction_id,
      action: 'organization_platform_restriction.patch',
      action_category: 'security',
      action_subtype: 'platform_restriction_patch',
      description: `Platform restriction ${restriction_id} patched in organization ${organization_id}`,
      old_values: oldRow,
      new_values: row || updated,
      is_successful: true,
      status: 'success',
    });

    return success(res, row || updated, 'Organization platform restriction patched');
  } catch (error) {
    return next(handlePgError(error));
  }
};

module.exports = {
  getIpRestrictions,
  getIpRestrictionById,
  createIpRestriction,
  putIpRestriction,
  patchIpRestriction,
  getPlatformRestrictions,
  getPlatformRestrictionById,
  createPlatformRestriction,
  putPlatformRestriction,
  patchPlatformRestriction,
};
