const { Router } = require('express');
const auth = require('../middlewares/auth');
const controller = require('../controllers/organizationProfileController');

const router = Router();

router.get('/overview',              auth, controller.getOverview);
router.get('/members',               auth, controller.getMembers);
router.get('/members/:userId',       auth, controller.getMember);
router.get('/departments',           auth, controller.getDepartments);
router.get('/designations',          auth, controller.getDesignations);
router.get('/locations',             auth, controller.getLocations);

module.exports = router;
