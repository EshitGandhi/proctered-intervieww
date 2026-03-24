const Application = require('../models/Application');
const Job = require('../models/Job');
const fs = require('fs');

// Simple Resume Parser Mock (Since you mentioned you have a "Custom resume parser", 
// this is where you would call it. We will simulate checking JD skills against it.)
const parseResumeAndScore = async (resumePath, requiredSkills) => {
  // Simulate parsing delay
  await new Promise(r => setTimeout(r, 1000));
  
  // Simulated output from a custom parser:
  // In a real scenario, this extracts text (e.g., pdf2json) and checks for skills.
  const extractedText = 'A passionate developer skilled in React, Node.js, and some MongoDB. Worked with JavaScript for 3 years.';
  
  const matchedSkills = [];
  const missingSkills = [];

  requiredSkills.forEach(skill => {
    // Basic case-insensitive matching
    if (extractedText.toLowerCase().includes(skill.toLowerCase())) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  });

  const score = requiredSkills.length > 0 
    ? Math.round((matchedSkills.length / requiredSkills.length) * 100) 
    : 100;

  return { score, matchedSkills, missingSkills };
};

// @desc    Apply and run ATS Resume Screening
// @route   POST /api/applications/apply/:jobId
// @access  Private (Candidate)
exports.applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const candidateId = req.user.id;

    // 1. Check if job exists
    const job = await Job.findById(jobId);
    if (!job || !job.isActive) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'Job not found or inactive' });
    }

    // 2. Check if already applied
    const existingApp = await Application.findOne({ jobId, candidateId });
    if (existingApp) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'You have already applied for this job' });
    }

    // 3. Ensure Resume uploaded
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Resume PDF is required' });
    }

    // 4. Run ATS Parsing (Mocked custom parser)
    const { score, matchedSkills, missingSkills } = await parseResumeAndScore(req.file.path, job.requiredSkills);

    // 5. Evaluate ATS Threshold
    const isPassed = score >= job.resumeThreshold;
    const status = isPassed ? 'mcq_pending' : 'resume_rejected';

    // 6. Save Application
    const application = await Application.create({
      jobId,
      candidateId,
      status,
      scores: {
        resume: {
          score,
          matchedSkills,
          missingSkills,
          resumeUrl: `/uploads/resumes/${req.file.filename}`, // Save link
        }
      }
    });

    res.status(201).json({
      success: true,
      message: isPassed ? 'Resume passed the ATS screening. Proceed to MCQ.' : 'Unfortunately, your resume did not meet the required threshold.',
      data: application,
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get Candidate's Applications
// @route   GET /api/applications/my
// @access  Private (Candidate)
exports.getMyApplications = async (req, res) => {
  try {
    const apps = await Application.find({ candidateId: req.user.id })
      .populate('jobId', 'title domain codingThreshold mcqThreshold interviewWeight finalScore')
      .sort('-createdAt');
    res.status(200).json({ success: true, count: apps.length, data: apps });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Admin: get all applications for a job (Pipeline)
// @route   GET /api/applications/job/:jobId
// @access  Private (Admin)
exports.getJobApplications = async (req, res) => {
  try {
    const apps = await Application.find({ jobId: req.params.jobId })
      .populate('candidateId', 'name email avatar')
      .populate('scores.interview.interviewId', 'roomId status')
      .sort('-createdAt');
    res.status(200).json({ success: true, count: apps.length, data: apps });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Submit MCQ Test
// @route   POST /api/applications/:appId/mcq
// @access  Private (Candidate)
exports.submitMCQ = async (req, res) => {
  try {
    const { answers } = req.body; // [{ questionId, selectedOption }]
    const application = await Application.findOne({ _id: req.params.appId, candidateId: req.user.id }).populate('jobId');

    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    if (application.status !== 'mcq_pending') return res.status(400).json({ success: false, error: 'MCQ already submitted or not available' });

    // Fetch actual questions to check answers
    const MCQ = require('../models/MCQ');
    const questions = await MCQ.find({ jobId: application.jobId._id });
    
    let correctCount = 0;
    const evaluatedAnswers = answers.map(ans => {
      const q = questions.find(q => q._id.toString() === ans.questionId);
      const isCorrect = q && q.correctAnswer === ans.selectedOption;
      if (isCorrect) correctCount++;
      return { questionId: ans.questionId, selectedOption: ans.selectedOption, isCorrect };
    });

    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const isPassed = score >= application.jobId.mcqThreshold;

    application.scores.mcq = { score, answers: evaluatedAnswers };
    application.status = isPassed ? 'coding_pending' : 'mcq_failed';
    await application.save();

    res.status(200).json({ success: true, data: application, message: isPassed ? 'MCQ Passed! Proceeding to coding.' : 'MCQ failed.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
