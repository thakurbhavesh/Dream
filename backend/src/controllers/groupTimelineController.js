const groupTimelineModel = require('../models/groupTimelineModel');
const { success } = require('../utils/response');
const { parsePagination } = require('../utils/common/common_function');
const { withEntityCache } = require('../utils/cache');

const GROUP_TIMELINE_ENTITY = 'group_timeline';

const parsePositiveInt = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const err = new Error(`${fieldName} must be a positive number`);
    err.status = 400;
    throw err;
  }
  return parsed;
};

const resolveOrganizationId = (req, fallbackValue) => {
  const bodyOrg = req.body?.organization_id;
  const tokenOrg = req.user?.org;
  const raw = bodyOrg !== undefined ? bodyOrg : (fallbackValue !== undefined ? fallbackValue : tokenOrg);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const err = new Error('organization_id is required (body or login token org)');
    err.status = 400;
    throw err;
  }
  return parsed;
};

const getGroupTimeline = async (req, res, next) => {
  try {
    const organizationId = resolveOrganizationId(req, req.query?.organization_id);
    const data = await withEntityCache(GROUP_TIMELINE_ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      return groupTimelineModel.findTimeline({
        group_id: parsePositiveInt(req.query.group_id, 'group_id'),
        organization_id: organizationId,
        event_type: req.query.event_type ? String(req.query.event_type).trim() : undefined,
        status: req.query.status ? String(req.query.status).trim().toLowerCase() : undefined,
        limit,
        offset,
      });
    });

    return success(res, { count: data.total, rows: data.rows }, 'Group timeline retrieved');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getGroupTimeline,
};
