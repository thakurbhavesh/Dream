const { Router } = require('express');
const locationController = require('../controllers/locationController');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const { validateLocationPayload, validateLocationUpdate } = require('../middlewares/locationValidation');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/')
  .get(auth, blockRole4, locationController.getLocations)
  .post(auth, blockRole4, validateLocationPayload, locationController.createLocation);

router
  .route('/:id')
  .get(auth, blockRole4, locationController.getLocation)
  .put(auth, blockRole4, validateLocationUpdate, locationController.updateLocation)
  .patch(auth, blockRole4, validateLocationUpdate, locationController.patchLocation)
  .delete(auth, blockRole4, locationController.deleteLocation);

module.exports = router;
