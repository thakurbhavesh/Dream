const { Router } = require('express');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');
const controller = require('../controllers/organizationControlController');

const router = Router();
const blockRole4 = requireNotRoleId(4);

// GET  /organization-controls          → list all controls for org
// GET  /organization-controls/:feature_key → get one control
// PUT  /organization-controls/:feature_key → upsert (create or update)

router.get('/', auth, controller.getControls);
router.get('/:feature_key', auth, controller.getControl);
router.put('/:feature_key', auth, blockRole4, controller.upsertControl);

module.exports = router;
