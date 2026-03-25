const Application = require('../models/Application');
const Job = require('../models/Job');
const Interview = require('../models/Interview');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// ─── External ATS API Integration ─────────────────────────────────────────────
const mapDomainToATS = (domain) => {
  const supported = [
    'AI/ML Engineer',
    'PHP Developer',
    'Data Engineer',
    'Data Scientist',
    'DevOps',
    'MERN Developer',
    'Python Developer',
    'Java Developer',
    'DBA',
    'Cloud Engineer',
    'Network Engineer',
    'Go Lang Developer',
    'Technical Support',
    'Business Analyst',
    '.NET Developer',
    'Data Analytics',
    'QA (Quality Assurance)',
  ];
  
  // Try exact match first
  const exact = supported.find(s => s.toLowerCase() === domain?.toLowerCase());
  if (exact) return exact;
  
  // Try partial match
  const partial = supported.find(s => domain?.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(domain?.toLowerCase()));
  if (partial) return partial;

  return 'MERN Developer'; // Default fallback
};

const parseResumeAndScore = async (resumePath, jobDomain) => {
  try {
    const atsDomain = mapDomainToATS(jobDomain);
    const form = new FormData();
    form.append('resume', fs.createReadStream(resumePath));
    form.append('domain', atsDomain);

    const response = await axios.post('https://atsscorer-production.up.railway.app/analyze', form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    // The API returns a score as a string or number. Let's ensure it's a number.
    // Assuming the response is { "score": 85, ... } or { "total_score": 85, ... }
    const score = response.data.score || response.data.total_score || response.data.ats_score || 0;
    
    return { 
      score: Number(score), 
      matchedSkills: response.data.matched_skills || [], 
      missingSkills: response.data.missing_skills || [] 
    };
  } catch (err) {
    console.error('External ATS API error:', err.response?.data || err.message);
    // Fallback: return 0 score if API fails
    return { score: 0, matchedSkills: [], missingSkills: [] };
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

    const { score, matchedSkills, missingSkills } = await parseResumeAndScore(req.file.path, job.domain);
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

    const totalQuestions = application.jobId.mcqCount || questions.length || 1;
    const score = Math.round((correctCount / totalQuestions) * 100);
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

    const { startTime, duration } = req.body || {};

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

// ─── Admin overrides ───────────────────────────────────────────────────────────
// DELETE /api/applications/:appId
exports.deleteApplication = async (req, res) => {
  try {
    const app = await Application.findById(req.params.appId);
    if (!app) return res.status(404).json({ success: false, error: 'Application not found' });
    
    // optionally delete file if it exists, though storage.service logic would be better
    if (app.scores?.resume?.resumeUrl) {
      const p = path.join(process.cwd(), app.scores.resume.resumeUrl);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    
    await Application.findByIdAndDelete(req.params.appId);
    res.status(200).json({ success: true, message: 'Application deleted. Candidate can re-apply.' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// POST /api/applications/:appId/override
// body: { action: 'force_mcq' | 'retry_mcq' }
exports.overrideApplicationStatus = async (req, res) => {
  try {
    const app = await Application.findById(req.params.appId).populate('jobId').populate('candidateId');
    if (!app) return res.status(404).json({ success: false, error: 'Application not found' });

    const { action } = req.body;
    let message = '';

    if (action === 'force_mcq' && app.status === 'resume_rejected') {
      app.status = 'mcq_pending';
      message = 'ATS Resume result overridden. Candidate can now take the MCQ round.';
    } else if (action === 'retry_mcq' && app.status === 'mcq_failed') {
      app.status = 'mcq_pending';
      delete app.scores.mcq;
      // Tricky: mongoose maps require MarkModified if not fully replacing, but deleting the whole key is ok if we use doc.set
      app.set('scores.mcq', undefined); 
      message = 'MCQ score reset. Candidate can retake the MCQ round.';
    } else {
      return res.status(400).json({ success: false, error: 'Invalid override action for current status' });
    }

    await app.save();
    res.status(200).json({ success: true, data: app, message });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
