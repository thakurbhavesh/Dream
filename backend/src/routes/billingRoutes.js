const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const billingController = require('../controllers/billingController');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router.get('/payment-history', auth, blockRole4, billingController.getPaymentHistory);
router.get('/payment-gateways', auth, blockRole4, billingController.getPaymentGateways);
router.get('/plan-comparison', auth, blockRole4, billingController.getPlanComparison);
router.get('/address', auth, blockRole4, billingController.getBillingAddress);
router.get('/addresses', auth, blockRole4, billingController.getBillingAddresses);
router.put('/address', auth, blockRole4, billingController.upsertBillingAddress);
router.post('/quote', auth, blockRole4, billingController.createQuote);
router.post('/checkout-session', auth, blockRole4, billingController.createCheckoutSession);
router.post('/checkout/confirm', auth, blockRole4, billingController.confirmCheckoutSession);
router.get('/checkout/resume', auth, blockRole4, billingController.resumeCheckoutSession);

module.exports = router;
