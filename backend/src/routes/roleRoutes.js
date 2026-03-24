const { Router } = require('express');
const roleController = require('../controllers/roleController');
const {
  validateRolePayload,
  validateRoleUpdate,
  ensureUniqueRoleKey,
} = require('../middlewares/roleValidation');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');

const router = Router();

router
  .route('/')
  .get(auth, roleController.getRoles)
  .post(auth, requireOwner, validateRolePayload, ensureUniqueRoleKey, roleController.createRole);

router
  .route('/:id')
  .get(auth, roleController.getRole)
  .put(auth, requireOwner, validateRoleUpdate, ensureUniqueRoleKey, roleController.updateRole)
  .patch(auth, requireOwner, validateRoleUpdate, ensureUniqueRoleKey, roleController.patchRole)
  .delete(auth, requireOwner, roleController.deleteRole);

module.exports = router;
