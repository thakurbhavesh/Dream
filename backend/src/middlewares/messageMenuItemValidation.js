const messageMenuItemModel = require('../models/messageMenuItemModel');
const { failure } = require('../utils/response');

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const validateMenuItemPayload = (req, res, next) => {
  const { menu_key, label, default_status, scope, tone } = req.body || {};

  if (isMissing(menu_key) || isMissing(label)) {
    return failure(res, 'menu_key and label are required', 400);
  }

  if (default_status && !['show', 'hide', 'disable'].includes(default_status)) {
    return failure(res, 'default_status must be show, hide, or disable', 400);
  }

  if (scope && !['any', 'self', 'admin'].includes(scope)) {
    return failure(res, 'scope must be any, self, or admin', 400);
  }

  if (tone && !['normal', 'danger', 'warning', 'info'].includes(tone)) {
    return failure(res, 'tone must be normal, danger, warning, or info', 400);
  }

  return next();
};

const validateMenuItemUpdate = (req, res, next) => {
  const { default_status, scope, tone } = req.body || {};

  if (default_status && !['show', 'hide', 'disable'].includes(default_status)) {
    return failure(res, 'default_status must be show, hide, or disable', 400);
  }

  if (scope && !['any', 'self', 'admin'].includes(scope)) {
    return failure(res, 'scope must be any, self, or admin', 400);
  }

  if (tone && !['normal', 'danger', 'warning', 'info'].includes(tone)) {
    return failure(res, 'tone must be normal, danger, warning, or info', 400);
  }

  return next();
};

const ensureUniqueMenuKey = async (req, res, next) => {
  try {
    const { menu_key } = req.body || {};
    if (isMissing(menu_key)) return next();

    const existing = await messageMenuItemModel.findByKey(menu_key);
    if (!existing) return next();

    const currentId = req.params.id ? Number(req.params.id) : null;
    if (currentId && existing.menu_item_id === currentId) {
      return next();
    }

    return failure(res, 'menu_key already exists', 409);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validateMenuItemPayload,
  validateMenuItemUpdate,
  ensureUniqueMenuKey,
};
