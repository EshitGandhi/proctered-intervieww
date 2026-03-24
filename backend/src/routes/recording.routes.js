const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Recording = require('../models/Recording');
const { uploadRecording, STORAGE_TYPE } = require('../services/storage.service');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/recordings/upload
router.post('/upload', protect, uploadRecording.single('recording'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const { interviewId, type, duration } = req.body;
  if (!interviewId) {
    return res.status(400).json({ success: false, message: 'interviewId is required' });
  }

  // Determine URL and key
  let fileUrl;
  let s3Key = null;

  if (STORAGE_TYPE === 's3') {
    fileUrl = req.file.location; // Full S3 URL from multer-s3
    s3Key = req.file.key;
  } else {
    // Determine sub-directory based on type for local storage
    let subDir;
    if (type === 'transcript') subDir = 'transcripts';
    else if (req.file.mimetype.startsWith('audio')) subDir = 'audio';
    else subDir = 'recordings';
    fileUrl = `/uploads/${subDir}/${req.file.filename}`;
  }

  const recording = await Recording.create({
    interview: interviewId,
    candidate: req.user?._id,
    type: type || 'video',
    storageType: STORAGE_TYPE,
    filePath: fileUrl, // either /uploads/ or full S3 URL
    fileName: req.file.filename || req.file.key,
    s3Key: s3Key,
    s3Url: STORAGE_TYPE === 's3' ? fileUrl : null,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    duration: duration ? parseFloat(duration) : 0,
  });

  res.status(201).json({ success: true, data: recording, url: fileUrl });
});

// GET /api/recordings/interview/:interviewId
router.get('/interview/:interviewId', protect, async (req, res) => {
  const recordings = await Recording.find({ interview: req.params.interviewId })
    .populate('candidate', 'name email')
    .sort({ uploadedAt: -1 });
  res.json({ success: true, data: recordings });
});

// GET /api/recordings/:id/transcript — return raw text content of transcript file
router.get('/:id/transcript', protect, async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording || recording.type !== 'transcript') {
      return res.status(404).json({ success: false, message: 'Transcript not found' });
    }

    let content;
    if (STORAGE_TYPE === 's3' || (recording.filePath && recording.filePath.startsWith('http'))) {
      // Fetch from S3 URL
      const response = await axios.get(recording.filePath);
      content = response.data;
    } else {
      // Local file
      const fullPath = path.resolve(process.cwd(), recording.filePath.replace(/^\//, ''));
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, message: 'Transcript file not found on disk' });
      }
      content = fs.readFileSync(fullPath, 'utf-8');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/recordings/:id
router.delete('/:id', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  await Recording.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Recording deleted' });
});

module.exports = router;
