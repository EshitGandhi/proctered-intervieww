const CodingQuestion = require('../models/CodingQuestion');
const Application = require('../models/Application');
const { processSignature } = require('../services/signatureParser.service');

// ─── Helper: sync flat starterCode/driverCode maps into legacy templates[] ────
// This keeps the candidate CodeEvalRound working without any changes.
const syncTemplates = (starterCode, driverCode, supportedLanguages) => {
  const langs = supportedLanguages || ['cpp', 'c', 'java', 'javascript', 'python', 'php'];
  return langs.map(lang => ({
    language: lang,
    starterCode: starterCode?.[lang] || '',
    driverCode: driverCode?.[lang] || '',
  }));
};

// ─── Helper: build question payload from request body ─────────────────────────
const buildPayload = (body) => {
  const {
    title, description, difficulty, constraints,
    signature, mode,
    starterCode: manualStarterCode,
    driverCode: manualDriverCode,
    supportedLanguages,
    testCases,
  } = body;

  const langs = supportedLanguages?.length
    ? supportedLanguages
    : ['cpp', 'c', 'java', 'javascript', 'python', 'php'];

  let finalMode = mode || 'manual';
  let finalSignature = (signature || '').trim();
  let finalParsed = null;
  let finalStarterCode = manualStarterCode || {};
  let finalDriverCode = manualDriverCode || {};

  // Auto-generate if we have a signature and mode is auto (or not specified)
  if (finalSignature && finalMode !== 'manual') {
    const result = processSignature(finalSignature);
    finalMode = result.mode;
    finalParsed = result.parsedSignature;
    if (result.mode === 'auto') {
      finalStarterCode = result.starterCode;
      finalDriverCode = result.driverCode;
    }
    // If auto-gen chose manual (complex types), keep any manually provided code
  }

  const templates = syncTemplates(finalStarterCode, finalDriverCode, langs);

  return {
    title,
    description,
    difficulty: difficulty || 'medium',
    constraints: Array.isArray(constraints) ? constraints : (constraints ? constraints.split('\n').filter(Boolean) : []),
    signature: finalSignature,
    parsedSignature: finalParsed,
    mode: finalMode,
    starterCode: finalStarterCode,
    driverCode: finalDriverCode,
    supportedLanguages: langs,
    templates, // keep legacy field in sync
    testCases: testCases || [],
  };
};

// ─── Admin Controllers ────────────────────────────────────────────────────────

/** GET /coding-questions — list all */
exports.getQuestions = async (req, res) => {
  try {
    const questions = await CodingQuestion.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: questions.length, data: questions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

/** POST /coding-questions — create question (auto or manual) */
exports.createQuestion = async (req, res) => {
  try {
    const payload = buildPayload(req.body);
    const question = await CodingQuestion.create(payload);
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

/** PUT /coding-questions/:id — update question */
exports.updateQuestion = async (req, res) => {
  try {
    const payload = buildPayload(req.body);
    const question = await CodingQuestion.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
    res.status(200).json({ success: true, data: question });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

/** DELETE /coding-questions/:id */
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ─── Preview Endpoint ─────────────────────────────────────────────────────────

/**
 * POST /coding-questions/preview-signature
 * Body: { signature: "int solve(vector<int> nums, int k)" }
 * Returns: { mode, reason, parsedSignature, starterCode, driverCode }
 */
exports.previewSignature = (req, res) => {
  try {
    const { signature } = req.body;
    const result = processSignature(signature);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ─── Candidate Route ──────────────────────────────────────────────────────────

/** GET /coding-questions/round — 3 random active questions for the candidate */
exports.getRoundQuestions = async (req, res) => {
  try {
    const { appId } = req.query;
    let questions = [];

    if (appId) {
      const app = await Application.findById(appId);
      if (app && app.scores?.coding?.questions && app.scores.coding.questions.length > 0) {
        // Questions already exist for this application, fetch them exactly as they are
        questions = await Promise.all(
          app.scores.coding.questions.map(id => CodingQuestion.findById(id))
        );
        questions = questions.filter(Boolean); // Filter in case a question was deleted
      } 
      
      // If we don't have exactly 3 questions yet, pick 1E, 1M, 1H
      if (app && questions.length < 3) {
        const easy   = await CodingQuestion.aggregate([{ $match: { difficulty: 'easy', isActive: true } }, { $sample: { size: 1 } }]);
        const medium = await CodingQuestion.aggregate([{ $match: { difficulty: 'medium', isActive: true } }, { $sample: { size: 1 } }]);
        const hard   = await CodingQuestion.aggregate([{ $match: { difficulty: 'hard', isActive: true } }, { $sample: { size: 1 } }]);

        const selected = [];
        if (easy[0])   selected.push(easy[0]);
        if (medium[0]) selected.push(medium[0]);
        if (hard[0])   selected.push(hard[0]);

        if (selected.length > 0) {
          // Force save to database to LOCK these questions to this application/candidate
          app.scores.coding.questions = selected.map(q => q._id);
          if (!app.scores.coding.startTime) {
            app.scores.coding.startTime = new Date();
          }
          await Application.updateOne(
            { _id: appId }, 
            { $set: { 
                "scores.coding.questions": app.scores.coding.questions,
                "scores.coding.startTime": app.scores.coding.startTime
              } 
            }
          );
        }
        questions = selected;
      }
    }

    // Last resort fallback (only if appId is missing or all selections failed)
    if (questions.length === 0) {
      questions = await CodingQuestion.aggregate([
        { $match: { isActive: true } },
        { $sample: { size: 3 } }
      ]);
    }

    const formattedQuestions = questions.map(q => {
      // Build templates from flat maps (preferred) or fall back to legacy templates[]
      let templates;
      const langs = q.supportedLanguages || ['cpp', 'c', 'java', 'javascript', 'python'];
      const hasNewFormat = q.starterCode && Object.keys(q.starterCode).some(k => q.starterCode[k]);

      if (hasNewFormat) {
        templates = langs.map(lang => ({
          language: lang,
          starterCode: q.starterCode?.[lang] || '',
        }));
      } else {
        // Legacy question: use templates[] array
        templates = (q.templates || []).map(t => ({
          language: t.language,
          starterCode: t.starterCode || '',
        }));
      }

      return {
        _id: q._id,
        title: q.title,
        description: q.description,
        difficulty: q.difficulty,
        constraints: q.constraints,
        mode: q.mode || 'manual',
        signature: q.signature || '',
        supportedLanguages: q.supportedLanguages || [],
        templates,
        testCases: (q.testCases || []).filter(t => !t.isHidden).map(t => ({
          input: t.input,
          expectedOutput: t.expectedOutput,
        })),
      };
    });

    let appStartTime = null;
    let appAnswers = [];
    if (appId) {
      const appRecord = await Application.findById(appId);
      if (appRecord?.scores?.coding?.startTime) {
        appStartTime = appRecord.scores.coding.startTime;
      }
      if (appRecord?.scores?.coding?.answers) {
        appAnswers = appRecord.scores.coding.answers;
      }
    }

    res.status(200).json({ success: true, data: formattedQuestions, startTime: appStartTime, answers: appAnswers });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
