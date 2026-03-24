const multer = require('multer');
const xlsx = require('xlsx');
const MCQ = require('../models/MCQ');
const Job = require('../models/Job');
const fs = require('fs');
const path = require('path');

// Configure multer for temp Excel upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'temp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `mcq-${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

exports.uploadMiddleware = upload.single('file');

// @desc    Upload Excel file containing MCQs for a specific job
// @route   POST /api/mcq/upload/:jobId
// @access  Private (Admin only)
exports.uploadMCQs = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload an Excel file' });
    }

    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Parse Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Excel file is empty' });
    }

    // Process and validate rows
    const mcqsToInsert = [];
    const errors = [];

    data.forEach((row, index) => {
      const question = row['Question'] || row['question'];
      const optA = row['Option A'] || row['A'] || row['optionA'];
      const optB = row['Option B'] || row['B'] || row['optionB'];
      const optC = row['Option C'] || row['C'] || row['optionC'];
      const optD = row['Option D'] || row['D'] || row['optionD'];
      const correct = row['Correct Answer'] || row['Answer'] || row['correct'];
      let difficulty = row['Difficulty'] || row['difficulty'] || 'medium';

      difficulty = difficulty.toLowerCase();
      if (!['easy', 'medium', 'hard'].includes(difficulty)) difficulty = 'medium';

      if (!question || !optA || !optB || !correct) {
        errors.push(`Row ${index + 2}: Missing required fields (Question, Options A/B, or Correct Answer).`);
        return;
      }

      // Build options array (ignoring empty ones if e.g. only A, B, C provided)
      const options = [optA, optB];
      if (optC) options.push(optC);
      if (optD) options.push(optD);

      mcqsToInsert.push({
        jobId,
        question: question.trim(),
        options: options.map(o => String(o).trim()),
        correctAnswer: String(correct).trim(),
        difficulty,
      });
    });

    if (mcqsToInsert.length > 0) {
      // Clear existing MCQs for this job to replace them (or we could append)
      // For this implementation, let's append. If we need replace, we would deleteMany({ jobId }) first.
      await MCQ.insertMany(mcqsToInsert);
    }

    // Cleanup temp file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: `Successfully uploaded ${mcqsToInsert.length} questions.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get randomized MCQs for a candidate taking a test (hides correct answer)
// @route   GET /api/mcq/test/:jobId
// @access  Private (Candidate)
exports.getTestMCQs = async (req, res) => {
  try {
    const { jobId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    // Aggregate query to get random documents
    const questions = await MCQ.aggregate([
      { $match: { jobId: new require('mongoose').Types.ObjectId(jobId) } },
      { $sample: { size: limit } }, // Randomize
      { $project: { correctAnswer: 0, createdAt: 0, updatedAt: 0, __v: 0 } }, // Hide sensitive info
    ]);

    // Shuffle options for each question (Bonus feature)
    questions.forEach(q => {
      q.options = q.options.sort(() => Math.random() - 0.5);
    });

    res.status(200).json({ success: true, count: questions.length, data: questions });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to fetch test questions' });
  }
};
