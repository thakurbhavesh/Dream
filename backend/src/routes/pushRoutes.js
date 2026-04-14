const { Router } = require('express');
const auth = require('../middlewares/auth');
const webPush = require('../utils/webPush');

const router = Router();

// Public — client fetches VAPID public key to build subscription
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: webPush.getPublicKey(), configured: webPush.isConfigured() });
});

router.post('/subscribe', auth, async (req, res) => {
  try {
    const userId = req.user?.sub || req.user?.user_id;
    const { subscription } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!subscription) return res.status(400).json({ error: 'subscription required' });
    await webPush.saveSubscription(userId, subscription, req.headers['user-agent']);
    res.json({ ok: true });
  } catch (err) {
    console.error('[push/subscribe]', err.message);
    res.status(400).json({ error: err.message });
  }
});

router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
    await webPush.deleteSubscription(endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
