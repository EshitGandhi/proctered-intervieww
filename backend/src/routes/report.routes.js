const express = require('express');
const multer = require('multer');
const path = require('path');
const { protect, requireRole } = require('../middleware/auth.middleware');
const { generateReport, getReportByApplication, downloadReport } = require('../controllers/report.controller');

const router = express.Router();

// Multer Setup for Transcripts
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp');
  },
  filename: (req, file, cb) => {
    cb(null, `transcript_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.docx' || ext === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf, .docx, and .txt files are allowed'));
    }
  },
});

// Admin routes
router.post('/generate/:appId', protect, requireRole('admin'), upload.single('transcript'), generateReport);
router.get('/application/:appId', protect, requireRole('admin'), getReportByApplication);
router.get('/download/:id', protect, downloadReport);

module.exports = router;
