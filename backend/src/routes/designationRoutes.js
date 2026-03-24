const { Router } = require('express');
const designationController = require('../controllers/designationController');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const { validateDesignationPayload, validateDesignationUpdate } = require('../middlewares/designationValidation');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/')
  .get(auth, blockRole4, designationController.getDesignations)
  .post(auth, blockRole4, validateDesignationPayload, designationController.createDesignation);

router
  .route('/:id')
  .get(auth, blockRole4, designationController.getDesignation)
  .put(auth, blockRole4, validateDesignationUpdate, designationController.updateDesignation)
  .patch(auth, blockRole4, validateDesignationUpdate, designationController.patchDesignation)
  .delete(auth, blockRole4, designationController.deleteDesignation);

module.exports = router;
