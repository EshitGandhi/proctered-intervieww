const Application = require('../models/Application');
const Job = require('../models/Job');
const Interview = require('../models/Interview');
const fs = require('fs');
const pdfParse = require('pdf-parse');

// ─── Real Resume Parser ────────────────────────────────────────────────────────
const parseResumeAndScore = async (resumePath, requiredSkills) => {
  try {
    const dataBuffer = fs.readFileSync(resumePath);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text.toLowerCase();

    const matchedSkills = [];
    const missingSkills = [];

    requiredSkills.forEach(skill => {
      if (extractedText.includes(skill.toLowerCase())) {
        matchedSkills.push(skill);
      } else {
        missingSkills.push(skill);
      }
    });

    const score = requiredSkills.length > 0
      ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
      : 100;

    return { score, matchedSkills, missingSkills };
  } catch (err) {
    console.error('PDF parse error:', err.message);
    // Fallback: return 0 score if PDF cannot be parsed
    return { score: 0, matchedSkills: [], missingSkills: requiredSkills };
  }
};

// ─── Candidate: Apply for Job ──────────────────────────────────────────────────
// POST /api/applications/apply/:jobId
exports.applyForJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const candidateId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job || !job.isActive) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'Job not found or inactive' });
    }

    const existingApp = await Application.findOne({ jobId, candidateId });
    if (existingApp) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'You have already applied for this job' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Resume PDF is required' });
    }

    const { score, matchedSkills, missingSkills } = await parseResumeAndScore(req.file.path, job.requiredSkills);
    const isPassed = score >= job.resumeThreshold;
    const status = isPassed ? 'mcq_pending' : 'resume_rejected';

    const application = await Application.create({
      jobId,
      candidateId,
      status,
      scores: {
        resume: {
          score,
          matchedSkills,
          missingSkills,
          resumeUrl: `/uploads/resumes/${req.file.filename}`,
        }
      }
    });

    const populated = await Application.findById(application._id).populate('jobId', 'title domain mcqThreshold codingThreshold resumeThreshold');

    res.status(201).json({
      success: true,
      message: isPassed
        ? `Resume passed ATS (${score}%). Proceed to MCQ round.`
        : `Resume scored ${score}% — below the required ${job.resumeThreshold}% threshold.`,
      data: populated,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─── Candidate: My Applications ───────────────────────────────────────────────
// GET /api/applications/my
exports.getMyApplications = async (req, res) => {
  try {
    const apps = await Application.find({ candidateId: req.user.id })
      .populate('jobId', 'title domain resumeThreshold mcqThreshold codingThreshold resumeWeight mcqWeight codingWeight interviewWeight')
      .populate('scores.interview.interviewId', 'roomId status scheduledAt')
      .sort('-createdAt');
    res.status(200).json({ success: true, count: apps.length, data: apps });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ─── Admin: All Applications (Filterable) ─────────────────────────────────────
// GET /api/applications/admin/all
exports.getAdminAllApplications = async (req, res) => {
  try {
    const { jobId, minResume, minMcq, minCoding, status } = req.query;

    const filter = {};
    if (jobId) filter.jobId = jobId;
    if (status) filter.status = status;

    let apps = await Application.find(filter)
      .populate('candidateId', 'name email avatar')
      .populate('jobId', 'title domain')
      .populate('scores.interview.interviewId', 'roomId status')
      .sort('-createdAt');

    // Apply score filters in JS (simpler than complex mongo aggregation)
    if (minResume) apps = apps.filter(a => (a.scores.resume?.score || 0) >= Number(minResume));
    if (minMcq) apps = apps.filter(a => (a.scores.mcq?.score || 0) >= Number(minMcq));
    if (minCoding) apps = apps.filter(a => (a.scores.coding?.score || 0) >= Number(minCoding));

    res.status(200).json({ success: true, count: apps.length, data: apps });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ─── Admin: Job Pipeline ───────────────────────────────────────────────────────
// GET /api/applications/job/:jobId
exports.getJobApplications = async (req, res) => {
  try {
    const apps = await Application.find({ jobId: req.params.jobId })
      .populate('candidateId', 'name email avatar')
      .populate('scores.interview.interviewId', 'roomId status scheduledAt')
      .sort('-createdAt');
    res.status(200).json({ success: true, count: apps.length, data: apps });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ─── Admin: Single Application Detail ─────────────────────────────────────────
// GET /api/applications/:appId
exports.getApplicationDetail = async (req, res) => {
  try {
    const app = await Application.findById(req.params.appId)
      .populate('candidateId', 'name email avatar')
      .populate('jobId', 'title domain resumeThreshold mcqThreshold codingThreshold resumeWeight mcqWeight codingWeight interviewWeight')
      .populate('scores.interview.interviewId', 'roomId status scheduledAt duration');

    if (!app) return res.status(404).json({ success: false, error: 'Application not found' });
    res.status(200).json({ success: true, data: app });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ─── Candidate: Submit MCQ ────────────────────────────────────────────────────
// POST /api/applications/:appId/mcq
exports.submitMCQ = async (req, res) => {
  try {
    const { answers } = req.body; // [{ questionId, selectedOption }]
    const application = await Application.findOne({ _id: req.params.appId, candidateId: req.user.id }).populate('jobId');

    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    if (application.status !== 'mcq_pending') return res.status(400).json({ success: false, error: 'MCQ already submitted or not in MCQ phase' });

    const MCQ = require('../models/MCQ');
    const questions = await MCQ.find({ jobId: application.jobId._id });

    let correctCount = 0;
    const evaluatedAnswers = (answers || []).map(ans => {
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

    res.status(200).json({
      success: true,
      data: application,
      message: isPassed ? `MCQ Passed (${score}%)! Proceed to coding round.` : `MCQ Failed (${score}%). Required: ${application.jobId.mcqThreshold}%.`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ─── Admin: Generate Interview ────────────────────────────────────────────────
// POST /api/applications/:appId/generate-interview
exports.generateInterview = async (req, res) => {
  try {
    const app = await Application.findById(req.params.appId)
      .populate('jobId')
      .populate('candidateId');

    if (!app) return res.status(404).json({ success: false, error: 'Application not found' });
    if (app.status !== 'interview_pending') return res.status(400).json({ success: false, error: 'Candidate not in interview_pending status' });
    if (app.scores?.interview?.interviewId) return res.status(400).json({ success: false, error: 'Interview already generated for this application' });

    const { startTime, duration } = req.body;

    const interview = await Interview.create({
      title: `${app.jobId.title} — Final Interview`,
      description: `Final interview for candidate ${app.candidateId.name}`,
      interviewer: req.user.id,
      candidate: app.candidateId._id,
      candidateName: app.candidateId.name,
      candidateEmail: app.candidateId.email,
      status: 'scheduled',
      scheduledAt: startTime || new Date(Date.now() + 24 * 60 * 60 * 1000),
      duration: duration || 60,
      settings: {
        allowCamera: true,
        allowMicrophone: true,
        enableProctoring: true,
        codeExecutionEnabled: true,
        fullscreenRequired: true,
      },
    });

    app.scores.interview = { interviewId: interview._id, score: 0 };
    app.status = 'interview_scheduled';
    await app.save();

    res.status(201).json({ success: true, data: app, interview });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
