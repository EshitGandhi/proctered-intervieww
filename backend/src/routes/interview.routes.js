const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Interview = require('../models/Interview');
const { protect, requireRole } = require('../middleware/auth.middleware');

const router = express.Router();

// POST /api/interviews
router.post('/', protect, requireRole('interviewer', 'admin'), async (req, res) => {
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
router.get('/', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { interviewer: req.user._id };
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
router.patch('/:id/start', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  const interview = await Interview.findByIdAndUpdate(
    req.params.id, { status: 'active', startedAt: new Date() }, { new: true }
  );
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  res.json({ success: true, data: interview });
});

// PATCH /api/interviews/:id/end
router.patch('/:id/end', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  const interview = await Interview.findByIdAndUpdate(
    req.params.id, { status: 'completed', endedAt: new Date() }, { new: true }
  );
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  res.json({ success: true, data: interview });
});

// POST /api/interviews/:id/reschedule (Changed from PATCH to POST as it creates a new resource)
router.post('/:id/reschedule', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  try {
    const oldInterview = await Interview.findById(req.params.id);
    if (!oldInterview) return res.status(404).json({ success: false, message: 'Original interview not found' });

    // Create a NEW interview session based on the old one
    const newInterview = await Interview.create({
      title: `${oldInterview.title} (Round ${Date.now().toString().slice(-3)})`,
      description: oldInterview.description,
      interviewer: oldInterview.interviewer,
      candidate: oldInterview.candidate,
      candidateName: oldInterview.candidateName,
      candidateEmail: oldInterview.candidateEmail,
      duration: oldInterview.duration,
      scheduledAt: req.body.scheduledAt || new Date(),
      questions: oldInterview.questions,
      settings: oldInterview.settings,
      status: 'scheduled',
      roomId: uuidv4(), // New room for the new session
    });

    res.status(201).json({ success: true, data: newInterview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/interviews/:id
router.patch('/:id', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  const interview = await Interview.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });
  res.json({ success: true, data: interview });
});

// DELETE /api/interviews/:id
router.delete('/:id', protect, requireRole('interviewer', 'admin'), async (req, res) => {
  await Interview.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Interview deleted' });
});

module.exports = router;
