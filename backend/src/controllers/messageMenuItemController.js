const messageMenuItemModel = require('../models/messageMenuItemModel');
const { success } = require('../utils/response');
const { parsePagination, parseSearch } = require('../utils/common/common_function');
const { withEntityCache, bumpEntityVersion } = require('../utils/cache');
const { buildRequestMeta, buildActorFromRequest, logActivitySafe } = require('../utils/activityLog');

const ENTITY = 'message_menu_items';

const createMenuItem = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const item = await messageMenuItemModel.createMenuItem(req.body);
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'message_menu_item',
      target_id: item.menu_item_id,
      action: 'message_menu_item.create',
      action_category: 'master_data',
      action_subtype: 'menu_item_create',
      description: `Message menu item ${item.menu_key} created`,
      new_values: item,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, item, 'Menu item created', 201);
  } catch (error) {
    return next(error);
  }
};

const getMenuItems = async (req, res, next) => {
  try {
    const data = await withEntityCache(ENTITY, req, async () => {
      const { limit, offset } = parsePagination(req.query);
      const search = parseSearch(req.query);
      const { rows, total } = await messageMenuItemModel.findAll({ search, limit, offset });
      return { count: total, rows };
    });
    return success(res, data, 'Menu items retrieved');
  } catch (error) {
    return next(error);
  }
};

const getMenuItem = async (req, res, next) => {
  try {
    const item = await withEntityCache(ENTITY, req, async () => {
      const found = await messageMenuItemModel.findById(req.params.id);
      if (!found) {
        const err = new Error('Menu item not found');
        err.status = 404;
        throw err;
      }
      return found;
    });

    return success(res, item, 'Menu item retrieved');
  } catch (error) {
    return next(error);
  }
};

const updateMenuItem = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldItem = await messageMenuItemModel.findById(req.params.id);
    const item = await messageMenuItemModel.updateMenuItemPartial(req.params.id, req.body);
    if (!item) {
      const err = new Error('Menu item not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'message_menu_item',
      target_id: item.menu_item_id,
      action: 'message_menu_item.update',
      action_category: 'master_data',
      action_subtype: 'menu_item_update',
      description: `Message menu item ${item.menu_key} updated`,
      old_values: oldItem,
      new_values: item,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, item, 'Menu item updated');
  } catch (error) {
    return next(error);
  }
};

const patchMenuItem = async (req, res, next) => {
  try {
    const requestMeta = buildRequestMeta(req);
    const actor = buildActorFromRequest(req);
    const oldItem = await messageMenuItemModel.findById(req.params.id);
    const item = await messageMenuItemModel.updateMenuItemPartial(req.params.id, req.body);
    if (!item) {
      const err = new Error('Menu item not found or no fields to update');
      err.status = 404;
      throw err;
    }
    await logActivitySafe({
      ...actor,
      ...requestMeta,
      target_type: 'message_menu_item',
      target_id: item.menu_item_id,
      action: 'message_menu_item.patch',
      action_category: 'master_data',
      action_subtype: 'menu_item_patch',
      description: `Message menu item ${item.menu_key} patched`,
      old_values: oldItem,
      new_values: item,
      is_successful: true,
      status: 'success',
    });
    bumpEntityVersion(ENTITY);
    return success(res, item, 'Menu item updated');
  } catch (error) {
    return next(error);
  }
};

const deleteMenuItem = async (req, res, next) => {
  try {
    const deleted = await messageMenuItemModel.deleteMenuItem(req.params.id);
    if (!deleted) {
      const err = new Error('Menu item not found');
      err.status = 404;
      throw err;
    }
    bumpEntityVersion(ENTITY);
    return success(res, null, 'Menu item deleted');
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createMenuItem,
  getMenuItems,
  getMenuItem,
  updateMenuItem,
  patchMenuItem,
  deleteMenuItem,
};
