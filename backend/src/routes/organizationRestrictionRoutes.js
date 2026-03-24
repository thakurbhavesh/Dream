const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const controller = require('../controllers/organizationRestrictionController');
const {
  validateCreateIpRestriction,
  validatePutIpRestriction,
  validatePatchIpRestriction,
  validateCreatePlatformRestriction,
  validatePutPlatformRestriction,
  validatePatchPlatformRestriction,
} = require('../middlewares/organizationRestrictionValidation');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/ip')
  .get(auth, controller.getIpRestrictions)
  .post(auth, blockRole4, validateCreateIpRestriction, controller.createIpRestriction);

router
  .route('/ip/:id')
  .get(auth, controller.getIpRestrictionById)
  .put(auth, blockRole4, validatePutIpRestriction, controller.putIpRestriction)
  .patch(auth, blockRole4, validatePatchIpRestriction, controller.patchIpRestriction);

router
  .route('/platform')
  .get(auth, controller.getPlatformRestrictions)
  .post(auth, blockRole4, validateCreatePlatformRestriction, controller.createPlatformRestriction);

router
  .route('/platform/:id')
  .get(auth, controller.getPlatformRestrictionById)
  .put(auth, blockRole4, validatePutPlatformRestriction, controller.putPlatformRestriction)
  .patch(auth, blockRole4, validatePatchPlatformRestriction, controller.patchPlatformRestriction);

module.exports = router;
