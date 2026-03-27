const express = require('express');
const multer = require('multer');
const { getReports, downloadReport, createManualReport, downloadReportDirect } = require('../controllers/report.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();
const upload = multer({ dest: 'uploads/temp/' }); // Temp storage for extraction

// GET /api/reports
router.get('/', protect, getReports);

// POST /api/reports/manual (Upload TXT/DOCX)
router.post('/manual', protect, requireRole('admin', 'interviewer'), upload.single('file'), createManualReport);

// POST /api/reports/download-direct (Instant generation)
router.post('/download-direct', protect, requireRole('admin', 'interviewer'), upload.single('file'), downloadReportDirect);

// GET /api/reports/:id/download
router.get('/:id/download', protect, downloadReport);

module.exports = router;
