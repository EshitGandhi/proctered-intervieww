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
    analysis: {
      sentiment: { type: String },
      confidence_level: { type: String },
      strengths: [String],
      weaknesses: [String],
    },
    recommendation: {
      decision: { type: String },
      reason: { type: String },
      risk_level: { type: String },
    },
    insights: {
      candidate_summary: { type: String },
      improvement_suggestions: [String],
    },
    transcript: { type: String },
    pdfPath: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
