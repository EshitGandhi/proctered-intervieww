const express = require('express');
const ProctoringLog = require('../models/ProctoringLog');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/proctoring/log
router.post('/log', protect, async (req, res) => {
  const { interviewId, sessionId, eventType, description, metadata, severity } = req.body;

  if (!interviewId || !eventType) {
    return res.status(400).json({ success: false, message: 'interviewId and eventType are required' });
  }

  const log = await ProctoringLog.create({
    interview: interviewId,
    sessionId: sessionId || interviewId,
    candidate: req.user?.role === 'candidate' ? req.user._id : null,
    eventType,
    description: description || '',
    metadata: metadata || {},
    severity: severity || 'medium',
    timestamp: new Date(),
  });

  res.status(201).json({ success: true, data: log });
});

// GET /api/proctoring/session/:sessionId
router.get('/session/:sessionId', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  const logs = await ProctoringLog.find({ sessionId: req.params.sessionId })
    .populate('candidate', 'name email')
    .sort({ timestamp: 1 });

  const summary = logs.reduce((acc, log) => {
    acc[log.eventType] = (acc[log.eventType] || 0) + 1;
    return acc;
  }, {});

  res.json({ success: true, data: logs, summary, total: logs.length });
});

// GET /api/proctoring/interview/:interviewId
router.get('/interview/:interviewId', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  const logs = await ProctoringLog.find({ interview: req.params.interviewId })
    .populate('candidate', 'name email')
    .sort({ timestamp: 1 });
  res.json({ success: true, data: logs, total: logs.length });
});

module.exports = router;
