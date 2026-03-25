const express = require('express');
const CodeSubmission = require('../models/CodeSubmission');
const CodingQuestion = require('../models/CodingQuestion');
const { executeCode, LANGUAGE_IDS } = require('../services/judge0.service');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

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
