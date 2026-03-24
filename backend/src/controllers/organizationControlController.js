const db = require('../config/database');
const controlModel = require('../models/organizationControlModel');
const { success } = require('../utils/response');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');
const { invalidateOrgControlsCache } = require('../socket');

// ── Resolve org from JWT (same pattern as organizationRestrictionController) ──
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

// GET /organization-controls
const getControls = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const rows = await controlModel.findAllControls(organization_id);
    return success(res, { count: rows.length, rows }, 'Organization controls retrieved');
  } catch (error) {
    return next(error);
  }
};

// GET /organization-controls/:feature_key
const getControl = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const { feature_key } = req.params;
    const row = await controlModel.findControl(organization_id, feature_key);
    if (!row) {
      const err = new Error('Control not found');
      err.status = 404;
      throw err;
    }
    return success(res, row, 'Organization control retrieved');
  } catch (error) {
    return next(error);
  }
};

// PUT /organization-controls/:feature_key  (upsert)
const upsertControl = async (req, res, next) => {
  try {
    const organization_id = await resolveOrganizationId(req);
    const { feature_key } = req.params;
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organization_id });

    const oldRow = await controlModel.findControl(organization_id, feature_key);

    const { enabled, time_limit_minutes, allowed_roles } = req.body;
    const row = await controlModel.upsertControl(organization_id, feature_key, {
      enabled,
      time_limit_minutes,
      allowed_roles,
    });

    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: organization_id,
      target_type: 'organization_control',
      target_id: row.control_id,
      action: `organization_control.${oldRow ? 'update' : 'create'}`,
      action_category: 'settings',
      action_subtype: 'control_upsert',
      description: `Control "${feature_key}" upserted for organization ${organization_id}`,
      old_values: oldRow ?? null,
      new_values: row,
      is_successful: true,
      status: 'success',
    });

    // Invalidate socket cache so changes take effect immediately
    invalidateOrgControlsCache(organization_id);

    return success(res, row, 'Organization control saved');
  } catch (error) {
    return next(error);
  }
};

module.exports = { getControls, getControl, upsertControl };
