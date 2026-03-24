const couponModel = require('../models/couponModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'coupons';

const createCoupon = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const created = await couponModel.createCoupon(req.body || {});
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'coupon',
      target_id: created.coupon_id,
      action: 'coupon.create',
      action_category: 'billing',
      action_subtype: 'coupon_create',
      description: `Coupon ${created.coupon_code} created`,
      new_values: created,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, created, 'Coupon created', 201);
  } catch (error) {
    return next(error);
  }
};

const getCoupons = async (req, res, next) => {
  try {
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const status = req.query?.status ? String(req.query.status).trim().toLowerCase() : undefined;
      const found = await couponModel.findAll({ search, status, limit, offset });
      return { count: found.total, rows: found.rows };
    });
    return success(res, data, 'Coupons retrieved');
  } catch (error) {
    return next(error);
  }
};

const getCoupon = async (req, res, next) => {
  try {
    const found = await withEntityCache(ENTITY, req, async () => {
      const row = await couponModel.findById(req.params.id);
      if (!row) {
        const err = new Error('Coupon not found');
        err.status = 404;
        throw err;
      }
      return row;
    });
    return success(res, found, 'Coupon retrieved');
  } catch (error) {
    return next(error);
  }
};

const updateCoupon = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRow = await couponModel.findById(req.params.id);
    const updated = await couponModel.updateCouponPartial(req.params.id, req.body || {});
    if (!updated) {
      const err = new Error('Coupon not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'coupon',
      target_id: updated.coupon_id,
      action: 'coupon.update',
      action_category: 'billing',
      action_subtype: 'coupon_update',
      description: `Coupon ${updated.coupon_code} updated`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, updated, 'Coupon updated');
  } catch (error) {
    return next(error);
  }
};

const patchCoupon = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRow = await couponModel.findById(req.params.id);
    const updated = await couponModel.updateCouponPartial(req.params.id, req.body || {});
    if (!updated) {
      const err = new Error('Coupon not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'coupon',
      target_id: updated.coupon_id,
      action: 'coupon.patch',
      action_category: 'billing',
      action_subtype: 'coupon_patch',
      description: `Coupon ${updated.coupon_code} patched`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, updated, 'Coupon patched');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createCoupon,
  getCoupons,
  getCoupon,
  updateCoupon,
  patchCoupon,
};
