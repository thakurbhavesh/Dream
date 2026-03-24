const { Router } = require('express');
const planController = require('../controllers/planController');
const {
  validatePlanPayload,
  validatePlanUpdate,
  ensureUniquePlanKey,
} = require('../middlewares/planValidation');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');

const router = Router();

router
  .route('/')
  .get(planController.getPlans)
  .post(auth, requireOwner, validatePlanPayload, ensureUniquePlanKey, planController.createPlan);

router
  .route('/:id')
  .get(planController.getPlan)
  .put(auth, requireOwner, validatePlanUpdate, ensureUniquePlanKey, planController.updatePlan)
  .patch(auth, requireOwner, validatePlanUpdate, ensureUniquePlanKey, planController.patchPlan)
  .delete(auth, requireOwner, planController.deletePlan);

module.exports = router;
