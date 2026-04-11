const { Router } = require('express');
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const requireOwner = require('../middlewares/requireOwner');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router.post('/register', authController.register);
router.post('/create-account', authController.createNewAccount);
router.post('/resend-otp', authController.resendOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/forgot-verify', authController.verifyForgotPasswordOtp);
router.post('/change-password', auth, authController.changePassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login', authController.login);
router.get('/csrf', authController.getCsrfToken);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.post('/logout-all', auth, authController.logoutAll);
router.get('/trusted-devices', auth, authController.listTrustedDevices);
router.post('/trusted-devices/:deviceId/revoke', auth, authController.revokeTrustedDevice);
router.get('/me', auth, authController.me);
router.patch('/me/timezone', auth, authController.updateTimezone);
router.get('/user-details', auth, blockRole4, authController.getUserDetails);
router.post('/user-details', auth, blockRole4, authController.getUserDetails);
router.get('/organization-details', auth, blockRole4, authController.getOrganizationDetails);
router.get('/owner-dashboard', auth, requireOwner, authController.getOwnerDashboard);
router.get('/owner-organizations/:organizationId/members', auth, requireOwner, authController.getOwnerOrganizationMembers);
router.get('/owner-organizations/:organizationId/subscription', auth, requireOwner, authController.getOwnerOrganizationSubscription);
router.get('/owner-organizations/:organizationId/payment-history', auth, requireOwner, authController.getOwnerOrganizationPaymentHistory);
router.get('/owner/v1/organizations', auth, requireOwner, authController.getOwnerV1Organizations);
router.get('/owner/v1/organizations/:organizationId/overview', auth, requireOwner, authController.getOwnerV1OrganizationOverview);
router.patch('/owner/v1/organizations/:organizationId/members/:userId', auth, requireOwner, authController.updateOwnerV1OrganizationMember);
router.post('/owner/v1/organizations/:organizationId/payments/:paymentId/complete', auth, requireOwner, authController.completeOwnerV1OrganizationPayment);
router.get('/owner/v1/users', auth, requireOwner, authController.getOwnerV1Users);
router.get('/owner/v1/users/:userId/insights', auth, requireOwner, authController.getOwnerV1UserInsights);
router.post('/owner/v1/owners', auth, requireOwner, authController.createOwnerV1);

// ─── Owner: System & Socket Monitoring ─────────────────────────────────────
router.get('/owner/v1/system/socket-stats', auth, requireOwner, authController.getOwnerV1SystemStats);

// ─── QR Code Login ─────────────────────────────────────────────────────────
router.get('/qr', authController.qrGenerate);            // Web: get QR data (no auth needed)
router.post('/qr/confirm', auth, authController.qrConfirm); // Mobile: confirm QR (needs auth)
router.get('/qr/status', authController.qrStatus);       // Web: poll status (no auth needed)

module.exports = router;
