const { Router } = require('express');
const auth = require('../middlewares/auth');
const { translate, summarize, smartReply, grammarCorrect } = require('../controllers/translateController');

const router = Router();

router.post('/', auth, translate);
router.post('/summarize', auth, summarize);
router.post('/smart-reply', auth, smartReply);
router.post('/grammar', auth, grammarCorrect);

module.exports = router;
