const { Router } = require('express');
const languageController = require('../controllers/languageController');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const {
  validateLanguagePayload,
  validateLanguageUpdate,
  ensureUniqueLanguageCode,
} = require('../middlewares/languageValidation');

const router = Router();

router
  .route('/')
  .get(auth, languageController.getLanguages)
  .post(auth, requireOwner, validateLanguagePayload, ensureUniqueLanguageCode, languageController.createLanguage);

router
  .route('/:id')
  .get(auth, languageController.getLanguage)
  .put(auth, requireOwner, validateLanguageUpdate, ensureUniqueLanguageCode, languageController.updateLanguage)
  .patch(auth, requireOwner, validateLanguageUpdate, ensureUniqueLanguageCode, languageController.patchLanguage)
  .delete(auth, requireOwner, languageController.deleteLanguage);

module.exports = router;
