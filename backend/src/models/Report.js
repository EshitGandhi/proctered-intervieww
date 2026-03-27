const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: false, // Now optional for manual reports
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Now optional for manual reports
      index: true,
    },
    candidateName: {
      type: String,
      default: '', // Added for manual reports
    },
    candidateEmail: {
      type: String,
      default: '', // Added for manual reports
    },
    evaluation: {
      type: Object, // The raw JSON from HF API
      default: null,
    },
    pdfPath: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
