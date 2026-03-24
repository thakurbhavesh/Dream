const { Router } = require('express');
const ctrl = require('../controllers/liveAssistantController');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');

const router = Router();

// Chat
router.post('/chat', auth, ctrl.chat);

// Feedback
router.post('/feedback', auth, ctrl.submitFeedback);

// Conversations (user's own)
router.get('/conversations', auth, ctrl.listConversations);
router.post('/conversations', auth, ctrl.saveConversation);
router.get('/conversations/:id', auth, ctrl.getConversation);
router.patch('/conversations/:id', auth, ctrl.updateConversation);
router.delete('/conversations/:id', auth, ctrl.deleteConversation);

// Usage analytics (owner only)
router.get('/usage', auth, requireOwner, ctrl.getUsageStats);

// Broadcasts (owner only)
router.get('/broadcasts', auth, requireOwner, ctrl.getBroadcasts);
router.post('/broadcasts', auth, requireOwner, ctrl.createBroadcast);
router.patch('/broadcasts/:id', auth, requireOwner, ctrl.updateBroadcast);
router.delete('/broadcasts/:id', auth, requireOwner, ctrl.deleteBroadcast);

// Knowledge base (owner only)
router.get('/knowledge', auth, requireOwner, ctrl.getKnowledge);
router.post('/knowledge', auth, requireOwner, ctrl.createKnowledge);
router.patch('/knowledge/:id', auth, requireOwner, ctrl.updateKnowledge);
router.delete('/knowledge/:id', auth, requireOwner, ctrl.deleteKnowledge);

// Search & export
router.get('/conversations/search', auth, ctrl.searchConversations);
router.get('/conversations/:id/export', auth, ctrl.exportConversation);

module.exports = router;
