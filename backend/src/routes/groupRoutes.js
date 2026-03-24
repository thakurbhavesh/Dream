const { Router } = require('express');
const groupController = require('../controllers/groupController');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const {
  validateGroupPayload,
  validateGroupPut,
  validateGroupPatch,
} = require('../middlewares/groupValidation');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/')
  .get(auth, groupController.getGroups)
  .post(auth, blockRole4, validateGroupPayload, groupController.createGroup);

router
  .route('/:id')
  .get(auth, groupController.getGroup)
  .put(auth, blockRole4, validateGroupPut, groupController.updateGroup)
  .patch(auth, blockRole4, validateGroupPatch, groupController.patchGroup);

module.exports = router;

