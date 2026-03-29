const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      unique: true,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    interviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    communication: {
      verbal: {
        type: String,
        enum: ['Poor', 'Good', 'Best', 'Excellent'],
        required: true,
      },
      confidence: {
        type: String,
        enum: ['Poor', 'Good', 'Best', 'Excellent'],
        required: true,
      },
    },
    technicalSkills: [
      {
        skill: { type: String, required: true },
        rating: {
          type: String,
          enum: ['Poor', 'Good', 'Best', 'Excellent'],
          required: true,
        },
      },
    ],
    improvementFeedback: {
      type: String,
      required: true,
      trim: true,
    },
    recommendation: {
      type: String,
      enum: ['Hire', 'No Hire'],
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
