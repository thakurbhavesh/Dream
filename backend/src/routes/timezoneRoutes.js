const { Router } = require('express');
const timezoneController = require('../controllers/timezoneController');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const {
  validateTimezonePayload,
  validateTimezoneUpdate,
  ensureUniqueTimezoneCode,
} = require('../middlewares/timezoneValidation');

const router = Router();

router
  .route('/')
  .get(auth, timezoneController.getTimezones)
  .post(auth, requireOwner, validateTimezonePayload, ensureUniqueTimezoneCode, timezoneController.createTimezone);

router
  .route('/:id')
  .get(auth, timezoneController.getTimezone)
  .put(auth, requireOwner, validateTimezoneUpdate, ensureUniqueTimezoneCode, timezoneController.updateTimezone)
  .patch(auth, requireOwner, validateTimezoneUpdate, ensureUniqueTimezoneCode, timezoneController.patchTimezone)
  .delete(auth, requireOwner, timezoneController.deleteTimezone);

module.exports = router;
