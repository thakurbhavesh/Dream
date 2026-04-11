const { Router } = require('express');
const auth = require('../middlewares/auth');
const { translate, summarize, smartReply, grammarCorrect, toneAdjust, semanticSearch, generateCallNotes, smartCompose, transcribeAudio, appHelp } = require('../controllers/translateController');

const router = Router();

router.post('/', auth, translate);
router.post('/summarize', auth, summarize);
router.post('/smart-reply', auth, smartReply);
router.post('/grammar', auth, grammarCorrect);
router.post('/tone-adjust', auth, toneAdjust);
router.post('/semantic-search', auth, semanticSearch);
router.post('/call-notes', auth, generateCallNotes);
router.post('/smart-compose', auth, smartCompose);
router.post('/transcribe-audio', auth, transcribeAudio);
router.post('/help', auth, appHelp);

module.exports = router;
