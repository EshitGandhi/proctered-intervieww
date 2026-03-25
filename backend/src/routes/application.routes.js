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
  deleteApplication,
  overrideApplicationStatus,
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

// Candidate submits coding round (auto-graded against hidden test cases)
router.post('/:appId/coding', protect, async (req, res) => {
  try {
    // submissions: [{ questionId, language, sourceCode }]
    const { submissions } = req.body;
    const application = await Application.findOne({ _id: req.params.appId, candidateId: req.user.id }).populate('jobId');
    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    if (application.status !== 'coding_pending') return res.status(400).json({ success: false, error: 'Not in coding phase' });

    if (!submissions || submissions.length === 0) {
      return res.status(400).json({ success: false, error: 'No submissions provided' });
    }

    // Load all submitted questions with their hidden test cases
    const CodingQuestion = require('../models/CodingQuestion');
    const { executeCode } = require('../services/judge0.service');

    let totalTestCases = 0;
    let passedTestCases = 0;
    const results = [];

    for (const sub of submissions) {
      const question = await CodingQuestion.findById(sub.questionId);
      if (!question) continue;

      const qResults = { questionId: sub.questionId, title: question.title, testsPassed: 0, testsTotal: 0, testCaseResults: [] };

      for (const tc of question.testCases) {
        qResults.testsTotal++;
        totalTestCases++;
        try {
          // Join with driver code if template exists
          let codeToExecute = sub.sourceCode;
          if (question.templates) {
            const template = question.templates.find(t => t.language === sub.language);
            if (template && template.driverCode) {
              if (template.driverCode.includes('// [[CANDIDATE_CODE]]')) {
                codeToExecute = template.driverCode.replace('// [[CANDIDATE_CODE]]', sub.sourceCode);
              } else {
                codeToExecute = sub.sourceCode + '\n\n' + template.driverCode;
              }
            }
          }

          const execResult = await executeCode({
            language: sub.language || 'python',
            sourceCode: codeToExecute,
            stdin: tc.input,
          });
          // Normalize output: trim whitespace to be lenient
          const actualOut = (execResult.stdout || '').trim();
          const expectedOut = (tc.expectedOutput || '').trim();
          const passed = actualOut === expectedOut;
          if (passed) { passedTestCases++; qResults.testsPassed++; }
          qResults.testCaseResults.push({
            input: tc.isHidden ? '[hidden]' : tc.input,
            expected: tc.isHidden ? '[hidden]' : tc.expectedOutput,
            actual: tc.isHidden ? (passed ? '✅ Passed' : '❌ Failed') : actualOut,
            passed,
          });
        } catch (e) {
          qResults.testCaseResults.push({ input: tc.isHidden ? '[hidden]' : tc.input, passed: false, error: e.message });
        }
      }
      results.push(qResults);
    }

    // Score = percentage of total test cases passed across all questions
    const score = totalTestCases > 0 ? Math.round((passedTestCases / totalTestCases) * 100) : 0;
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
      score,
      results, // detailed per-question breakdown
      message: isPassed
        ? `Coding passed! Score: ${score}%. Awaiting interview.`
        : `Coding failed. Score: ${score}%. Required: ${application.jobId.codingThreshold}%.`
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Candidate evaluates a single question (runs against hidden test cases, but doesn't finalize round)
router.post('/:appId/coding/evaluate', protect, async (req, res) => {
  try {
    const { questionId, language, sourceCode } = req.body;
    const application = await Application.findOne({ _id: req.params.appId, candidateId: req.user.id });
    if (!application) return res.status(404).json({ success: false, error: 'Application not found' });
    if (application.status !== 'coding_pending') return res.status(400).json({ success: false, error: 'Not in coding phase' });

    const CodingQuestion = require('../models/CodingQuestion');
    const { executeCode } = require('../services/judge0.service');
    const question = await CodingQuestion.findById(questionId);
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });

    let testsPassed = 0;
    const testCaseResults = [];

    for (const tc of question.testCases) {
      try {
        let codeToExecute = sourceCode;
        if (question.templates) {
          const template = question.templates.find(t => t.language === language);
          if (template && template.driverCode) {
            codeToExecute = template.driverCode.includes('// [[CANDIDATE_CODE]]') 
              ? template.driverCode.replace('// [[CANDIDATE_CODE]]', sourceCode)
              : sourceCode + '\n\n' + template.driverCode;
          }
        }

        const execResult = await executeCode({ language, sourceCode: codeToExecute, stdin: tc.input });
        const actualOut = (execResult.stdout || '').trim();
        const expectedOut = (tc.expectedOutput || '').trim();
        const passed = actualOut === expectedOut;
        if (passed) testsPassed++;

        testCaseResults.push({
          passed,
          actual: tc.isHidden ? (passed ? '✅ Passed' : '❌ Failed') : actualOut,
          expected: tc.isHidden ? '[hidden]' : expectedOut,
          input: tc.isHidden ? '[hidden]' : tc.input,
          stderr: execResult.stderr,
        });
      } catch (e) {
        testCaseResults.push({ passed: false, error: e.message });
      }
    }

    res.status(200).json({
      success: true,
      testsPassed,
      testsTotal: question.testCases.length,
      results: testCaseResults,
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
router.delete('/:appId', protect, requireRole('admin', 'interviewer'), deleteApplication);
router.post('/:appId/override', protect, requireRole('admin', 'interviewer'), overrideApplicationStatus);

module.exports = router;
