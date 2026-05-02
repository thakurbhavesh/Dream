const { Router } = require('express');
const auth = require('../middlewares/auth');
const controller = require('./chatController');

const router = Router();

// Organizations the user belongs to
router.get('/organizations',        auth, controller.getOrganizations);

// Thread list + contacts
router.get('/threads',              auth, controller.getThreads);
router.get('/contacts',             auth, controller.getContacts);

// Search messages across all threads or within a specific thread
router.get('/search',              auth, controller.searchMessages);
router.post('/smart-search',       auth, controller.smartSearch);

// Messages per thread
router.get('/threads/:id/messages', auth, controller.getMessages);
router.get('/threads/:id/media',    auth, controller.getThreadMedia);
router.post('/threads/:id/messages',auth, controller.sendMessage);
router.post('/threads/:id/read',    auth, controller.markRead);

// Message-level edit / delete (DMs only for now)
router.patch('/messages/:id',       auth, controller.editMessage);
router.delete('/messages/:id',      auth, controller.deleteMessage);

// Group creation with members (single API)
router.post('/groups/create',       auth, controller.createGroupWithMembers);

// Group management
router.post('/groups/:groupId/leave',    auth, controller.leaveGroup);
router.post('/groups/:groupId/hide',      auth, controller.hideGroupThread);
router.post('/groups/:groupId/unhide',    auth, controller.unhideGroupThread);
router.get('/groups/:groupId/timeline',  auth, controller.getGroupTimeline);
router.get('/groups/:groupId/info',      auth, controller.getGroupInfo);

// Export chat as text file
router.get('/threads/:id/export',   auth, controller.exportChat);

// Exchange info — message/file/image/video counts with date filter
router.get('/exchange-info',             auth, controller.getExchangeInfo);

// ─── Poll APIs ──────────────────────────────────────────────────────────────
const pollController = require('../controllers/pollController');
router.get('/polls/:messageId',          auth, pollController.getPoll);
router.get('/polls/group/:groupId',      auth, pollController.getGroupPolls);
router.post('/polls/:messageId/vote',    auth, pollController.votePoll);
router.post('/polls/:messageId/end',     auth, pollController.endPoll);
router.patch('/polls/:messageId',        auth, pollController.editPoll);
router.delete('/polls/:messageId',       auth, pollController.deletePoll);

module.exports = router;
