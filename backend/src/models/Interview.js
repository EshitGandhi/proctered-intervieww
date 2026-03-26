const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const interviewSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    description: {
      type: String,
      default: '',
    },
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    candidateName: {
      type: String,
      default: '',
    },
    candidateEmail: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // minutes
      default: 60,
    },
    questions: [
      {
        id: String,
        title: String,
        description: String,
        testCases: [{ input: String, expectedOutput: String }],
        order: Number,
      },
    ],
    settings: {
      allowCamera: { type: Boolean, default: true },
      allowMicrophone: { type: Boolean, default: true },
      enableProctoring: { type: Boolean, default: true },
      codeExecutionEnabled: { type: Boolean, default: true },
      fullscreenRequired: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Interview', interviewSchema);
