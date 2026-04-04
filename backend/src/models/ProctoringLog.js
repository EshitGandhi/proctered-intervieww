const mongoose = require('mongoose');

const proctoringLogSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
      // Format: "mcq-{appId}" or "coding-{appId}"
    },
    eventType: {
      type: String,
      required: true,
      // tab_switch, no_face_detected, multiple_faces, face_look_away,
      // camera_blocked, face_reference_captured
    },
    description: {
      type: String,
      default: '',
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'high',
    },
    screenshot: {
      type: String,  // base64 image data URL
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProctoringLog', proctoringLogSchema);
