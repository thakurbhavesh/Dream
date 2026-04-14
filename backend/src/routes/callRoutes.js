const { Router } = require('express');
const auth = require('../middlewares/auth');
const callLogModel = require('../models/callLogModel');
const { success, failure } = require('../utils/response');

const router = Router();

// GET /calls — history for current user (both incoming and outgoing)
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = Number(req.user?.sub);
    if (!userId) return failure(res, 'Unauthorized', 401);
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const peerId = Number(req.query.peer_id) || null;
    const calls = await callLogModel.getForUser(userId, { limit, offset, peerId });
    return success(res, { calls }, 'Call history');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
