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

// Admin Routes
router.route('/')
  .get(protect, requireRole('admin'), getQuestions)
  .post(protect, requireRole('admin'), createQuestion);

router.route('/:id')
  .put(protect, requireRole('admin'), updateQuestion)
  .delete(protect, requireRole('admin'), deleteQuestion);

module.exports = router;
