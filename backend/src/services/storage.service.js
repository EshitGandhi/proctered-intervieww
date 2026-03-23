const path = require('path');
const fs = require('fs');
const multer = require('multer');

/**
 * Local storage service for recordings.
 * Provides a simple interface; can be swapped for AWS S3.
 */

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

// Ensure upload directories exist
const ensureDirs = () => {
  const dirs = [
    path.join(UPLOAD_DIR, 'recordings'),
    path.join(UPLOAD_DIR, 'audio'),
  ];
  dirs.forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
};

ensureDirs();

/**
 * Multer storage config for recordings.
 */
const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = file.mimetype.startsWith('audio') ? 'audio' : 'recordings';
    cb(null, path.join(UPLOAD_DIR, subDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, filename);
  },
});

const uploadRecording = multer({
  storage: recordingStorage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 524288000 }, // 500MB default
  fileFilter: (req, file, cb) => {
    const allowed = ['video/webm', 'audio/webm', 'video/mp4', 'audio/mp4', 'audio/wav'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

/**
 * Get the local file URL for a recording.
 */
const getLocalFileUrl = (filename, type = 'recordings') => {
  return `/uploads/${type}/${filename}`;
};

/**
 * Delete a file from local storage.
 */
const deleteLocalFile = (filePath) => {
  const fullPath = path.resolve(process.cwd(), filePath.replace(/^\//, ''));
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};

module.exports = { uploadRecording, getLocalFileUrl, deleteLocalFile, UPLOAD_DIR };
