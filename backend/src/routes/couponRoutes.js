const { Router } = require('express');
const couponController = require('../controllers/couponController');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const {
  validateCouponPayload,
  validateCouponUpdate,
  ensureUniqueCouponCode,
} = require('../middlewares/couponValidation');

const router = Router();

// GET endpoints are open (no auth) as requested.
router
  .route('/')
  .get(couponController.getCoupons)
  .post(auth, requireOwner, validateCouponPayload, ensureUniqueCouponCode, couponController.createCoupon);

router
  .route('/:id')
  .get(couponController.getCoupon)
  .put(auth, requireOwner, validateCouponUpdate, ensureUniqueCouponCode, couponController.updateCoupon)
  .patch(auth, requireOwner, validateCouponUpdate, ensureUniqueCouponCode, couponController.patchCoupon);

module.exports = router;
