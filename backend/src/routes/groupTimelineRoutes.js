const { Router } = require('express');
const auth = require('../middlewares/auth');
const groupTimelineController = require('../controllers/groupTimelineController');

const router = Router();

router
  .route('/')
  .get(auth, groupTimelineController.getGroupTimeline);

module.exports = router;

