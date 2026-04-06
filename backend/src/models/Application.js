const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'applied',
        'resume_rejected',
        'mcq_pending',
        'mcq_passed',
        'mcq_failed',
        'coding_pending',
        'coding_passed',
        'coding_failed',
        'hired',
        'rejected',
      ],
      default: 'applied',
    },
    scores: {
      resume: {
        score: { type: Number, default: 0 },
        matchedSkills: [String],
        missingSkills: [String],
        resumeUrl: String, // Path to parsed resume file
      },
      mcq: {
        score: { type: Number, default: 0 },
        answers: [
          {
            questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MCQ' },
            selectedOption: String,
            isCorrect: Boolean,
          },
        ],
      },
      coding: {
        score: { type: Number, default: 0 },
        questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion' }],
        startTime: { type: Date },
        answers: [{
          questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion' },
          language: String,
          code: String,
        }]
      },
      finalScore: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicate applications for the same job by the same user
applicationSchema.index({ jobId: 1, candidateId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
