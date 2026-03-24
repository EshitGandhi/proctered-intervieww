const express = require('express');
const { protect, requireRole } = require('../middleware/auth.middleware');
const {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getRoundQuestions,
} = require('../controllers/codingQuestion.controller');

const router = express.Router();

// Candidate Route (Fetch 3 random questions for the test)
router.get('/round', protect, requireRole('candidate'), getRoundQuestions);

// Admin / Interviewer Routes
router.route('/')
  .get(protect, requireRole('admin', 'interviewer'), getQuestions)
  .post(protect, requireRole('admin', 'interviewer'), createQuestion);

router.route('/:id')
  .put(protect, requireRole('admin', 'interviewer'), updateQuestion)
  .delete(protect, requireRole('admin', 'interviewer'), deleteQuestion);

module.exports = router;
