const productFeatureModel = require('../models/productFeatureModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const parsePositiveId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error(`${label} must be a positive integer`);
    err.status = 400;
    throw err;
  }
  return id;
};

const getCatalog = async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
    const data = await productFeatureModel.findCatalog({ status });
    return success(res, data, 'Product feature catalog retrieved');
  } catch (error) {
    return next(error);
  }
};

const getCategories = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);
    const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
    const data = await productFeatureModel.findCategories({
      search,
      status,
      limit,
      offset,
    });
    return success(res, { count: data.total, rows: data.rows }, 'Feature categories retrieved');
  } catch (error) {
    return next(error);
  }
};

const getCategoryById = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.categoryId, 'categoryId');
    const found = await productFeatureModel.getCategoryById(id);
    if (!found) {
      const err = new Error('Feature category not found');
      err.status = 404;
      throw err;
    }
    return success(res, found, 'Feature category retrieved');
  } catch (error) {
    return next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const created = await productFeatureModel.createCategory(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'feature_category',
      target_id: created.feature_category_id,
      action: 'feature_category.create',
      action_category: 'product_settings',
      action_subtype: 'category_create',
      description: `Feature category ${created.category_key} created`,
      new_values: created,
      is_successful: true,
      status: 'success',
    });
    return success(res, created, 'Feature category created', 201);
  } catch (error) {
    return next(error);
  }
};

const putCategory = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.categoryId, 'categoryId');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRow = await productFeatureModel.getCategoryById(id);
    const updated = await productFeatureModel.updateCategoryPartial(id, req.body);
    if (!updated) {
      const err = new Error('Feature category not found');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'feature_category',
      target_id: updated.feature_category_id,
      action: 'feature_category.update',
      action_category: 'product_settings',
      action_subtype: 'category_update',
      description: `Feature category ${updated.category_key} updated`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    return success(res, updated, 'Feature category updated');
  } catch (error) {
    return next(error);
  }
};

const patchCategory = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.categoryId, 'categoryId');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRow = await productFeatureModel.getCategoryById(id);
    const updated = await productFeatureModel.updateCategoryPartial(id, req.body);
    if (!updated) {
      const err = new Error('Feature category not found or no fields provided');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'feature_category',
      target_id: updated.feature_category_id,
      action: 'feature_category.patch',
      action_category: 'product_settings',
      action_subtype: 'category_patch',
      description: `Feature category ${updated.category_key} patched`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    return success(res, updated, 'Feature category patched');
  } catch (error) {
    return next(error);
  }
};

const getItems = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req.query);
    const search = parseSearch(req.query);
    const status = req.query.status ? String(req.query.status).toLowerCase() : undefined;
    const feature_category_id = req.query.feature_category_id
      ? parsePositiveId(req.query.feature_category_id, 'feature_category_id')
      : undefined;
    const category_key = req.query.category_key ? String(req.query.category_key).trim() : undefined;

    const data = await productFeatureModel.findItems({
      search,
      status,
      feature_category_id,
      category_key,
      limit,
      offset,
    });

    return success(res, { count: data.total, rows: data.rows }, 'Product features retrieved');
  } catch (error) {
    return next(error);
  }
};

const getItemById = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id, 'id');
    const found = await productFeatureModel.findItemById(id);
    if (!found) {
      const err = new Error('Product feature not found');
      err.status = 404;
      throw err;
    }
    return success(res, found, 'Product feature retrieved');
  } catch (error) {
    return next(error);
  }
};

const createItem = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const created = await productFeatureModel.createItem(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'feature_item',
      target_id: created.feature_item_id,
      action: 'feature_item.create',
      action_category: 'product_settings',
      action_subtype: 'item_create',
      description: `Feature item ${created.title} created`,
      new_values: created,
      is_successful: true,
      status: 'success',
    });
    return success(res, created, 'Product feature created', 201);
  } catch (error) {
    return next(error);
  }
};

const putItem = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id, 'id');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRow = await productFeatureModel.findItemById(id);
    const updated = await productFeatureModel.updateItemPartial(id, req.body);
    if (!updated) {
      const err = new Error('Product feature not found');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'feature_item',
      target_id: updated.feature_item_id,
      action: 'feature_item.update',
      action_category: 'product_settings',
      action_subtype: 'item_update',
      description: `Feature item ${updated.title} updated`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    return success(res, updated, 'Product feature updated');
  } catch (error) {
    return next(error);
  }
};

const patchItem = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id, 'id');
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldRow = await productFeatureModel.findItemById(id);
    const updated = await productFeatureModel.updateItemPartial(id, req.body);
    if (!updated) {
      const err = new Error('Product feature not found or no fields provided');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'feature_item',
      target_id: updated.feature_item_id,
      action: 'feature_item.patch',
      action_category: 'product_settings',
      action_subtype: 'item_patch',
      description: `Feature item ${updated.title} patched`,
      old_values: oldRow,
      new_values: updated,
      is_successful: true,
      status: 'success',
    });
    return success(res, updated, 'Product feature patched');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCatalog,
  getCategories,
  getCategoryById,
  createCategory,
  putCategory,
  patchCategory,
  getItems,
  getItemById,
  createItem,
  putItem,
  patchItem,
};
