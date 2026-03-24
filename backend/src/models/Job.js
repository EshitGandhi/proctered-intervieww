const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    domain: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Evaluation Thresholds
    resumeThreshold: {
      type: Number,
      default: 60, // Minimum % to pass ATS
    },
    mcqThreshold: {
      type: Number,
      default: 70, // Minimum % to pass MCQ round
    },
    codingThreshold: {
      type: Number,
      default: 50, // Minimum % to pass Coding round
    },
    // Evaluation Weights (for Final Score Calculation)
    resumeWeight: { type: Number, default: 20 },
    mcqWeight: { type: Number, default: 20 },
    codingWeight: { type: Number, default: 30 },
    interviewWeight: { type: Number, default: 30 },
    // Test Configurations
    mcqCount: { type: Number, default: 20 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Job', jobSchema);
