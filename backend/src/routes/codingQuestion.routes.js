const express = require('express');
const { protect, requireRole } = require('../middleware/auth.middleware');
const {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getRoundQuestions,
  previewSignature,
} = require('../controllers/codingQuestion.controller');

const router = express.Router();

// ─── Candidate ────────────────────────────────────────────────────────────────
// Fetch 3 random questions for the coding round
router.get('/round', protect, requireRole('candidate'), getRoundQuestions);

// ─── Admin: Signature Preview (must come before /:id routes) ─────────────────
router.post('/preview-signature', protect, requireRole('admin'), previewSignature);

// ─── Admin CRUD ───────────────────────────────────────────────────────────────
router.route('/')
  .get(protect, requireRole('admin'), getQuestions)
  .post(protect, requireRole('admin'), createQuestion);

router.route('/:id')
  .put(protect, requireRole('admin'), updateQuestion)
  .delete(protect, requireRole('admin'), deleteQuestion);

module.exports = router;
