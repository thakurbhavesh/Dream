const siteDetailModel = require('../models/siteDetailModel');
const { success } = require('../utils/response');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const parseSiteDetailId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Valid site detail id is required');
    err.status = 400;
    throw err;
  }
  return id;
};

const createSiteDetail = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const created = await siteDetailModel.createSiteDetail(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'site_detail',
      target_id: created.site_detail_id,
      action: 'site_detail.create',
      action_category: 'settings',
      action_subtype: 'site_detail_create',
      description: `Site detail ${created.site_detail_id} created`,
      new_values: created,
      is_successful: true,
      status: 'success',
    });
    return success(res, created, 'Site details created', 201);
  } catch (error) {
    return next(error);
  }
};

const getSiteDetail = async (req, res, next) => {
  try {
    const data = await siteDetailModel.findAll();
    return success(res, data, 'Site details retrieved');
  } catch (error) {
    return next(error);
  }
};

const getSiteDetailById = async (req, res, next) => {
  try {
    const siteDetailId = parseSiteDetailId(req.params.id);
    const found = await siteDetailModel.findById(siteDetailId);
    if (!found) {
      const err = new Error('Site details not found');
      err.status = 404;
      throw err;
    }
    return success(res, found, 'Site details retrieved');
  } catch (error) {
    return next(error);
  }
};

const updateSiteDetail = async (req, res, next) => {
  try {
    const siteDetailId = parseSiteDetailId(req.params.id);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRow = await siteDetailModel.findById(siteDetailId);
    const updated = await siteDetailModel.updateById(siteDetailId, req.body, {
      partial: false,
    });

    if (!updated) {
      const err = new Error('Site details not found');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'site_detail',
      target_id: updated.site_detail_id,
      action: 'site_detail.update',
      action_category: 'settings',
      action_subtype: 'site_detail_update',
      description: `Site detail ${updated.site_detail_id} updated`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    return success(res, updated, 'Site details updated');
  } catch (error) {
    return next(error);
  }
};

const patchSiteDetail = async (req, res, next) => {
  try {
    const siteDetailId = parseSiteDetailId(req.params.id);
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRow = await siteDetailModel.findById(siteDetailId);
    const updated = await siteDetailModel.updateById(siteDetailId, req.body, {
      partial: true,
    });

    if (!updated) {
      const err = new Error('Site details not found or no fields provided');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'site_detail',
      target_id: updated.site_detail_id,
      action: 'site_detail.patch',
      action_category: 'settings',
      action_subtype: 'site_detail_patch',
      description: `Site detail ${updated.site_detail_id} patched`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    return success(res, updated, 'Site details patched');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createSiteDetail,
  getSiteDetail,
  getSiteDetailById,
  updateSiteDetail,
  patchSiteDetail,
};
