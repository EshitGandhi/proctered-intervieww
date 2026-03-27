const express = require('express');
const { getReports, downloadReport } = require('../controllers/report.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/reports
router.get('/', protect, getReports);

// GET /api/reports/:id/download
router.get('/:id/download', protect, downloadReport);

module.exports = router;
