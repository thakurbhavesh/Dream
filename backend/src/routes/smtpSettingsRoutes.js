const { Router } = require('express');
const smtpSettingsController = require('../controllers/smtpSettingsController');
const auth = require('../middlewares/auth');
const requireOwner = require('../middlewares/requireOwner');

const router = Router();

router.get('/',          auth, requireOwner, smtpSettingsController.getAllSmtpSettings);
router.post('/',         auth, requireOwner, smtpSettingsController.createSmtpSettings);
router.patch('/:id',     auth, requireOwner, smtpSettingsController.updateSmtpSettings);
router.post('/:id/activate', auth, requireOwner, smtpSettingsController.activateSmtpSettings);
router.delete('/:id',    auth, requireOwner, smtpSettingsController.deleteSmtpSettings);

module.exports = router;
