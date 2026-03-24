const express = require('express');
const { uploadMCQs, uploadMiddleware, getTestMCQs } = require('../controllers/mcq.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// Admin: Upload Excel file
router.post('/upload/:jobId', protect, requireRole('admin', 'interviewer'), uploadMiddleware, uploadMCQs);

// Candidate: Fetch randomized test questions
router.get('/test/:jobId', protect, getTestMCQs);

module.exports = router;
