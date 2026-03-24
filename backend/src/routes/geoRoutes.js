const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const geoController = require('../controllers/geoController');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router.get('/countries', geoController.getCountries);
router.post('/countries', auth, requireOwner, geoController.createCountry);
router.patch('/countries/:id', auth, requireOwner, geoController.patchCountry);
router.get('/states', auth, blockRole4, geoController.getStates);
router.post('/states', auth, requireOwner, geoController.createState);
router.patch('/states/:id', auth, requireOwner, geoController.patchState);
router.get('/currencies', auth, blockRole4, geoController.getCurrencies);
router.post('/currencies', auth, requireOwner, geoController.createCurrency);
router.patch('/currencies/:code', auth, requireOwner, geoController.patchCurrency);
router.get('/top-country-currencies', auth, blockRole4, geoController.getTopCountryCurrencies);

module.exports = router;
