const platformModel = require('../models/platformModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'platforms';

const createPlatform = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const platform = await platformModel.createPlatform(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'platform',
      target_id: platform.platform_id,
      action: 'platform.create',
      action_category: 'master_data',
      action_subtype: 'platform_create',
      description: `Platform ${platform.platform_key} created`,
      new_values: platform,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, platform, 'Platform created', 201);
  } catch (error) {
    return next(error);
  }
};

const getPlatforms = async (req, res, next) => {
  try {
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await platformModel.findAll({ search, limit, offset });
      return { count: total, rows };
    });
    return success(res, data, 'Platforms retrieved');
  } catch (error) {
    return next(error);
  }
};

const getPlatform = async (req, res, next) => {
  try {
    const platform = await withEntityCache(ENTITY, req, async () => {
      const found = await platformModel.findById(req.params.id);
      if (!found) {
        const err = new Error('Platform not found');
        err.status = 404;
        throw err;
      }
      return found;
    });

    return success(res, platform, 'Platform retrieved');
  } catch (error) {
    return next(error);
  }
};

const updatePlatform = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldPlatform = await platformModel.findById(req.params.id);
    const platform = await platformModel.updatePlatformPartial(req.params.id, req.body);
    if (!platform) {
      const err = new Error('Platform not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'platform',
      target_id: platform.platform_id,
      action: 'platform.update',
      action_category: 'master_data',
      action_subtype: 'platform_update',
      description: `Platform ${platform.platform_key} updated`,
      old_values: oldPlatform,
      new_values: platform,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, platform, 'Platform updated');
  } catch (error) {
    return next(error);
  }
};

const patchPlatform = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldPlatform = await platformModel.findById(req.params.id);
    const platform = await platformModel.updatePlatformPartial(req.params.id, req.body);
    if (!platform) {
      const err = new Error('Platform not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'platform',
      target_id: platform.platform_id,
      action: 'platform.patch',
      action_category: 'master_data',
      action_subtype: 'platform_patch',
      description: `Platform ${platform.platform_key} patched`,
      old_values: oldPlatform,
      new_values: platform,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, platform, 'Platform updated');
  } catch (error) {
    return next(error);
  }
};

const deletePlatform = async (req, res, next) => {
  try {
    const deleted = await platformModel.deletePlatform(req.params.id);
    if (!deleted) {
      const err = new Error('Platform not found');
      err.status = 404;
      throw err;
    }
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Platform deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPlatform,
  getPlatforms,
  getPlatform,
  updatePlatform,
  patchPlatform,
  deletePlatform,
};
