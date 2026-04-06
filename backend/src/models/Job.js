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
    codingWeight: { type: Number, default: 60 },
    // Test Configurations
    mcqCount: { type: Number, default: 20 },
    mcqDuration: { type: Number, default: 30 }, // Minutes for MCQ Round
    codingCount: { type: Number, default: 3 },
    codingDuration: { type: Number, default: 60 }, // Minutes for Coding Round
  },
  { timestamps: true }
);

// Ensure the sum of weights is 100 before saving
jobSchema.pre('save', async function () {
  const total = (this.resumeWeight || 0) + (this.mcqWeight || 0) + (this.codingWeight || 0);
  if (total !== 100) {
    throw new Error(`Weights must sum up to 100. (Current: ${total})`);
  }
});

module.exports = mongoose.model('Job', jobSchema);
