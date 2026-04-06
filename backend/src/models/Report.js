const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      required: true,
      index: true,
    },
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: { type: String, required: true },
    scores: {
      resume_score: { type: Number, default: 0 },
      coding_score: { type: Number, default: 0 },
      mcq_score: { type: Number, default: 0 },
      final_score: { type: Number, default: 0 },
    },
    evaluation: {
      summary: { type: String },
      resume_analysis: { type: String },
      mcq_analysis: { type: String },
      coding_analysis: { type: String },
    },
    strengths: [String],
    weaknesses: [String],
    violations_analysis: { type: String },
    performance_analysis: { type: String },
    recommendation: { type: String },
    confidence: { type: Number },
    transcript: { type: String },
    pdfPath: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
