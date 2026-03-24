const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const groupMemberController = require('../controllers/groupMemberController');
const {
  validateCreateGroupMember,
  validatePutGroupMember,
  validatePatchGroupMember,
} = require('../middlewares/groupMemberValidation');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/')
  .get(auth, groupMemberController.getGroupMembers)
  .post(auth, blockRole4, validateCreateGroupMember, groupMemberController.createGroupMember);

router
  .route('/by-group-name')
  .get(auth, groupMemberController.getGroupMembersByGroupName);

router
  .route('/:id')
  .get(auth, groupMemberController.getGroupMember)
  .put(auth, blockRole4, validatePutGroupMember, groupMemberController.updateGroupMember)
  .patch(auth, blockRole4, validatePatchGroupMember, groupMemberController.patchGroupMember);

module.exports = router;
