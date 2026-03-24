const { Router } = require('express');
const activityLogController = require('../controllers/activityLogController');
const auth = require('../middlewares/auth');
const requireNotRoleId = require('../middlewares/requireNotRoleId');

const router = Router();
const blockRole4 = requireNotRoleId(4);

router
  .route('/')
  .get(auth, blockRole4, activityLogController.getActivityLogs);

module.exports = router;
