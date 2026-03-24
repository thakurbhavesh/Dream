const planFeatureModel = require('../models/planFeatureModel');
const { failure } = require('../utils/response');

const ALLOWED_STATUS = ['active', 'inactive'];

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const isPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
};

const normalizeOptional = (value) => {
  if (value === undefined || value === null) return null;
  const parsed = String(value).trim();
  return parsed || null;
};

const validateCreatePlanFeature = (req, res, next) => {
  const { plan_id, feature_name, display_order, status } = req.body || {};

  if (!isPositiveNumber(plan_id)) {
    return failure(res, 'plan_id must be a positive number', 400);
  }

  if (isMissing(feature_name)) {
    return failure(res, 'feature_name is required', 400);
  }

  if (display_order !== undefined && !Number.isInteger(Number(display_order))) {
    return failure(res, 'display_order must be an integer', 400);
  }

  if (status && !ALLOWED_STATUS.includes(String(status).toLowerCase())) {
    return failure(res, 'status must be active or inactive', 400);
  }

  req.body.feature_name = String(feature_name).trim();
  req.body.feature_description = normalizeOptional(req.body.feature_description);
  req.body.feature_icon = normalizeOptional(req.body.feature_icon);
  req.body.section_label = normalizeOptional(req.body.section_label) || 'Plan Features';
  if (display_order !== undefined) req.body.display_order = Number(display_order);
  if (status) req.body.status = String(status).toLowerCase();

  return next();
};

const validateUpdatePlanFeature = (req, res, next) => {
  const payload = req.body || {};

  if (payload.plan_id !== undefined && !isPositiveNumber(payload.plan_id)) {
    return failure(res, 'plan_id must be a positive number', 400);
  }

  if (payload.feature_name !== undefined && isMissing(payload.feature_name)) {
    return failure(res, 'feature_name cannot be empty', 400);
  }

  if (payload.display_order !== undefined && !Number.isInteger(Number(payload.display_order))) {
    return failure(res, 'display_order must be an integer', 400);
  }

  if (payload.status !== undefined && !ALLOWED_STATUS.includes(String(payload.status).toLowerCase())) {
    return failure(res, 'status must be active or inactive', 400);
  }

  if (payload.feature_name !== undefined) req.body.feature_name = String(payload.feature_name).trim();
  if (payload.feature_description !== undefined) req.body.feature_description = normalizeOptional(payload.feature_description);
  if (payload.feature_icon !== undefined) req.body.feature_icon = normalizeOptional(payload.feature_icon);
  if (payload.section_label !== undefined) req.body.section_label = normalizeOptional(payload.section_label);
  if (payload.display_order !== undefined) req.body.display_order = Number(payload.display_order);
  if (payload.status !== undefined) req.body.status = String(payload.status).toLowerCase();

  return next();
};

const ensureUniquePlanFeature = async (req, res, next) => {
  try {
    const incomingName = req.body?.feature_name;
    if (incomingName === undefined) {
      return next();
    }

    let planId = req.body?.plan_id;
    if (planId === undefined && req.params.id) {
      const existingById = await planFeatureModel.findById(req.params.id);
      if (!existingById) {
        return failure(res, 'Plan feature not found', 404);
      }
      planId = existingById.plan_id;
    }

    if (!isPositiveNumber(planId)) {
      return failure(res, 'plan_id must be a positive number', 400);
    }

    const existing = await planFeatureModel.findByPlanAndName(Number(planId), incomingName);
    if (!existing) return next();

    const currentId = req.params.id ? Number(req.params.id) : null;
    if (currentId && Number(existing.plan_feature_id) === currentId) {
      return next();
    }

    return failure(res, 'feature_name already exists for this plan', 409);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validateCreatePlanFeature,
  validateUpdatePlanFeature,
  ensureUniquePlanFeature,
};

