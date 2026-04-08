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
    experience: { type: String, default: 'Not specified' },
    interview_date: { type: String, default: null },
    scores: {
      resume_score: { type: Number, default: 0 },
      coding_score: { type: Number, default: 0 },
      mcq_score: { type: Number, default: 0 },
      final_score: { type: Number, default: 0 },
    },
    // Retained for any legacy/display purposes; not populated by HF Space API
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
    job_description: { type: String },
    pdfPath: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
