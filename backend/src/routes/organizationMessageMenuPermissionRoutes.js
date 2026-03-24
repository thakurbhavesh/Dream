const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const controller = require('../controllers/organizationMessageMenuPermissionController');
const {
  validateCreatePermission,
  validatePutPermission,
  validatePatchPermission,
} = require('../middlewares/organizationMessageMenuPermissionValidation');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/')
  .get(auth, blockRole4, controller.getPermissions)
  .post(auth, blockRole4, validateCreatePermission, controller.createPermission);

router
  .route('/:id')
  .get(auth, blockRole4, controller.getPermission)
  .put(auth, blockRole4, validatePutPermission, controller.updatePermission)
  .patch(auth, blockRole4, validatePatchPermission, controller.patchPermission);

module.exports = router;

