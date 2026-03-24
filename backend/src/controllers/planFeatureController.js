const planFeatureModel = require('../models/planFeatureModel');
const planModel = require('../models/planModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'plan_features';

const createPlanFeature = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const feature = await planFeatureModel.createPlanFeature(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'plan_feature',
      target_id: feature.plan_feature_id,
      action: 'plan_feature.create',
      action_category: 'plan_management',
      action_subtype: 'plan_feature_create',
      description: `Plan feature ${feature.plan_feature_id} created for plan ${feature.plan_id}`,
      new_values: feature,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, feature, 'Plan feature created', 201);
  } catch (error) {
    return next(error);
  }
};

const getPlanFeatures = async (req, res, next) => {
  try {
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await planFeatureModel.findAll({
        search,
        limit,
        offset,
        plan_id: req.query.plan_id ? Number(req.query.plan_id) : undefined,
        status: req.query.status || undefined,
      });
      return { count: total, rows };
    });
    return success(res, data, 'Plan features retrieved');
  } catch (error) {
    return next(error);
  }
};

const getPlanFeature = async (req, res, next) => {
  try {
    const feature = await withEntityCache(ENTITY, req, async () => {
      const found = await planFeatureModel.findById(req.params.id);
      if (!found) {
        const err = new Error('Plan feature not found');
        err.status = 404;
        throw err;
      }
      return found;
    });
    return success(res, feature, 'Plan feature retrieved');
  } catch (error) {
    return next(error);
  }
};

const updatePlanFeature = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldFeature = await planFeatureModel.findById(req.params.id);
    const feature = await planFeatureModel.updatePlanFeaturePartial(req.params.id, req.body);
    if (!feature) {
      const err = new Error('Plan feature not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'plan_feature',
      target_id: feature.plan_feature_id,
      action: 'plan_feature.update',
      action_category: 'plan_management',
      action_subtype: 'plan_feature_update',
      description: `Plan feature ${feature.plan_feature_id} updated`,
      old_values: oldFeature,
      new_values: feature,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, feature, 'Plan feature updated');
  } catch (error) {
    return next(error);
  }
};

const patchPlanFeature = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldFeature = await planFeatureModel.findById(req.params.id);
    const feature = await planFeatureModel.updatePlanFeaturePartial(req.params.id, req.body);
    if (!feature) {
      const err = new Error('Plan feature not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'plan_feature',
      target_id: feature.plan_feature_id,
      action: 'plan_feature.patch',
      action_category: 'plan_management',
      action_subtype: 'plan_feature_patch',
      description: `Plan feature ${feature.plan_feature_id} patched`,
      old_values: oldFeature,
      new_values: feature,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, feature, 'Plan feature updated');
  } catch (error) {
    return next(error);
  }
};

const getPlanFeatureSummary = async (req, res, next) => {
  try {
    const plan_id = Number(req.params.planId || req.query.plan_id);
    if (!Number.isFinite(plan_id) || plan_id <= 0) {
      const err = new Error('plan_id must be a positive number');
      err.status = 400;
      throw err;
    }

    const requestedStatus = String(req.query.status || 'all').toLowerCase();
    if (!['all', 'active', 'inactive'].includes(requestedStatus)) {
      const err = new Error('status must be one of all, active, inactive');
      err.status = 400;
      throw err;
    }

    const plan = await planModel.findById(plan_id);
    if (!plan) {
      const err = new Error('Plan not found');
      err.status = 404;
      throw err;
    }

    const counts = await planFeatureModel.getStatusCountsByPlanId(plan_id);
    const features = await planFeatureModel.findByPlanIdAndStatus({
      plan_id,
      status: requestedStatus,
    });

    return success(
      res,
      {
        plan: {
          plan_id: plan.plan_id,
          plan_key: plan.plan_key,
          plan_name: plan.plan_name,
          price: plan.price,
          interval_days: plan.interval_days,
          max_users: plan.max_users,
          max_storage_mb: plan.max_storage_mb,
          status: plan.status,
        },
        status_filter: requestedStatus,
        counts: {
          total: Number(counts.total || 0),
          active: Number(counts.active || 0),
          inactive: Number(counts.inactive || 0),
          filtered: features.length,
        },
        features,
      },
      'Plan feature summary retrieved'
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPlanFeature,
  getPlanFeatures,
  getPlanFeature,
  updatePlanFeature,
  patchPlanFeature,
  getPlanFeatureSummary,
};
