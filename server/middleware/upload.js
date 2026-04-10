const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 24,
  },
});

module.exports = {
  upload,
};
