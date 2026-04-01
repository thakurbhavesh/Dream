const { Router } = require('express');
const controller = require('../controllers/meetingController');
const auth = require('../middlewares/auth');

const router = Router();

router.post('/', auth, controller.createMeeting);
router.get('/', auth, controller.getMeetings);
router.get('/upcoming', auth, controller.getUpcoming);
router.get('/join/:meetingId', auth, controller.joinByCode);
router.get('/:id', auth, controller.getMeeting);
router.patch('/:id', auth, controller.updateMeeting);
router.patch('/:id/status', auth, controller.changeMeetingStatus);
router.delete('/:id', auth, controller.deleteMeeting);
router.post('/:id/rsvp', auth, controller.rsvp);
router.post('/:id/participants', auth, controller.addParticipant);
router.get('/:id/messages', auth, controller.getMessages);

module.exports = router;
