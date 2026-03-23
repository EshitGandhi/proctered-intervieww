const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ['video', 'audio', 'screen'],
      default: 'video',
    },
    storageType: {
      type: String,
      enum: ['local', 's3'],
      default: 'local',
    },
    // Local storage
    filePath: {
      type: String,
      default: null,
    },
    fileName: {
      type: String,
      default: null,
    },
    // S3 storage
    s3Key: {
      type: String,
      default: null,
    },
    s3Url: {
      type: String,
      default: null,
    },
    mimeType: {
      type: String,
      default: 'video/webm',
    },
    fileSize: {
      type: Number, // bytes
      default: 0,
    },
    duration: {
      type: Number, // seconds
      default: 0,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recording', recordingSchema);
