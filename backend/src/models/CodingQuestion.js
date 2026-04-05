const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, default: false },
});

const templateSchema = new mongoose.Schema({
  language: { type: String, required: true },
  starterCode: { type: String, default: '' },
  driverCode: { type: String, default: '' },
});

// Per-language code maps (flattened for easy access)
const langCodeSchema = new mongoose.Schema({
  cpp:        { type: String, default: '' },
  c:          { type: String, default: '' },
  java:       { type: String, default: '' },
  javascript: { type: String, default: '' },
  python:     { type: String, default: '' },
  php:        { type: String, default: '' },
}, { _id: false });

const codingQuestionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide question title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide question description'],
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },

    // ─── Signature & Mode ──────────────────────────────────────────────────
    signature: {
      type: String,
      default: '',
    },
    parsedSignature: {
      type: mongoose.Schema.Types.Mixed, // { returnType, functionName, params }
      default: null,
    },
    mode: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'manual',
    },

    // ─── Code per language (flat maps) ────────────────────────────────────
    starterCode: {
      type: langCodeSchema,
      default: () => ({}),
    },
    driverCode: {
      type: langCodeSchema,
      default: () => ({}),
    },

    // ─── Supported languages ──────────────────────────────────────────────
    supportedLanguages: {
      type: [String],
      default: ['cpp', 'c', 'java', 'javascript', 'python', 'php'],
    },

    // ─── Legacy: keep templates array for backward compatibility ──────────
    templates: [templateSchema],

    testCases: [testCaseSchema],
    constraints: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
