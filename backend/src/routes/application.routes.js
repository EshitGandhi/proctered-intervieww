const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, requireRole } = require('../middleware/auth.middleware');
const {
  applyForJob,
  getMyApplications,
  getJobApplications,
  getAdminAllApplications,
  getApplicationDetail,
  submitMCQ,
  generateInterview,
} = require('../controllers/application.controller');
const Application = require('../models/Application');

const router = express.Router();

// Resume upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'resumes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `resume-${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  },
});

// ─── Candidate Routes ──────────────────────────────────────────────────────────
router.post('/apply/:jobId', protect, upload.single('resume'), applyForJob);
router.get('/my', protect, getMyApplications);
router.post('/:appId/mcq', protect, submitMCQ);

// Candidate submits coding score
router.post('/:appId/coding', protect, async (req, res) => {
  try {
    const { score } = req.body;
    const application = await Application.findOne({ _id: req.params.appId, candidateId: req.user.id }).populate('jobId');
    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    if (application.status !== 'coding_pending') return res.status(400).json({ success: false, error: 'Not in coding phase' });

    const isPassed = score >= application.jobId.codingThreshold;

    const resW = application.jobId.resumeWeight / 100;
    const mcqW = application.jobId.mcqWeight / 100;
    const codeW = application.jobId.codingWeight / 100;
    const finalScore = Math.round(
      ((application.scores.resume?.score || 0) * resW) +
      ((application.scores.mcq?.score || 0) * mcqW) +
      (score * codeW)
    );

    application.scores.coding = { score };
    application.scores.finalScore = finalScore;
    application.status = isPassed ? 'interview_pending' : 'coding_failed';
    await application.save();

    res.status(200).json({
      success: true,
      data: application,
      message: isPassed ? `Coding passed (${score}%)! Awaiting interview.` : `Coding failed (${score}%). Required: ${application.jobId.codingThreshold}%.`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ─── Admin Routes ──────────────────────────────────────────────────────────────
router.get('/admin/all', protect, requireRole('admin', 'interviewer'), getAdminAllApplications);
router.get('/job/:jobId', protect, requireRole('admin', 'interviewer'), getJobApplications);
router.get('/:appId', protect, getApplicationDetail);
router.post('/:appId/generate-interview', protect, requireRole('admin', 'interviewer'), generateInterview);

module.exports = router;
