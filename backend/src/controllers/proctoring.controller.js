const ProctoringLog = require('../models/ProctoringLog');

// POST /api/proctoring/log
// Called by the frontend hooks (useTabProctor, useFaceProctor, FaceCheckModal)
exports.saveLog = async (req, res) => {
  try {
    const { sessionId, eventType, description, severity, screenshot, metadata } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({ success: false, error: 'sessionId and eventType are required' });
    }

    const log = await ProctoringLog.create({
      sessionId,
      eventType,
      description,
      severity,
      screenshot,
      metadata,
    });

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/proctoring/session/:sessionId
// Get all logs for a specific session
exports.getSessionLogs = async (req, res) => {
  try {
    const logs = await ProctoringLog.find({ sessionId: req.params.sessionId }).sort('createdAt');
    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/proctoring/application/:appId
// Get all logs for an entire application (both mcq and coding rounds)
exports.getApplicationLogs = async (req, res) => {
  try {
    const appId = req.params.appId;
    const logs = await ProctoringLog.find({
      sessionId: { $in: [`mcq-${appId}`, `coding-${appId}`] }
    }).sort('createdAt');

    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
