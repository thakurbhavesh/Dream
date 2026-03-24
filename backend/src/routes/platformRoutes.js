const { Router } = require('express');
const platformController = require('../controllers/platformController');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const {
  validatePlatformPayload,
  validatePlatformUpdate,
  ensureUniquePlatformKey,
} = require('../middlewares/platformValidation');

const router = Router();

router
  .route('/')
  .get(auth, platformController.getPlatforms)
  .post(auth, requireOwner, validatePlatformPayload, ensureUniquePlatformKey, platformController.createPlatform);

router
  .route('/:id')
  .get(auth, platformController.getPlatform)
  .put(auth, requireOwner, validatePlatformUpdate, ensureUniquePlatformKey, platformController.updatePlatform)
  .patch(auth, requireOwner, validatePlatformUpdate, ensureUniquePlatformKey, platformController.patchPlatform)
  .delete(auth, requireOwner, platformController.deletePlatform);

module.exports = router;
