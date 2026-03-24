const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const controller = require('../controllers/siteDetailController');
const {
  validateCreateSiteDetail,
  validateUpdateSiteDetail,
  validatePatchSiteDetail,
} = require('../middlewares/siteDetailValidation');

const router = Router();

router
  .route('/')
  .get(controller.getSiteDetail)
  .post(auth, requireOwner, validateCreateSiteDetail, controller.createSiteDetail);

router
  .route('/:id')
  .get(controller.getSiteDetailById)
  .put(auth, requireOwner, validateUpdateSiteDetail, controller.updateSiteDetail)
  .patch(auth, requireOwner, validatePatchSiteDetail, controller.patchSiteDetail);

module.exports = router;
