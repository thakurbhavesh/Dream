const designationModel = require('../models/designationModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'designations';

const normalizeDesignationError = (error) => {
  const code = String(error?.code || '').trim();
  const constraint = String(error?.constraint || '').trim().toLowerCase();

  if (code === '23505') {
    if (constraint.includes('uk_desig_org_dept_name')) {
      const mapped = new Error('Designation already exists in this department');
      mapped.status = 409;
      return mapped;
    }
    if (constraint.includes('uk_desig_org_name')) {
      const mapped = new Error(
        'Designation uniqueness is still organization-wide in DB. Run migration 021 to allow same designation in different departments.'
      );
      mapped.status = 409;
      return mapped;
    }
  }

  if (constraint.includes('uk_desig_org_name')) {
    const mapped = new Error(
      'Designation uniqueness is still organization-wide in DB. Run migration 021 to allow same designation in different departments.'
    );
    mapped.status = 409;
    return mapped;
  }

  if (constraint.includes('uk_desig_org_dept_name')) {
    const mapped = new Error('Designation already exists in this department');
    mapped.status = 409;
    return mapped;
  }

  return error;
};
const resolveOrganizationId = (req, fallback = null) => {
  const tokenOrgId = Number(req.user?.org || 0);
  if (Number.isFinite(tokenOrgId) && tokenOrgId > 0) return tokenOrgId;

  const bodyOrgId = Number(req.body?.organization_id || 0);
  if (Number.isFinite(bodyOrgId) && bodyOrgId > 0) return bodyOrgId;

  const queryOrgId = Number(req.query?.organization_id || 0);
  if (Number.isFinite(queryOrgId) && queryOrgId > 0) return queryOrgId;

  return fallback;
};

const createDesignation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const err = new Error('Valid organization context is required');
      err.status = 400;
      throw err;
    }

    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req, { context_organization_id: organizationId });
    const designation = await designationModel.createDesignation({
      ...req.body,
      organization_id: organizationId,
    });
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: designation.organization_id || actor.context_organization_id,
      target_type: 'designation',
      target_id: designation.designation_id,
      action: 'designation.create',
      action_category: 'organization_structure',
      action_subtype: 'designation_create',
      description: `Designation ${designation.name} created`,
      new_values: designation,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, designation, 'Designation created', 201);
  } catch (error) {
    return next(normalizeDesignationError(error));
  }
};

const getDesignations = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await designationModel.findAll({
        organization_id: organizationId,
        department_id: req.query.department_id,
        search,
        limit,
        offset,
      });
      return { count: total, rows };
    });

    return success(res, data, 'Designations retrieved');
  } catch (error) {
    return next(normalizeDesignationError(error));
  }
};

const getDesignation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const designation = await withEntityCache(ENTITY, req, async () => {
      const found = await designationModel.findById(req.params.id);
      if (!found || Number(found.organization_id) !== Number(organizationId)) {
        const err = new Error('Designation not found');
        err.status = 404;
        throw err;
      }
      return found;
    });

    return success(res, designation, 'Designation retrieved');
  } catch (error) {
    return next(normalizeDesignationError(error));
  }
};

const updateDesignation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldDesignation = await designationModel.findById(req.params.id);
    if (!oldDesignation || Number(oldDesignation.organization_id) !== Number(organizationId)) {
      const err = new Error('Designation not found');
      err.status = 404;
      throw err;
    }
    const designation = await designationModel.updateDesignationPartial(req.params.id, req.body);
    if (!designation) {
      const err = new Error('Designation not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: designation.organization_id || actor.context_organization_id,
      target_type: 'designation',
      target_id: designation.designation_id,
      action: 'designation.update',
      action_category: 'organization_structure',
      action_subtype: 'designation_update',
      description: `Designation ${designation.name} updated`,
      old_values: oldDesignation,
      new_values: designation,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, designation, 'Designation updated');
  } catch (error) {
    return next(normalizeDesignationError(error));
  }
};

const patchDesignation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldDesignation = await designationModel.findById(req.params.id);
    if (!oldDesignation || Number(oldDesignation.organization_id) !== Number(organizationId)) {
      const err = new Error('Designation not found');
      err.status = 404;
      throw err;
    }
    const designation = await designationModel.updateDesignationPartial(req.params.id, req.body);
    if (!designation) {
      const err = new Error('Designation not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      context_organization_id: designation.organization_id || actor.context_organization_id,
      target_type: 'designation',
      target_id: designation.designation_id,
      action: 'designation.patch',
      action_category: 'organization_structure',
      action_subtype: 'designation_patch',
      description: `Designation ${designation.name} patched`,
      old_values: oldDesignation,
      new_values: designation,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, designation, 'Designation updated');
  } catch (error) {
    return next(normalizeDesignationError(error));
  }
};

const deleteDesignation = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req);
    const oldDesignation = await designationModel.findById(req.params.id);
    if (!oldDesignation || Number(oldDesignation.organization_id) !== Number(organizationId)) {
      const err = new Error('Designation not found');
      err.status = 404;
      throw err;
    }
    const deleted = await designationModel.deleteDesignation(req.params.id);
    if (!deleted) {
      const err = new Error('Designation not found');
      err.status = 404;
      throw err;
    }
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Designation deleted');
  } catch (error) {
    return next(normalizeDesignationError(error));
  }
};

module.exports = {
  createDesignation,
  getDesignations,
  getDesignation,
  updateDesignation,
  patchDesignation,
  deleteDesignation,
};
