const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const globalAccessController = require('../controllers/globalAccessController');
const {
  validateCreateGlobalAccess,
  validatePutGlobalAccess,
  validatePatchGlobalAccess,
} = require('../middlewares/globalAccessValidation');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/')
  .get(auth, globalAccessController.getGlobalAccesses)
  .post(auth, blockRole4, validateCreateGlobalAccess, globalAccessController.createGlobalAccess);

router
  .route('/allowed-users')
  .get(auth, globalAccessController.getAllowedUsersByOrgAndUser);

router
  .route('/:id')
  .get(auth, globalAccessController.getGlobalAccess)
  .put(auth, blockRole4, validatePutGlobalAccess, globalAccessController.updateGlobalAccess)
  .patch(auth, blockRole4, validatePatchGlobalAccess, globalAccessController.patchGlobalAccess)
  .delete(auth, blockRole4, globalAccessController.deleteGlobalAccess);

module.exports = router;
