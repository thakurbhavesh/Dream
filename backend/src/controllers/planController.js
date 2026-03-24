const planModel = require('../models/planModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'plans';

const createPlan = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const plan = await planModel.createPlan(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'plan',
      target_id: plan.plan_id,
      action: 'plan.create',
      action_category: 'master_data',
      action_subtype: 'plan_create',
      description: `Plan ${plan.plan_key} created`,
      new_values: plan,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, plan, 'Plan created', 201);
  } catch (error) {
    return next(error);
  }
};

const getPlans = async (req, res, next) => {
  try {
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await planModel.findAll({ search, limit, offset });
      return { count: total, rows };
    });
    return success(res, data, 'Plans retrieved');
  } catch (error) {
    return next(error);
  }
};

const getPlan = async (req, res, next) => {
  try {
    const plan = await withEntityCache(ENTITY, req, async () => {
      const found = await planModel.findById(req.params.id);
      if (!found) {
        const err = new Error('Plan not found');
        err.status = 404;
        throw err;
      }
      return found;
    });

    return success(res, plan, 'Plan retrieved');
  } catch (error) {
    return next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldPlan = await planModel.findById(req.params.id);
    const plan = await planModel.updatePlanPartial(req.params.id, req.body);
    if (!plan) {
      const err = new Error('Plan not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'plan',
      target_id: plan.plan_id,
      action: 'plan.update',
      action_category: 'master_data',
      action_subtype: 'plan_update',
      description: `Plan ${plan.plan_key} updated`,
      old_values: oldPlan,
      new_values: plan,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, plan, 'Plan updated');
  } catch (error) {
    return next(error);
  }
};

const patchPlan = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldPlan = await planModel.findById(req.params.id);
    const plan = await planModel.updatePlanPartial(req.params.id, req.body);
    if (!plan) {
      const err = new Error('Plan not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'plan',
      target_id: plan.plan_id,
      action: 'plan.patch',
      action_category: 'master_data',
      action_subtype: 'plan_patch',
      description: `Plan ${plan.plan_key} patched`,
      old_values: oldPlan,
      new_values: plan,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, plan, 'Plan updated');
  } catch (error) {
    return next(error);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    const deleted = await planModel.deletePlan(req.params.id);
    if (!deleted) {
      const err = new Error('Plan not found');
      err.status = 404;
      throw err;
    }
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Plan deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPlan,
  getPlans,
  getPlan,
  updatePlan,
  patchPlan,
  deletePlan,
};
