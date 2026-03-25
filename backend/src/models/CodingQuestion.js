const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, default: false }, // if false, candidate can see it as an example
});

const templateSchema = new mongoose.Schema({
  language: { type: String, required: true },
  starterCode: { type: String, required: true },
  driverCode: { type: String, required: true }
});

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
    testCases: [testCaseSchema],
    templates: [templateSchema],
    constraints: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);
