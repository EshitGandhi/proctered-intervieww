const mongoose = require('mongoose');

const codeSubmissionSchema = new mongoose.Schema(
  {
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    questionId: {
      type: String,
      default: null,
    },
    language: {
      type: String,
      enum: ['javascript', 'python', 'java', 'c', 'cpp'],
      required: true,
    },
    languageId: {
      type: Number, // Judge0 language ID
      required: true,
    },
    sourceCode: {
      type: String,
      required: true,
    },
    stdin: {
      type: String,
      default: '',
    },
    stdout: {
      type: String,
      default: '',
    },
    stderr: {
      type: String,
      default: '',
    },
    compileOutput: {
      type: String,
      default: '',
    },
    status: {
      type: String, // Accepted, Wrong Answer, Runtime Error, etc.
      default: 'pending',
    },
    time: {
      type: String, // execution time from Judge0
      default: null,
    },
    memory: {
      type: Number, // KB
      default: null,
    },
    isSubmission: {
      type: Boolean,
      default: false, // false = run, true = final submit
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CodeSubmission', codeSubmissionSchema);
