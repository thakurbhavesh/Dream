const { Router } = require('express');
const orgUserController = require('../controllers/orgUserController');
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const {
  validateCreateOrgUser,
  validateUpdateOrgUser,
  validateBulkUpdateOrgUsers,
  validateBulkDeleteOrgUsers,
  validateResetOrgUserPassword,
} = require('../middlewares/orgUserValidation');
const {
  authLimiter,
  passwordResetLimiter,
} = require('../middlewares/rateLimiters');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/forgot-password')
  .post(passwordResetLimiter, authController.forgotPassword);

router
  .route('/forgot-verify')
  .post(authLimiter, authController.verifyForgotPasswordOtp);

router
  .route('/')
  .get(auth, blockRole4, orgUserController.getUsers)
  .post(auth, blockRole4, validateCreateOrgUser, orgUserController.createUser);

router
  .route('/directory')
  .get(auth, orgUserController.getDirectory);

router
  .route('/bulk')
  .patch(auth, blockRole4, validateBulkUpdateOrgUsers, orgUserController.bulkUpdateUsers)
  .delete(auth, blockRole4, validateBulkDeleteOrgUsers, orgUserController.bulkDeleteUsers);

router
  .route('/reset-password')
  .post(auth, blockRole4, validateResetOrgUserPassword, orgUserController.resetUserPassword);

router
  .route('/:id')
  .get(auth, blockRole4, orgUserController.getUser)
  .put(auth, blockRole4, validateUpdateOrgUser, orgUserController.updateUser)
  .patch(auth, blockRole4, validateUpdateOrgUser, orgUserController.updateUser)
  .delete(auth, blockRole4, orgUserController.deleteUser);

router
  .route('/:id/deactivate')
  .patch(auth, blockRole4, orgUserController.deactivateUser);

router
  .route('/:id/activate')
  .patch(auth, blockRole4, orgUserController.activateUser);

router
  .route('/:id/resend-invite')
  .post(auth, blockRole4, orgUserController.resendInvite);

module.exports = router;
