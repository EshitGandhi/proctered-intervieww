const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth.middleware');
const { saveLog, getSessionLogs, getApplicationLogs } = require('../controllers/proctoring.controller');

// Candidate or system posts a log (violations + screenshots)
router.post('/log', protect, saveLog);

// Admin views logs for a specific session (e.g., "mcq-<appId>")
router.get('/session/:sessionId', protect, requireRole('admin'), getSessionLogs);

// Admin views all proctoring logs for an application
router.get('/application/:appId', protect, requireRole('admin'), getApplicationLogs);

module.exports = router;
