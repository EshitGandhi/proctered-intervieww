const express = require('express');
const ProctoringLog = require('../models/ProctoringLog');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/proctoring/log
router.post('/log', protect, async (req, res) => {
  const { interviewId, sessionId, eventType, description, metadata, severity } = req.body;

  if (!eventType) {
    return res.status(400).json({ success: false, message: 'eventType is required' });
  }

  const log = await ProctoringLog.create({
    interview: interviewId || undefined,
    sessionId: sessionId || interviewId || req.user?._id?.toString() || 'unknown',
    candidate: req.user?._id || null, // Always attach the logged in user as candidate
    eventType,
    description: description || '',
    metadata: metadata || {},
    severity: severity || 'medium',
    timestamp: new Date(),
  });

  res.status(201).json({ success: true, data: log });
});

// GET /api/proctoring/session/:sessionId
router.get('/session/:sessionId', protect, requireRole('admin'), async (req, res) => {
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
router.get('/interview/:interviewId', protect, requireRole('admin'), async (req, res) => {
  const logs = await ProctoringLog.find({ interview: req.params.interviewId })
    .populate('candidate', 'name email')
    .sort({ timestamp: 1 });
  res.json({ success: true, data: logs, total: logs.length });
});

// GET /api/proctoring/candidate/:candidateId — all logs for a candidate (admin)
// Used to view face violations from MCQ / coding rounds
router.get('/candidate/:candidateId', protect, requireRole('admin'), async (req, res) => {
  try {
    const logs = await ProctoringLog.find({ candidate: req.params.candidateId })
      .sort({ timestamp: -1 })
      .limit(200);

    const faceEvents = ['no_face_detected', 'multiple_faces', 'face_look_away', 'camera_blocked'];
    const summary = logs.reduce((acc, log) => {
      acc[log.eventType] = (acc[log.eventType] || 0) + 1;
      return acc;
    }, {});

    const faceSummary = {
      total: faceEvents.reduce((n, t) => n + (summary[t] || 0), 0),
      no_face_detected: summary.no_face_detected || 0,
      multiple_faces: summary.multiple_faces || 0,
      face_look_away: summary.face_look_away || 0,
      camera_blocked: summary.camera_blocked || 0,
    };

    res.json({ success: true, data: logs, summary, faceSummary, total: logs.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/proctoring/all-candidates — paginated list for admin proctoring tab
router.get('/all-candidates', protect, requireRole('admin'), async (req, res) => {
  try {
    const faceTypes = ['no_face_detected', 'multiple_faces', 'face_look_away', 'camera_blocked'];
    // Aggregate: group by candidate, count face violations
    const agg = await ProctoringLog.aggregate([
      { $match: { eventType: { $in: faceTypes } } },
      {
        $group: {
          _id: '$candidate',
          sessionId: { $first: '$sessionId' },
          total: { $sum: 1 },
          no_face: { $sum: { $cond: [{ $eq: ['$eventType', 'no_face_detected'] }, 1, 0] } },
          multi_face: { $sum: { $cond: [{ $eq: ['$eventType', 'multiple_faces'] }, 1, 0] } },
          look_away: { $sum: { $cond: [{ $eq: ['$eventType', 'face_look_away'] }, 1, 0] } },
          blocked: { $sum: { $cond: [{ $eq: ['$eventType', 'camera_blocked'] }, 1, 0] } },
          lastSeen: { $max: '$timestamp' },
        },
      },
      { $sort: { total: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'candidateInfo',
        },
      },
      { $unwind: { path: '$candidateInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1, sessionId: 1, total: 1, no_face: 1, multi_face: 1,
          look_away: 1, blocked: 1, lastSeen: 1,
          name: '$candidateInfo.name',
          email: '$candidateInfo.email',
        },
      },
    ]);
    res.json({ success: true, data: agg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
