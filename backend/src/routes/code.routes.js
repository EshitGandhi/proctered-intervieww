const express = require('express');
const CodeSubmission = require('../models/CodeSubmission');
const CodingQuestion = require('../models/CodingQuestion');
const { executeCode, LANGUAGE_IDS } = require('../services/judge0.service');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// ─── Helper: build code to execute (inject driver if present) ───────────────
const buildCodeToExecute = (sourceCode, template) => {
  if (!template?.driverCode) return sourceCode;
  if (template.driverCode.includes('// [[CANDIDATE_CODE]]')) {
    return template.driverCode.replace('// [[CANDIDATE_CODE]]', sourceCode);
  }
  return sourceCode + '\n\n' + template.driverCode;
};

// ─── Helper: classify error type from Judge0 result ─────────────────────────
const classifyError = (result) => {
  if (result.compileOutput && result.compileOutput.trim()) return 'Compiler Error';
  if (result.stderr && result.stderr.trim()) {
    if (result.status === 'Time Limit Exceeded') return 'Time Limit Exceeded';
    return 'Runtime Error';
  }
  return null;
};

// POST /api/code/run-with-tests
// Runs code against all test cases for a question server-side.
// Visible TCs → full detail (input, expected, actual, stderr).
// Hidden  TCs → pass/fail + error type only (inputs/outputs never sent to client).
router.post('/run-with-tests', protect, async (req, res) => {
  try {
    const { questionId, language, sourceCode } = req.body;

    if (!questionId || !language || !sourceCode) {
      return res.status(400).json({ success: false, message: 'questionId, language, and sourceCode are required' });
    }

    const question = await CodingQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const template = question.templates?.find(t => t.language === language);
    const codeToExecute = buildCodeToExecute(sourceCode, template);

    const visibleTCs = question.testCases.filter(tc => !tc.isHidden);
    const hiddenTCs  = question.testCases.filter(tc => tc.isHidden);

    // Run visible test cases in parallel
    const visibleResults = await Promise.all(
      visibleTCs.map(async (tc) => {
        const result = await executeCode({ language, sourceCode: codeToExecute, stdin: tc.input });
        const actualOutput = (result.stdout || '').trim();
        const expectedOutput = (tc.expectedOutput || '').trim();
        const errorType = classifyError(result);
        const isError = !!errorType;
        return {
          hidden: false,
          input: tc.input,
          expected: tc.expectedOutput,
          actual: actualOutput,
          passed: !isError && actualOutput === expectedOutput,
          stderr: result.compileOutput || result.stderr || '',
          errorType: isError ? errorType : null,
        };
      })
    );

    // Run hidden test cases in parallel — strip inputs/outputs from response
    const hiddenResults = await Promise.all(
      hiddenTCs.map(async (tc) => {
        const result = await executeCode({ language, sourceCode: codeToExecute, stdin: tc.input });
        const actualOutput = (result.stdout || '').trim();
        const expectedOutput = (tc.expectedOutput || '').trim();
        const errorType = classifyError(result);
        const isError = !!errorType;
        return {
          hidden: true,
          passed: !isError && actualOutput === expectedOutput,
          errorType: isError ? errorType : null,
          // NOTE: input, expected, actual are intentionally omitted
        };
      })
    );

    return res.json({
      success: true,
      data: {
        results: [...visibleResults, ...hiddenResults],
        // Surface the first error for the top-level error banner
        firstError: (() => {
          const err = visibleResults.find(r => r.errorType);
          return err ? { errorType: err.errorType, errorMsg: err.stderr } : null;
        })(),
      }
    });
  } catch (err) {
    console.error('run-with-tests error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Execution failed' });
  }
});

// POST /api/code/run
router.post('/run', protect, async (req, res) => {
  const { language, sourceCode, stdin, interviewId, questionId } = req.body;

  if (!language || !sourceCode) {
    return res.status(400).json({ success: false, message: 'language and sourceCode are required' });
  }

  let codeToExecute = sourceCode;
  if (questionId) {
    const question = await CodingQuestion.findById(questionId);
    if (question && question.templates) {
      const template = question.templates.find(t => t.language === language);
      if (template && template.driverCode) {
        if (template.driverCode.includes('// [[CANDIDATE_CODE]]')) {
          codeToExecute = template.driverCode.replace('// [[CANDIDATE_CODE]]', sourceCode);
        } else {
          codeToExecute = sourceCode + '\n\n' + template.driverCode;
        }
      }
    }
  }

  const result = await executeCode({ language, sourceCode: codeToExecute, stdin: stdin || '' });

  if (interviewId) {
    await CodeSubmission.create({
      interview: interviewId,
      candidate: req.user?._id,
      questionId: questionId || null,
      language,
      languageId: LANGUAGE_IDS[language],
      sourceCode,
      stdin: stdin || '',
      stdout: result.stdout,
      stderr: result.stderr,
      compileOutput: result.compileOutput,
      status: result.status,
      time: result.time,
      memory: result.memory,
      isSubmission: false,
    });
  }

  res.json({ success: true, data: result });
});

// POST /api/code/submit
router.post('/submit', protect, async (req, res) => {
  const { language, sourceCode, stdin, interviewId, questionId } = req.body;

  if (!language || !sourceCode || !interviewId) {
    return res.status(400).json({ success: false, message: 'language, sourceCode, and interviewId are required' });
  }

  let codeToExecute = sourceCode;
  if (questionId) {
    const question = await CodingQuestion.findById(questionId);
    if (question && question.templates) {
      const template = question.templates.find(t => t.language === language);
      if (template && template.driverCode) {
        if (template.driverCode.includes('// [[CANDIDATE_CODE]]')) {
          codeToExecute = template.driverCode.replace('// [[CANDIDATE_CODE]]', sourceCode);
        } else {
          codeToExecute = sourceCode + '\n\n' + template.driverCode;
        }
      }
    }
  }

  const result = await executeCode({ language, sourceCode: codeToExecute, stdin: stdin || '' });

  const submission = await CodeSubmission.create({
    interview: interviewId,
    candidate: req.user?._id,
    questionId: questionId || null,
    language,
    languageId: LANGUAGE_IDS[language],
    sourceCode,
    stdin: stdin || '',
    stdout: result.stdout,
    stderr: result.stderr,
    compileOutput: result.compileOutput,
    status: result.status,
    time: result.time,
    memory: result.memory,
    isSubmission: true,
    submittedAt: new Date(),
  });

  res.status(201).json({ success: true, data: { result, submission } });
});

// GET /api/code/interview/:interviewId
router.get('/interview/:interviewId', protect, async (req, res) => {
  const submissions = await CodeSubmission.find({ interview: req.params.interviewId })
    .populate('candidate', 'name email')
    .sort({ submittedAt: -1 });
  res.json({ success: true, data: submissions });
});

module.exports = router;
