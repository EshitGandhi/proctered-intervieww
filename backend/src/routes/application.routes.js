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
  deleteApplication,
  overrideApplicationStatus,
} = require('../controllers/application.controller');
const Application = require('../models/Application');
const { finalScoreFromApplication } = require('../utils/applicationScores');

const { uploadResume } = require('../services/storage.service');

const router = express.Router();

// ─── Candidate Routes ──────────────────────────────────────────────────────────
router.post('/apply/:jobId', protect, uploadResume.single('resume'), applyForJob);
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

    // Helper: resolve driver code with flat map first, then legacy templates[]
    const resolveDriverCode = (question, language) => {
      if (question.driverCode?.[language]) return question.driverCode[language];
      const tpl = question.templates?.find(t => t.language === language);
      return tpl?.driverCode || '';
    };

    const buildCode = (sourceCode, driverCode) => {
      if (!driverCode) return sourceCode;
      if (driverCode.includes('// [[CANDIDATE_CODE]]')) {
        return driverCode.replace('// [[CANDIDATE_CODE]]', sourceCode);
      }
      return sourceCode + '\n\n' + driverCode;
    };

    // Each question contributes equally to the final round score (per-question pass rate averaged)
    let totalQuestionScore = 0;
    const scoredQuestions = new Set();
    const results = [];
    const plannedCount = application.jobId.codingCount || 3;

    for (const sub of submissions) {
      if (scoredQuestions.has(sub.questionId)) continue;
      
      const question = await CodingQuestion.findById(sub.questionId);
      if (!question) continue;

      const driverCode = resolveDriverCode(question, sub.language);
      const codeToExecute = buildCode(sub.sourceCode, driverCode);

      const qResults = { questionId: sub.questionId, title: question.title, testsPassed: 0, testsTotal: 0, testCaseResults: [] };

      for (const tc of question.testCases) {
        qResults.testsTotal++;
        try {
          const execResult = await executeCode({
            language: sub.language || 'python',
            sourceCode: codeToExecute,
            stdin: tc.input,
          });
          // Normalize output: trim whitespace to be lenient
          const actualOut = (execResult.stdout || '').trim();
          const expectedOut = (tc.expectedOutput || '').trim();
          let passed = actualOut === expectedOut;
          if (!passed && actualOut !== '' && expectedOut !== '') {
            const numActual = Number(actualOut);
            const numExpected = Number(expectedOut);
            if (!isNaN(numActual) && !isNaN(numExpected)) {
              passed = numActual === numExpected;
            }
          }
          if (passed) qResults.testsPassed++;
          qResults.testCaseResults.push({
            input: tc.isHidden ? '[hidden]' : tc.input,
            expected: tc.isHidden ? '[hidden]' : tc.expectedOutput,
            actual: tc.isHidden ? (passed ? '\u2705 Passed' : '\u274c Failed') : actualOut,
            passed,
          });
        } catch (e) {
          qResults.testCaseResults.push({ input: tc.isHidden ? '[hidden]' : tc.input, passed: false, error: e.message });
        }
      }

      results.push(qResults);

      // Equal weightage: each question contributes its own pass% equally (out of plannedCount)
      const qPassRate = qResults.testsTotal > 0
        ? (qResults.testsPassed / qResults.testsTotal) * 100
        : 0;
      
      totalQuestionScore += qPassRate;
      scoredQuestions.add(sub.questionId);
    }

    // Score = average per-question pass rate across ALL intended questions (0 for unattempted)
    const score = Math.round(totalQuestionScore / plannedCount);
    const isPassed = score >= application.jobId.codingThreshold;

    const finalScore = finalScoreFromApplication(application, score);

    application.scores.coding = { score };
    application.scores.finalScore = finalScore;
    application.status = isPassed ? 'coding_passed' : 'coding_failed';
    await application.save();

    res.status(200).json({
      success: true,
      data: application,
      score,
      results, // detailed per-question breakdown
      message: isPassed
        ? `Coding passed! Score: ${score}%. Pipeline finished.`
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

    // Helper: resolve driver code with flat map first, then legacy templates[]
    const resolveDriverCode = (q, lang) => {
      if (q.driverCode?.[lang]) return q.driverCode[lang];
      const tpl = q.templates?.find(t => t.language === lang);
      return tpl?.driverCode || '';
    };
    const driverCode = resolveDriverCode(question, language);
    const codeToExecute = driverCode
      ? (driverCode.includes('// [[CANDIDATE_CODE]]')
          ? driverCode.replace('// [[CANDIDATE_CODE]]', sourceCode)
          : sourceCode + '\n\n' + driverCode)
      : sourceCode;

    let testsPassed = 0;
    const testCaseResults = [];

    for (const tc of question.testCases) {
      try {
        const execResult = await executeCode({ language, sourceCode: codeToExecute, stdin: tc.input });
        const actualOut = (execResult.stdout || '').trim();
        const expectedOut = (tc.expectedOutput || '').trim();
        let passed = actualOut === expectedOut;
        if (!passed && actualOut !== '' && expectedOut !== '') {
          const numActual = Number(actualOut);
          const numExpected = Number(expectedOut);
          if (!isNaN(numActual) && !isNaN(numExpected)) {
            passed = numActual === numExpected;
          }
        }
        if (passed) testsPassed++;

        testCaseResults.push({
          passed,
          actual: tc.isHidden ? (passed ? '\u2705 Passed' : '\u274c Failed') : actualOut,
          expected: tc.isHidden ? '[hidden]' : expectedOut,
          input: tc.isHidden ? '[hidden]' : tc.input,
          stderr: execResult.stderr,
        });
      } catch (e) {
        testCaseResults.push({ passed: false, error: e.message });
      }
    }

    // Save submitted answer to lock it down
    if (!application.scores.coding.answers) application.scores.coding.answers = [];
    const existingAns = application.scores.coding.answers.find(a => a.questionId.toString() === questionId);
    if (existingAns) {
      existingAns.code = sourceCode;
      existingAns.language = language;
    } else {
      application.scores.coding.answers.push({ questionId, code: sourceCode, language });
    }
    await application.save();

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
router.get('/admin/all', protect, requireRole('admin'), getAdminAllApplications);
router.get('/job/:jobId', protect, requireRole('admin'), getJobApplications);
router.get('/:appId', protect, getApplicationDetail);
router.delete('/:appId', protect, requireRole('admin'), deleteApplication);
router.post('/:appId/override', protect, requireRole('admin'), overrideApplicationStatus);

module.exports = router;
