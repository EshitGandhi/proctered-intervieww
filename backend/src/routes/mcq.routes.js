const express = require('express');
const { uploadMCQs, uploadMiddleware, getTestMCQs } = require('../controllers/mcq.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const MCQ = require('../models/MCQ');

const router = express.Router();

// Admin: Upload Excel file
router.post('/upload/:jobId', protect, requireRole('admin', 'interviewer'), uploadMiddleware, uploadMCQs);

// Admin: Get all MCQs for a job (with correct answers visible)
router.get('/admin/:jobId', protect, requireRole('admin', 'interviewer'), async (req, res) => {
  try {
    const questions = await MCQ.find({ jobId: req.params.jobId }).sort('createdAt');
    res.status(200).json({ success: true, count: questions.length, data: questions });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Admin: Delete all MCQs for a job
router.delete('/:jobId', protect, requireRole('admin', 'interviewer'), async (req, res) => {
  try {
    const result = await MCQ.deleteMany({ jobId: req.params.jobId });
    res.status(200).json({ success: true, message: `Deleted ${result.deletedCount} questions` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Candidate: Fetch randomized test questions
router.get('/test/:jobId', protect, getTestMCQs);

module.exports = router;
