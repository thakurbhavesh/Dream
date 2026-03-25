const { Router } = require('express');
const auth = require('../middlewares/auth');
const { translate, summarize, smartReply, grammarCorrect, toneAdjust, semanticSearch, generateCallNotes, smartCompose } = require('../controllers/translateController');

const router = Router();

router.post('/', auth, translate);
router.post('/summarize', auth, summarize);
router.post('/smart-reply', auth, smartReply);
router.post('/grammar', auth, grammarCorrect);
router.post('/tone-adjust', auth, toneAdjust);
router.post('/semantic-search', auth, semanticSearch);
router.post('/call-notes', auth, generateCallNotes);
router.post('/smart-compose', auth, smartCompose);

module.exports = router;
