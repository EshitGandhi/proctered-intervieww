const express = require('express');
const { getReports, downloadReport, createManualReport, downloadReportDirect } = require('../controllers/report.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// GET /api/reports
router.get('/', protect, getReports);

// POST /api/reports/manual
router.post('/manual', protect, requireRole('admin', 'interviewer'), createManualReport);

// POST /api/reports/download-direct
router.post('/download-direct', protect, requireRole('admin', 'interviewer'), downloadReportDirect);

// GET /api/reports/:id/download
router.get('/:id/download', protect, downloadReport);

module.exports = router;
