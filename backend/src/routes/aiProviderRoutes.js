const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');
const controller = require('../controllers/aiProviderController');

const router = Router();

// GET — any authenticated user can read
router.get('/',        auth, controller.listProviders);
router.get('/active',  auth, controller.getActive);

// PATCH — only owner (role_id = 1) can modify
router.patch('/:id',   auth, requireOwner, controller.updateProvider);

module.exports = router;
