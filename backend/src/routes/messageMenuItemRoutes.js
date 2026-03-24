const { Router } = require('express');
const messageMenuItemController = require('../controllers/messageMenuItemController');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const {
  validateMenuItemPayload,
  validateMenuItemUpdate,
  ensureUniqueMenuKey,
} = require('../middlewares/messageMenuItemValidation');

const router = Router();

router
  .route('/')
  .get(auth, messageMenuItemController.getMenuItems)
  .post(auth, requireOwner, validateMenuItemPayload, ensureUniqueMenuKey, messageMenuItemController.createMenuItem);

router
  .route('/:id')
  .get(auth, messageMenuItemController.getMenuItem)
  .put(auth, requireOwner, validateMenuItemUpdate, ensureUniqueMenuKey, messageMenuItemController.updateMenuItem)
  .patch(auth, requireOwner, validateMenuItemUpdate, ensureUniqueMenuKey, messageMenuItemController.patchMenuItem)
  .delete(auth, requireOwner, messageMenuItemController.deleteMenuItem);

module.exports = router;
