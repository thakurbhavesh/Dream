const { Router } = require('express');
const auth = require('../middlewares/auth');
const upload = require('../config/multer');
const chatUpload = require('../config/multerChat');
const { uploadProfilePicture, removeProfilePicture, uploadChatFile, uploadGroupImage, removeGroupImage, fileProxy } = require('../controllers/uploadController');

const router = Router();

router.post('/profile-picture', auth, upload.single('avatar'), uploadProfilePicture);
router.delete('/profile-picture', auth, removeProfilePicture);
router.post('/chat-file', auth, chatUpload.single('file'), uploadChatFile);
router.post('/group-image/:groupId', auth, upload.single('avatar'), uploadGroupImage);
router.delete('/group-image/:groupId', auth, removeGroupImage);
router.get('/file-proxy', auth, fileProxy);

module.exports = router;
