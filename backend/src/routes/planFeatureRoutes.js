const { Router } = require('express');
const planFeatureController = require('../controllers/planFeatureController');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const {
  validateCreatePlanFeature,
  validateUpdatePlanFeature,
  ensureUniquePlanFeature,
} = require('../middlewares/planFeatureValidation');

const router = Router();

router
  .route('/plan/:planId/summary')
  .get(planFeatureController.getPlanFeatureSummary);

router
  .route('/')
  .get(planFeatureController.getPlanFeatures)
  .post(
    auth,
    requireOwner,
    validateCreatePlanFeature,
    ensureUniquePlanFeature,
    planFeatureController.createPlanFeature
  );

router
  .route('/:id')
  .get(planFeatureController.getPlanFeature)
  .put(
    auth,
    requireOwner,
    validateUpdatePlanFeature,
    ensureUniquePlanFeature,
    planFeatureController.updatePlanFeature
  )
  .patch(
    auth,
    requireOwner,
    validateUpdatePlanFeature,
    ensureUniquePlanFeature,
    planFeatureController.patchPlanFeature
  );

module.exports = router;
