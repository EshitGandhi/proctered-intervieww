const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Interview = require('../models/Interview');
const Application = require('../models/Application');
const Feedback = require('../models/Feedback');
const { protect, requireRole } = require('../middleware/auth.middleware');
const { generateFeedbackReport } = require('../services/report.service');

const router = express.Router();

// POST /api/interviews
router.post('/', protect, requireRole('admin'), async (req, res) => {
  const { title, description, candidateName, candidateEmail, duration, scheduledAt, questions, settings } = req.body;
  const interview = await Interview.create({
    title, description, candidateName, candidateEmail,
    interviewer: req.user._id,
    duration: duration || 60,
    scheduledAt, questions: questions || [], settings,
    roomId: uuidv4(),
  });
  res.status(201).json({ success: true, data: interview });
});

// GET /api/interviews
router.get('/', protect, requireRole('admin'), async (req, res) => {
  const filter = {};
  const interviews = await Interview.find(filter)
    .populate('interviewer', 'name email')
    .populate('candidate', 'name email')
    .sort({ createdAt: -1 });
  res.json({ success: true, data: interviews });
});

// GET /api/interviews/room/:roomId  — must come BEFORE /:id
router.get('/room/:roomId', protect, async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ roomId: req.params.roomId })
      .populate('interviewer', 'name email');
    if (!interview) return res.status(404).json({ success: false, message: 'Room not found' });

    // Block candidate from joining if session is not active
    if (req.user.role === 'candidate' && interview.status !== 'active') {
      return res.status(403).json({ success: false, message: 'The interviewer has not started this session yet. Please wait.' });
    }

    res.json({ success: true, data: interview });
  } catch (error) {
    next(error);
  }
});

// GET /api/interviews/:id
router.get('/:id', protect, async (req, res) => {
  const interview = await Interview.findById(req.params.id)
    .populate('interviewer', 'name email')
    .populate('candidate', 'name email');
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  res.json({ success: true, data: interview });
});

// PATCH /api/interviews/:id/start
router.patch('/:id/start', protect, requireRole('admin'), async (req, res) => {
  const interview = await Interview.findByIdAndUpdate(
    req.params.id, { status: 'active', startedAt: new Date() }, { new: true }
  );
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  res.json({ success: true, data: interview });
});

// PATCH /api/interviews/:id/end
router.patch('/:id/end', protect, requireRole('admin'), async (req, res) => {
  try {
    const interview = await Interview.findByIdAndUpdate(
      req.params.id, { status: 'completed', endedAt: new Date() }, { new: true }
    );
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    // Also update the linked Application status to 'interview_completed'
    await Application.findOneAndUpdate(
      { 'scores.interview.interviewId': req.params.id, status: 'interview_scheduled' },
      { status: 'interview_completed' }
    );

    res.json({ success: true, data: interview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/interviews/:id/reschedule
router.patch('/:id/reschedule', protect, requireRole('admin'), async (req, res) => {
  try {
    const interview = await Interview.findByIdAndUpdate(
      req.params.id,
      {
        status: 'scheduled',
        scheduledAt: req.body.scheduledAt || new Date(),
        startedAt: null,
        endedAt: null
      },
      { new: true }
    );
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    // Ensure the linked Application status returns to 'interview_scheduled'
    await Application.findOneAndUpdate(
      { 'scores.interview.interviewId': req.params.id },
      { status: 'interview_scheduled' }
    );

    res.json({ success: true, data: interview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/interviews/:id
router.patch('/:id', protect, requireRole('admin'), async (req, res) => {
  const interview = await Interview.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  res.json({ success: true, data: interview });
});

// DELETE /api/interviews/:id
router.delete('/:id', protect, requireRole('admin'), async (req, res) => {
  await Interview.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Interview deleted' });
});

// GET /api/interviews/:id/feedback-context
router.get('/:id/feedback-context', protect, requireRole('admin'), async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)
      .populate('interviewer', 'name email')
      .populate('candidate', 'name email');
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    const application = await Application.findOne({ 'scores.interview.interviewId': interview._id }).populate('jobId');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application linked to this interview not found' });
    }

    res.json({
      success: true,
      data: {
        interview,
        job: application.jobId,
        candidate: interview.candidate,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/interviews/:id/feedback
router.post('/:id/feedback', protect, requireRole('admin'), async (req, res) => {
  try {
    const { communication, technicalSkills, improvementFeedback, recommendation, candidateId, jobId } = req.body;

    if (!communication || !technicalSkills || !improvementFeedback || !recommendation) {
      return res.status(400).json({ success: false, message: 'All feedback fields are required.' });
    }

    const interviewId = req.params.id;

    const existingFeedback = await Feedback.findOne({ interview: interviewId });
    if (existingFeedback) {
      return res.status(400).json({ success: false, message: 'Feedback already submitted for this interview.' });
    }

    const feedback = await Feedback.create({
      interview: interviewId,
      candidate: candidateId,
      job: jobId,
      interviewer: req.user._id,
      communication,
      technicalSkills,
      improvementFeedback,
      recommendation,
    });

    // Calculate score (1-4 mapped to 10 scale).
    const scoreMap = { 'Poor': 1, 'Good': 2, 'Best': 3, 'Excellent': 4 };
    let totalItems = 2 + technicalSkills.length; // verbal, confidence + tech skills
    let totalScore = scoreMap[communication.verbal] + scoreMap[communication.confidence];
    technicalSkills.forEach(ts => {
      totalScore += scoreMap[ts.rating];
    });

    const interviewScore = ((totalScore / (totalItems * 4)) * 10).toFixed(1);

    // Update Application score
    const application = await Application.findOne({ 'scores.interview.interviewId': interviewId }).populate('jobId');
    if (application) {
      application.scores.interview.score = parseFloat(interviewScore);
      
      const resW = application.jobId.resumeWeight / 100 || 0.2;
      const mcqW = application.jobId.mcqWeight / 100 || 0.2;
      const codeW = application.jobId.codingWeight / 100 || 0.3;
      const intW = application.jobId.interviewWeight / 100 || 0.3;
      
      const finalScore = Math.round(
        ((application.scores.resume?.score || 0) * resW) +
        ((application.scores.mcq?.score || 0) * mcqW) +
        ((application.scores.coding?.score || 0) * codeW) +
        (parseFloat(interviewScore) * intW * 10) 
      );
      
      application.scores.finalScore = finalScore;
      await application.save();
    }

    // Generate PDF report using structured feedback
    await generateFeedbackReport(feedback, interviewScore, application);

    res.status(201).json({ success: true, data: feedback, interviewScore });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
