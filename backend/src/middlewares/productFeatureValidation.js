const { failure } = require('../utils/response');
const productFeatureModel = require('../models/productFeatureModel');

const ALLOWED_STATUS = ['active', 'inactive'];

const isNil = (value) => value === undefined || value === null;

const normalizeOptionalText = (value) => {
  if (isNil(value)) return null;
  const parsed = String(value).trim();
  return parsed || null;
};

const normalizeRequiredText = (value, fieldName) => {
  const parsed = normalizeOptionalText(value);
  if (!parsed) {
    const err = new Error(`${fieldName} is required`);
    err.status = 400;
    throw err;
  }
  return parsed;
};

const normalizePositiveInt = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const err = new Error(`${fieldName} must be a positive integer`);
    err.status = 400;
    throw err;
  }
  return parsed;
};

const normalizeStatus = (value, fallback = 'active') => {
  if (isNil(value)) return fallback;
  const status = String(value).trim().toLowerCase();
  if (!ALLOWED_STATUS.includes(status)) {
    const err = new Error('status must be active or inactive');
    err.status = 400;
    throw err;
  }
  return status;
};

const normalizeCreateCategoryPayload = (payload = {}) => ({
  category_key: normalizeRequiredText(payload.category_key, 'category_key').toLowerCase(),
  category_label: normalizeRequiredText(payload.category_label, 'category_label'),
  display_order: isNil(payload.display_order)
    ? 10
    : normalizePositiveInt(payload.display_order, 'display_order'),
  status: normalizeStatus(payload.status, 'active'),
});

const normalizeUpdateCategoryPayload = (payload = {}, { requireAny = true } = {}) => {
  const out = {};

  if (payload.category_key !== undefined) {
    out.category_key = normalizeRequiredText(payload.category_key, 'category_key').toLowerCase();
  }
  if (payload.category_label !== undefined) {
    out.category_label = normalizeRequiredText(payload.category_label, 'category_label');
  }
  if (payload.display_order !== undefined) {
    out.display_order = normalizePositiveInt(payload.display_order, 'display_order');
  }
  if (payload.status !== undefined) {
    out.status = normalizeStatus(payload.status);
  }

  if (requireAny && !Object.keys(out).length) {
    const err = new Error('At least one field is required');
    err.status = 400;
    throw err;
  }

  return out;
};

const normalizeCreateItemPayload = (payload = {}) => ({
  feature_category_id: normalizePositiveInt(payload.feature_category_id, 'feature_category_id'),
  title: normalizeRequiredText(payload.title, 'title'),
  description: normalizeOptionalText(payload.description),
  icon_url: normalizeOptionalText(payload.icon_url),
  display_order: isNil(payload.display_order)
    ? 10
    : normalizePositiveInt(payload.display_order, 'display_order'),
  status: normalizeStatus(payload.status, 'active'),
});

const normalizeUpdateItemPayload = (payload = {}, { requireAny = true } = {}) => {
  const out = {};

  if (payload.feature_category_id !== undefined) {
    out.feature_category_id = normalizePositiveInt(payload.feature_category_id, 'feature_category_id');
  }
  if (payload.title !== undefined) {
    out.title = normalizeRequiredText(payload.title, 'title');
  }
  if (payload.description !== undefined) {
    out.description = normalizeOptionalText(payload.description);
  }
  if (payload.icon_url !== undefined) {
    out.icon_url = normalizeOptionalText(payload.icon_url);
  }
  if (payload.display_order !== undefined) {
    out.display_order = normalizePositiveInt(payload.display_order, 'display_order');
  }
  if (payload.status !== undefined) {
    out.status = normalizeStatus(payload.status);
  }

  if (requireAny && !Object.keys(out).length) {
    const err = new Error('At least one field is required');
    err.status = 400;
    throw err;
  }

  return out;
};

const validateCreateCategory = (req, res, next) => {
  try {
    req.body = normalizeCreateCategoryPayload(req.body || {});
    return next();
  } catch (error) {
    return failure(res, error.message, error.status || 400);
  }
};

const validatePutCategory = (req, res, next) => {
  try {
    req.body = normalizeCreateCategoryPayload(req.body || {});
    return next();
  } catch (error) {
    return failure(res, error.message, error.status || 400);
  }
};

const validatePatchCategory = (req, res, next) => {
  try {
    req.body = normalizeUpdateCategoryPayload(req.body || {}, { requireAny: true });
    return next();
  } catch (error) {
    return failure(res, error.message, error.status || 400);
  }
};

const validateCreateItem = (req, res, next) => {
  try {
    req.body = normalizeCreateItemPayload(req.body || {});
    return next();
  } catch (error) {
    return failure(res, error.message, error.status || 400);
  }
};

const validatePutItem = (req, res, next) => {
  try {
    req.body = normalizeCreateItemPayload(req.body || {});
    return next();
  } catch (error) {
    return failure(res, error.message, error.status || 400);
  }
};

const validatePatchItem = (req, res, next) => {
  try {
    req.body = normalizeUpdateItemPayload(req.body || {}, { requireAny: true });
    return next();
  } catch (error) {
    return failure(res, error.message, error.status || 400);
  }
};

const ensureCategoryExists = async (req, res, next) => {
  try {
    const categoryId = req.body?.feature_category_id;
    if (categoryId === undefined) return next();
    const category = await productFeatureModel.getCategoryById(Number(categoryId));
    if (!category) {
      return failure(res, 'feature_category_id does not exist', 400);
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const ensureUniqueCategoryKey = async (req, res, next) => {
  try {
    const categoryKey = req.body?.category_key;
    if (!categoryKey) return next();

    const existing = await productFeatureModel.getCategoryByKey(categoryKey);
    if (!existing) return next();

    const currentId = req.params.categoryId ? Number(req.params.categoryId) : null;
    if (currentId && Number(existing.feature_category_id) === currentId) {
      return next();
    }

    return failure(res, 'category_key already exists', 409);
  } catch (error) {
    return next(error);
  }
};

const ensureUniqueItemTitlePerCategory = async (req, res, next) => {
  try {
    const title = req.body?.title;
    if (!title) return next();

    let categoryId = req.body?.feature_category_id;
    if (!categoryId && req.params.id) {
      const existingItem = await productFeatureModel.findItemById(req.params.id);
      if (!existingItem) {
        return failure(res, 'Product feature not found', 404);
      }
      categoryId = existingItem.feature_category_id;
    }

    if (!categoryId) {
      return failure(res, 'feature_category_id is required', 400);
    }

    const existing = await productFeatureModel.getItemByCategoryAndTitle(Number(categoryId), title);
    if (!existing) return next();

    const currentId = req.params.id ? Number(req.params.id) : null;
    if (currentId && Number(existing.feature_item_id) === currentId) {
      return next();
    }

    return failure(res, 'title already exists for this category', 409);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validateCreateCategory,
  validatePutCategory,
  validatePatchCategory,
  validateCreateItem,
  validatePutItem,
  validatePatchItem,
  ensureCategoryExists,
  ensureUniqueCategoryKey,
  ensureUniqueItemTitlePerCategory,
};
