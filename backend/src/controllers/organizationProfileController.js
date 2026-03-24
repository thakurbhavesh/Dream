const model = require('../models/organizationProfileModel');
const { success } = require('../utils/response');
const { signProfileFields, signProfileFieldsArray } = require('../utils/signProfileUrls');

const resolveOrg = (req) => {
  const orgId = Number(req.user?.org);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    const e = new Error('Valid organization context required'); e.status = 400; throw e;
  }
  return orgId;
};

// GET /organization/overview
const getOverview = async (req, res, next) => {
  try {
    const orgId = resolveOrg(req);
    const overview = await model.getOrganizationOverview(orgId);
    if (!overview) {
      const e = new Error('Organization not found'); e.status = 404; throw e;
    }
    return success(res, overview, 'Organization overview retrieved');
  } catch (err) {
    return next(err);
  }
};

// GET /organization/members
const getMembers = async (req, res, next) => {
  try {
    const orgId = resolveOrg(req);
    const {
      search,
      status,
      role_id,
      department_id,
      designation_id,
      location_id,
      limit = 50,
      offset = 0,
    } = req.query;

    const { members, total } = await model.getMembers(orgId, {
      search,
      status,
      role_id,
      department_id,
      designation_id,
      location_id,
      limit: Math.min(Number(limit) || 50, 200),
      offset: Number(offset) || 0,
    });

    await signProfileFieldsArray(members);

    return success(res, { members, total, limit: Number(limit), offset: Number(offset) }, 'Members retrieved');
  } catch (err) {
    return next(err);
  }
};

// GET /organization/members/:userId
const getMember = async (req, res, next) => {
  try {
    const orgId = resolveOrg(req);
    const userId = Number(req.params.userId);
    if (!userId) {
      const e = new Error('Invalid user id'); e.status = 400; throw e;
    }
    const member = await model.getMember(orgId, userId);
    if (!member) {
      const e = new Error('Member not found'); e.status = 404; throw e;
    }
    await signProfileFields(member);
    return success(res, member, 'Member retrieved');
  } catch (err) {
    return next(err);
  }
};

// GET /organization/departments
const getDepartments = async (req, res, next) => {
  try {
    const orgId = resolveOrg(req);
    const departments = await model.getDepartments(orgId);
    return success(res, { departments }, 'Departments retrieved');
  } catch (err) {
    return next(err);
  }
};

// GET /organization/designations
const getDesignations = async (req, res, next) => {
  try {
    const orgId = resolveOrg(req);
    const designations = await model.getDesignations(orgId);
    return success(res, { designations }, 'Designations retrieved');
  } catch (err) {
    return next(err);
  }
};

// GET /organization/locations
const getLocations = async (req, res, next) => {
  try {
    const orgId = resolveOrg(req);
    const locations = await model.getLocations(orgId);
    return success(res, { locations }, 'Locations retrieved');
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getOverview,
  getMembers,
  getMember,
  getDepartments,
  getDesignations,
  getLocations,
};
