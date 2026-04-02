const mongoose = require('mongoose');

const proctoringLogSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    candidateSocketId: {
      type: String,
      default: null,
    },
    eventType: {
      type: String,
      enum: [
        'tab_switch',
        'window_blur',
        'window_focus',
        'copy_attempt',
        'paste_attempt',
        'cut_attempt',
        'right_click',
        'keyboard_shortcut',
        'fullscreen_exit',
        'devtools_open',
        'multiple_screens',
        'session_start',
        'session_end',
        'warning_issued',
        // ── Face detection events ──────────────────────────────────────────
        'no_face_detected',
        'multiple_faces',
        'face_look_away',
        'camera_blocked',
        'face_reference_captured',
        'other',
      ],
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model('ProctoringLog', proctoringLogSchema);
