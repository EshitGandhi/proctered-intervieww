const CodingQuestion = require('../models/CodingQuestion');

// Admin Commands
exports.getQuestions = async (req, res) => {
  try {
    const questions = await CodingQuestion.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: questions.length, data: questions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.create(req.body);
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
    res.status(200).json({ success: true, data: question });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const question = await CodingQuestion.findByIdAndDelete(req.params.id);
    if (!question) return res.status(404).json({ success: false, error: 'Question not found' });
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Candidate Command (get 3 random questions)
exports.getRoundQuestions = async (req, res) => {
  try {
    const questions = await CodingQuestion.aggregate([
      { $match: { isActive: true } },
      { $sample: { size: 3 } }
    ]);

    // Format questions so hidden test cases are stripped of expectedOutput, protecting them from candidates
    const formattedQuestions = questions.map(q => {
      return {
        _id: q._id,
        title: q.title,
        description: q.description,
        difficulty: q.difficulty,
        constraints: q.constraints,
        // Only return visible test cases to the candidate (to act as examples)
        testCases: q.testCases.filter(t => !t.isHidden).map(t => ({
          input: t.input,
          expectedOutput: t.expectedOutput
        }))
      };
    });

    res.status(200).json({ success: true, data: formattedQuestions });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
