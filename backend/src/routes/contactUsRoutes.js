const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const controller = require('../controllers/contactUsController');
const { validateCreateContactRequest } = require('../middlewares/contactUsValidation');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/')
  .post(validateCreateContactRequest, controller.createContactRequest)
  .get(auth, blockRole4, controller.getContactRequests);

router
  .route('/:id')
  .get(auth, blockRole4, controller.getContactRequestById);

module.exports = router;
