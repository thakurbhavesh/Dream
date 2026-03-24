const timezoneModel = require('../models/timezoneModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'timezones';

const createTimezone = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const timezone = await timezoneModel.createTimezone(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'timezone',
      target_id: timezone.timezone_id,
      action: 'timezone.create',
      action_category: 'master_data',
      action_subtype: 'timezone_create',
      description: `Timezone ${timezone.timezone_code} created`,
      new_values: timezone,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, timezone, 'Timezone created', 201);
  } catch (error) {
    return next(error);
  }
};

const getTimezones = async (req, res, next) => {
  try {
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await timezoneModel.findAll({ search, limit, offset });
      return { count: total, rows };
    });
    return success(res, data, 'Timezones retrieved');
  } catch (error) {
    return next(error);
  }
};

const getTimezone = async (req, res, next) => {
  try {
    const timezone = await withEntityCache(ENTITY, req, async () => {
      const found = await timezoneModel.findById(req.params.id);
      if (!found) {
        const err = new Error('Timezone not found');
        err.status = 404;
        throw err;
      }
      return found;
    });

    return success(res, timezone, 'Timezone retrieved');
  } catch (error) {
    return next(error);
  }
};

const updateTimezone = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldTimezone = await timezoneModel.findById(req.params.id);
    const timezone = await timezoneModel.updateTimezonePartial(req.params.id, req.body);
    if (!timezone) {
      const err = new Error('Timezone not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'timezone',
      target_id: timezone.timezone_id,
      action: 'timezone.update',
      action_category: 'master_data',
      action_subtype: 'timezone_update',
      description: `Timezone ${timezone.timezone_code} updated`,
      old_values: oldTimezone,
      new_values: timezone,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, timezone, 'Timezone updated');
  } catch (error) {
    return next(error);
  }
};

const patchTimezone = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldTimezone = await timezoneModel.findById(req.params.id);
    const timezone = await timezoneModel.updateTimezonePartial(req.params.id, req.body);
    if (!timezone) {
      const err = new Error('Timezone not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'timezone',
      target_id: timezone.timezone_id,
      action: 'timezone.patch',
      action_category: 'master_data',
      action_subtype: 'timezone_patch',
      description: `Timezone ${timezone.timezone_code} patched`,
      old_values: oldTimezone,
      new_values: timezone,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, timezone, 'Timezone updated');
  } catch (error) {
    return next(error);
  }
};

const deleteTimezone = async (req, res, next) => {
  try {
    const deleted = await timezoneModel.deleteTimezone(req.params.id);
    if (!deleted) {
      const err = new Error('Timezone not found');
      err.status = 404;
      throw err;
    }
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Timezone deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createTimezone,
  getTimezones,
  getTimezone,
  updateTimezone,
  patchTimezone,
  deleteTimezone,
};
