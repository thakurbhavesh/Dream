const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const paymentGatewayController = require('../controllers/paymentGatewayController');

const router = Router();

router
  .route('/')
  .get(auth, paymentGatewayController.getPaymentGateways)
  .post(auth, requireOwner, paymentGatewayController.createPaymentGateway);

router
  .route('/:id')
  .get(auth, paymentGatewayController.getPaymentGateway)
  .put(auth, requireOwner, paymentGatewayController.updatePaymentGateway)
  .patch(auth, requireOwner, paymentGatewayController.updatePaymentGateway)
  .delete(auth, requireOwner, paymentGatewayController.deletePaymentGateway);

module.exports = router;
