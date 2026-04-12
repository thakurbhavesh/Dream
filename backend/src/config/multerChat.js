const multer = require('multer');
const os = require('os');
const path = require('path');

// Dangerous file extensions that can execute code or harm systems
const BLOCKED_EXTENSIONS = new Set([
  // Executables
  '.exe', '.msi', '.com', '.scr', '.pif',
  // Scripts
  '.bat', '.cmd', '.sh', '.bash', '.ps1', '.psm1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
  // Libraries / system
  '.dll', '.sys', '.drv', '.ocx', '.cpl',
  // Installers / packages
  '.deb', '.rpm', '.dmg', '.app', '.appimage',
  // Shortcuts / links
  '.lnk', '.url', '.scf',
  // Registry / config exploits
  '.reg', '.inf',
  // Java / .NET
  '.jar', '.class',
  // Office macros
  '.docm', '.xlsm', '.pptm', '.dotm', '.xltm',
  // Other dangerous
  '.hta', '.crt', '.ins', '.isp', '.msp', '.mst', '.sct', '.ws',
]);

const chatUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      cb(null, `chat-upload-${unique}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max for chat files
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      const err = new Error(`File type "${ext}" is not allowed for security reasons`);
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

module.exports = chatUpload;
