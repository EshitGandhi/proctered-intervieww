const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

/**
 * Storage service for recordings.
 * Supports Local and AWS S3 based on process.env.STORAGE_TYPE.
 */

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

// Ensure local directories exist regardless (for fallback or local usage)
const ensureDirs = () => {
  const dirs = [
    path.join(UPLOAD_DIR, 'recordings'),
    path.join(UPLOAD_DIR, 'audio'),
    path.join(UPLOAD_DIR, 'screen'),
    path.join(UPLOAD_DIR, 'transcripts'),
  ];
  dirs.forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
};

if (STORAGE_TYPE === 'local') {
  ensureDirs();
}

// ─── S3 Config ──────────────────────────────────────────────────────────────
let s3;
if (STORAGE_TYPE === 's3') {
  s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

// ─── Storage Engines ────────────────────────────────────────────────────────

// Local Storage Engine
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let subDir;
    if (file.mimetype === 'text/plain') {
      subDir = 'transcripts';
    } else if (file.mimetype.startsWith('audio')) {
      subDir = 'audio';
    } else {
      subDir = 'recordings';
    }
    cb(null, path.join(UPLOAD_DIR, subDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, filename);
  },
});

// S3 Storage Engine
const s3Storage = (STORAGE_TYPE === 's3' && s3) ? multerS3({
  s3: s3,
  bucket: process.env.AWS_S3_BUCKET,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const subDir = file.mimetype === 'text/plain' ? 'transcripts' : 
                   file.mimetype.startsWith('audio') ? 'audio' : 'recordings';
    const ext = path.extname(file.originalname) || '.webm';
    const key = `${subDir}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, key);
  },
}) : null;

// Select upload config
const uploadRecording = multer({
  storage: STORAGE_TYPE === 's3' ? s3Storage : localStorage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 524288000 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'video/webm',
      'audio/webm',
      'video/mp4',
      'audio/mp4',
      'audio/wav',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

/**
 * Get the file URL.
 */
const getFileUrl = (file, type = 'recordings') => {
  if (STORAGE_TYPE === 's3') {
    return file.location; // Provided by multer-s3
  }
  return `/uploads/${type}/${file.filename}`;
};

/**
 * Delete a file.
 */
const deleteFile = async (recording) => {
  if (STORAGE_TYPE === 's3' && recording.s3Key) {
    // Note: Implementation for S3 delete can be added here if needed
    // const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    // await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: recording.s3Key }));
    return;
  }
  
  if (recording.filePath) {
    const fullPath = path.resolve(process.cwd(), recording.filePath.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
};

module.exports = { 
  uploadRecording, 
  getFileUrl, 
  deleteFile, 
  UPLOAD_DIR,
  STORAGE_TYPE 
};
