const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const controller = require('../controllers/productFeatureController');
const {
  validateCreateCategory,
  validatePutCategory,
  validatePatchCategory,
  validateCreateItem,
  validatePutItem,
  validatePatchItem,
  ensureCategoryExists,
  ensureUniqueCategoryKey,
  ensureUniqueItemTitlePerCategory,
} = require('../middlewares/productFeatureValidation');

const router = Router();

router.get('/catalog', controller.getCatalog);

router
  .route('/categories')
  .get(controller.getCategories)
  .post(auth, requireOwner, validateCreateCategory, ensureUniqueCategoryKey, controller.createCategory);

router
  .route('/categories/:categoryId')
  .get(controller.getCategoryById)
  .put(auth, requireOwner, validatePutCategory, ensureUniqueCategoryKey, controller.putCategory)
  .patch(auth, requireOwner, validatePatchCategory, ensureUniqueCategoryKey, controller.patchCategory);

router
  .route('/')
  .get(controller.getItems)
  .post(
    auth,
    requireOwner,
    validateCreateItem,
    ensureCategoryExists,
    ensureUniqueItemTitlePerCategory,
    controller.createItem
  );

router
  .route('/:id')
  .get(controller.getItemById)
  .put(
    auth,
    requireOwner,
    validatePutItem,
    ensureCategoryExists,
    ensureUniqueItemTitlePerCategory,
    controller.putItem
  )
  .patch(
    auth,
    requireOwner,
    validatePatchItem,
    ensureCategoryExists,
    ensureUniqueItemTitlePerCategory,
    controller.patchItem
  );

module.exports = router;
