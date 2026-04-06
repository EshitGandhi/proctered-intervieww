const express = require('express');
const CodingQuestion = require('../models/CodingQuestion');
const { executeCode } = require('../services/judge0.service');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// ─── Helper: build code to execute (inject driver if present) ───────────────
// Supports both new flat driverCode map and legacy templates[] format.
const resolveDriverCode = (question, language) => {
  // New format: flat driverCode map
  if (question.driverCode && question.driverCode[language]) {
    return question.driverCode[language];
  }
  // Legacy format: templates array
  const tpl = question.templates?.find(t => t.language === language);
  return tpl?.driverCode || '';
};

const buildCodeToExecute = (sourceCode, driverCode) => {
  if (!driverCode) return sourceCode;
  if (driverCode.includes('// [[CANDIDATE_CODE]]')) {
    return driverCode.replace('// [[CANDIDATE_CODE]]', sourceCode);
  }
  return sourceCode + '\n\n' + driverCode;
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
// Used by the automated Coding Round.
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

    const driverCode = resolveDriverCode(question, language);
    const codeToExecute = buildCodeToExecute(sourceCode, driverCode);

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
        let passed = !isError && actualOutput === expectedOutput;
        if (!passed && !isError && actualOutput !== '' && expectedOutput !== '') {
          const numA = Number(actualOutput);
          const numE = Number(expectedOutput);
          if (!isNaN(numA) && !isNaN(numE)) passed = numA === numE;
        }
        return {
          hidden: false,
          input: tc.input,
          expected: tc.expectedOutput,
          actual: actualOutput,
          passed: passed,
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
        let passed = !isError && actualOutput === expectedOutput;
        if (!passed && !isError && actualOutput !== '' && expectedOutput !== '') {
          const numA = Number(actualOutput);
          const numE = Number(expectedOutput);
          if (!isNaN(numA) && !isNaN(numE)) passed = numA === numE;
        }
        return {
          hidden: true,
          passed: passed,
          errorType: isError ? errorType : null,
        };
      })
    );

    return res.json({
      success: true,
      data: {
        results: [...visibleResults, ...hiddenResults],
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

module.exports = router;
