const express = require('express');
const Recording = require('../models/Recording');
const { uploadRecording, getLocalFileUrl } = require('../services/storage.service');
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

  const subDir = req.file.mimetype.startsWith('audio') ? 'audio' : 'recordings';
  const fileUrl = getLocalFileUrl(req.file.filename, subDir);

  const recording = await Recording.create({
    interview: interviewId,
    candidate: req.user?._id,
    type: type || 'video',
    storageType: 'local',
    filePath: fileUrl,
    fileName: req.file.filename,
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

// DELETE /api/recordings/:id
router.delete('/:id', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  await Recording.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Recording deleted' });
});

module.exports = router;
