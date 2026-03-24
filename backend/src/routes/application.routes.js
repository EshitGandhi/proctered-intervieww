const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { applyForJob, getMyApplications, getJobApplications, submitMCQ } = require('../controllers/application.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const Application = require('../models/Application');
const Interview = require('../models/Interview');

const router = express.Router();

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
const upload = multer({ storage });

// Candidate applies for Job
router.post('/apply/:jobId', protect, upload.single('resume'), applyForJob);

// Candidate fetches their applications
router.get('/my', protect, getMyApplications);

// Admin fetches applications for a specific job
router.get('/job/:jobId', protect, requireRole('admin', 'interviewer'), getJobApplications);

// Candidate submits MCQ test
router.post('/:appId/mcq', protect, submitMCQ);

// Candidate Submits Coding Round Score
router.post('/:appId/coding', protect, async (req, res) => {
  try {
    const { score } = req.body;
    const application = await Application.findOne({ _id: req.params.appId, candidateId: req.user.id }).populate('jobId');

    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    if (application.status !== 'coding_pending') return res.status(400).json({ success: false, error: 'Not in coding phase' });

    const isPassed = score >= application.jobId.codingThreshold;

    // Calculate final weighted score
    const resWeight = application.jobId.resumeWeight / 100;
    const mcqWeight = application.jobId.mcqWeight / 100;
    const codeWeight = application.jobId.codingWeight / 100;
    
    // We don't have interview score yet, assume 0 for now.
    const finalScore = (application.scores.resume.score * resWeight) + 
                       (application.scores.mcq.score * mcqWeight) + 
                       (score * codeWeight);

    application.scores.coding = { score };
    application.scores.finalScore = Math.round(finalScore);
    application.status = isPassed ? 'interview_pending' : 'coding_failed';
    
    await application.save();

    res.status(200).json({ 
      success: true, 
      data: application, 
      message: isPassed ? 'Coding round passed! Awaiting interview.' : 'Failed coding round.'
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Admin generates an interview session for a candidate who passed all rounds
router.post('/:appId/generate-interview', protect, requireRole('admin', 'interviewer'), async (req, res) => {
  try {
    const { startTime, duration } = req.body;
    
    const app = await Application.findById(req.params.appId)
      .populate('jobId')
      .populate('candidateId');
      
    if (!app) return res.status(404).json({ success: false, error: 'Application Not Found' });
    if (app.status !== 'interview_pending') return res.status(400).json({ success: false, error: 'Candidate is not ready for an interview yet.' });

    // Create the interview session
    const interview = await Interview.create({
      title: `${app.jobId.title} - Final Interview`,
      description: `Final interview phase for the ${app.jobId.title} position.`,
      interviewer: req.user.id,
      candidate: app.candidateId._id,
      candidateName: app.candidateId.name,
      candidateEmail: app.candidateId.email,
      status: 'scheduled',
      scheduledAt: startTime || new Date(Date.now() + 24 * 60 * 60 * 1000), // Default to tomorrow
      duration: duration || 60,
      settings: {
        allowCamera: true,
        allowMicrophone: true,
        enableProctoring: true,
        codeExecutionEnabled: true,
        fullscreenRequired: true
      }
    });

    // Link back to application and update status
    app.scores.interview = {
      interviewId: interview._id,
      score: 0 // To be graded later
    };
    app.status = 'interview_completed'; // For tracking UI, it means the phase is provisioned
    await app.save();

    res.status(201).json({ success: true, data: app, interview });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
