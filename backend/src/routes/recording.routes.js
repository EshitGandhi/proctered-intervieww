const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const Recording = require('../models/Recording');
const { uploadRecording, STORAGE_TYPE, s3 } = require('../services/storage.service');
const { transcribeFile } = require('../services/transcription.service');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * Helper to convert stream to string for S3 GetObject
 */
const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });

// POST /api/recordings/upload
router.post('/upload', protect, (req, res, next) => {
  console.log('[Upload] Starting upload request for user:', req.user?._id);
  next();
}, uploadRecording.single('recording'), async (req, res) => {
  console.log('[Upload] Multer parsed file:', req.file ? `Yes (${req.file.fieldname})` : 'No');
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const { interviewId, type, duration } = req.body;
  console.log('[Upload] Meta:', { interviewId, type, duration });

  if (!interviewId) {
    return res.status(400).json({ success: false, message: 'interviewId is required' });
  }

  let fileUrl;
  let s3Key = null;

  if (STORAGE_TYPE === 's3') {
    fileUrl = req.file.location;
    s3Key = req.file.key;
    console.log('[Upload] S3 URL:', fileUrl);
  } else {
    let subDir;
    if (type === 'transcript') subDir = 'transcripts';
    else if (req.file.mimetype.startsWith('audio')) subDir = 'audio';
    else subDir = 'recordings';
    fileUrl = `/uploads/${subDir}/${req.file.filename}`;
    console.log('[Upload] Local URL:', fileUrl);
  }

  try {
    const recording = await Recording.create({
      interview: interviewId,
      candidate: req.user?._id,
      type: type || 'video',
      storageType: STORAGE_TYPE,
      filePath: fileUrl,
      fileName: req.file.filename || req.file.key,
      s3Key: s3Key,
      s3Url: STORAGE_TYPE === 's3' ? fileUrl : null,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      duration: duration ? parseFloat(duration) : 0,
    });
    console.log('[Upload] DB Entry created:', recording._id);

    // Trigger transcription asynchronously
    if (type === 'video' || type === 'screen') {
      transcribeFile(fileUrl, recording._id).catch(err => {
        console.error('[Upload] Async transcription failed:', err.message);
      });
    }

    res.status(201).json({ success: true, data: recording, url: fileUrl });
  } catch (err) {
    console.error('[Upload] DB Save error:', err.message);
    res.status(500).json({ success: false, message: 'Database save failed' });
  }
});

// GET /api/recordings/interview/:interviewId
router.get('/interview/:interviewId', protect, async (req, res) => {
  const recordings = await Recording.find({ interview: req.params.interviewId })
    .populate('candidate', 'name email')
    .sort({ uploadedAt: -1 });
  res.json({ success: true, data: recordings });
});

// GET /api/recordings/:id/transcript — return raw text content
router.get('/:id/transcript', protect, async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording || recording.type !== 'transcript') {
      return res.status(404).json({ success: false, message: 'Transcript not found' });
    }

    let content;
    if (STORAGE_TYPE === 's3' && recording.s3Key && s3) {
      // Fetch from S3 directly using SDK
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: recording.s3Key,
      });
      const { Body } = await s3.send(command);
      content = await streamToString(Body);
    } else if (recording.filePath && recording.filePath.startsWith('http')) {
      // Fallback: Fetch via HTTP
      const response = await axios.get(recording.filePath);
      content = response.data;
    } else {
      // Local disk
      const fullPath = path.resolve(process.cwd(), recording.filePath.replace(/^\//, ''));
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, message: 'Transcript file not found on disk' });
      }
      content = fs.readFileSync(fullPath, 'utf-8');
    }

    let contentType = recording.filePath.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';
    res.setHeader('Content-Type', contentType);
    res.send(content);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/recordings/:id/transcribe — trigger Groq transcription on demand
// IMPORTANT: must be defined BEFORE the /:id DELETE route to avoid shadowing
router.post('/:id/transcribe', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found' });
    }
    if (recording.type === 'transcript') {
      return res.status(400).json({ success: false, message: 'This recording is already a transcript' });
    }

    // Check if Groq is available
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(503).json({ success: false, message: 'GROQ_API_KEY is not configured on the server' });
    }

    // Check if a transcript for this recording already exists
    const existingTranscript = await Recording.findOne({
      interview: recording.interview,
      type: 'transcript',
    });
    if (existingTranscript) {
      return res.json({ success: true, message: 'A transcript already exists for this interview', alreadyExists: true });
    }

    // Trigger transcription asynchronously and return immediately
    res.json({ success: true, message: 'Transcription started — this may take 30–60 seconds. Refresh the Transcript tab when done.' });

    transcribeFile(recording.filePath, recording._id).catch(err => {
      console.error('[On-Demand Transcription] Failed:', err.message);
    });
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
