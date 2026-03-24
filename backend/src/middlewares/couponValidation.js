const couponModel = require('../models/couponModel');
const { failure } = require('../utils/response');

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const normalizeCode = (value) => String(value || '').trim().toUpperCase();

const allowedStatus = ['active', 'inactive'];
const allowedDiscountType = ['percent', 'fixed'];

const validateCommon = (payload = {}, partial = false) => {
  const errors = [];
  const has = (key) => payload[key] !== undefined && payload[key] !== null;

  if (!partial || has('coupon_code')) {
    const code = normalizeCode(payload.coupon_code);
    if (!code) errors.push('coupon_code is required');
    if (code && code.length > 40) errors.push('coupon_code must be <= 40 chars');
  }

  if (!partial || has('discount_type')) {
    const type = String(payload.discount_type || '').trim().toLowerCase();
    if (!allowedDiscountType.includes(type)) {
      errors.push('discount_type must be percent or fixed');
    }
  }

  if (!partial || has('discount_value')) {
    const value = toNumber(payload.discount_value);
    if (Number.isNaN(value) || value <= 0) {
      errors.push('discount_value must be a positive number');
    }
  }

  if (has('status')) {
    const status = String(payload.status || '').trim().toLowerCase();
    if (!allowedStatus.includes(status)) {
      errors.push('status must be active or inactive');
    }
  }

  if (has('max_uses')) {
    const maxUses = toNumber(payload.max_uses);
    if (Number.isNaN(maxUses) || maxUses < 0) {
      errors.push('max_uses must be >= 0');
    }
  }

  if (has('max_discount_amount')) {
    const maxDiscount = toNumber(payload.max_discount_amount);
    if (Number.isNaN(maxDiscount) || maxDiscount < 0) {
      errors.push('max_discount_amount must be >= 0');
    }
  }

  if (has('min_order_amount')) {
    const minOrder = toNumber(payload.min_order_amount);
    if (Number.isNaN(minOrder) || minOrder < 0) {
      errors.push('min_order_amount must be >= 0');
    }
  }

  if (has('valid_from') && Number.isNaN(new Date(payload.valid_from).getTime())) {
    errors.push('valid_from must be a valid datetime');
  }
  if (has('valid_to') && Number.isNaN(new Date(payload.valid_to).getTime())) {
    errors.push('valid_to must be a valid datetime');
  }
  if (has('valid_from') && has('valid_to')) {
    const from = new Date(payload.valid_from);
    const to = new Date(payload.valid_to);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to < from) {
      errors.push('valid_to must be greater than or equal to valid_from');
    }
  }

  return errors;
};

const validateCouponPayload = (req, res, next) => {
  const errors = validateCommon(req.body, false);
  if (errors.length) return failure(res, errors.join(', '), 400);
  return next();
};

const validateCouponUpdate = (req, res, next) => {
  const errors = validateCommon(req.body, true);
  if (errors.length) return failure(res, errors.join(', '), 400);
  return next();
};

const ensureUniqueCouponCode = async (req, res, next) => {
  try {
    const code = normalizeCode(req.body?.coupon_code);
    if (!code) return next();
    const found = await couponModel.findByCode(code);
    if (!found) return next();
    const currentId = req.params.id ? Number(req.params.id) : null;
    if (currentId && Number(found.coupon_id) === currentId) return next();
    return failure(res, 'coupon_code already exists', 409);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  validateCouponPayload,
  validateCouponUpdate,
  ensureUniqueCouponCode,
};
