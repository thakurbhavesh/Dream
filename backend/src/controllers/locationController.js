const locationModel = require('../models/locationModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'locations';
const resolveOrganizationId = (req, fallback = null) => {
  const tokenOrgId = Number(req.user?.org || 0);
  if (Number.isFinite(tokenOrgId) && tokenOrgId > 0) return tokenOrgId;

  const bodyOrgId = Number(req.body?.organization_id || 0);
  if (Number.isFinite(bodyOrgId) && bodyOrgId > 0) return bodyOrgId;

  const queryOrgId = Number(req.query?.organization_id || 0);
  if (Number.isFinite(queryOrgId) && queryOrgId > 0) return queryOrgId;

  return fallback;
};

const createLocation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error('Valid organization context is required');
      err.status = 400;
      throw err;
    }

    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organizationId });
    const location = await locationModel.createLocation({
      ...req.body,
      organization_id: organizationId,
    });
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: location.organization_id || actor.context_organization_id,
      target_type: 'location',
      target_id: location.location_id,
      action: 'location.create',
      action_category: 'organization_structure',
      action_subtype: 'location_create',
      description: `Location ${location.label} created`,
      new_values: location,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, location, 'Location created', 201);
  } catch (error) {
    return next(error);
  }
};

const getLocations = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await locationModel.findAll({
        organization_id: organizationId,
        search,
        limit,
        offset,
      });
      return { count: total, rows };
    });

    return success(res, data, 'Locations retrieved');
  } catch (error) {
    return next(error);
  }
};

const getLocation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const location = await withEntityCache(ENTITY, req, async () => {
      const found = await locationModel.findById(req.params.id);
      if (!found || Number(found.organization_id) !== Number(organizationId)) {
        const err = new Error('Location not found');
        err.status = 404;
        throw err;
      }
      return found;
    });

    return success(res, location, 'Location retrieved');
  } catch (error) {
    return next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldLocation = await locationModel.findById(req.params.id);
    if (!oldLocation || Number(oldLocation.organization_id) !== Number(organizationId)) {
      const err = new Error('Location not found');
      err.status = 404;
      throw err;
    }
    const location = await locationModel.updateLocationPartial(req.params.id, req.body);
    if (!location) {
      const err = new Error('Location not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: location.organization_id || actor.context_organization_id,
      target_type: 'location',
      target_id: location.location_id,
      action: 'location.update',
      action_category: 'organization_structure',
      action_subtype: 'location_update',
      description: `Location ${location.label} updated`,
      old_values: oldLocation,
      new_values: location,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, location, 'Location updated');
  } catch (error) {
    return next(error);
  }
};

const patchLocation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldLocation = await locationModel.findById(req.params.id);
    if (!oldLocation || Number(oldLocation.organization_id) !== Number(organizationId)) {
      const err = new Error('Location not found');
      err.status = 404;
      throw err;
    }
    const location = await locationModel.updateLocationPartial(req.params.id, req.body);
    if (!location) {
      const err = new Error('Location not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: location.organization_id || actor.context_organization_id,
      target_type: 'location',
      target_id: location.location_id,
      action: 'location.patch',
      action_category: 'organization_structure',
      action_subtype: 'location_patch',
      description: `Location ${location.label} patched`,
      old_values: oldLocation,
      new_values: location,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, location, 'Location updated');
  } catch (error) {
    return next(error);
  }
};

const deleteLocation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const oldLocation = await locationModel.findById(req.params.id);
    if (!oldLocation || Number(oldLocation.organization_id) !== Number(organizationId)) {
      const err = new Error('Location not found');
      err.status = 404;
      throw err;
    }
    const deleted = await locationModel.deleteLocation(req.params.id);
    if (!deleted) {
      const err = new Error('Location not found');
      err.status = 404;
      throw err;
    }
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Location deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createLocation,
  getLocations,
  getLocation,
  updateLocation,
  patchLocation,
  deleteLocation,
};
