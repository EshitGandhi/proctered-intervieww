const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Recording = require('../models/Recording');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Transcribe an audio/video file using OpenAI Whisper.
 * @param {string} filePath - Path to the file (local or S3 URL)
 * @param {string} recordingId - ID of the recording document
 */
const transcribeFile = async (filePath, recordingId) => {
  try {
    const recording = await Recording.findById(recordingId);
    if (!recording) throw new Error('Recording not found');

    console.log(`Starting transcription for recording ${recordingId}: ${filePath}`);

    let fileToTranscribe;
    let isTempFile = false;

    if (filePath.startsWith('http')) {
      // Download from S3/URL to a temp file
      const response = await axios.get(filePath, { responseType: 'arraybuffer' });
      const tempPath = path.join(process.cwd(), 'uploads', 'temp', `transcribe-${Date.now()}.webm`);
      if (!fs.existsSync(path.dirname(tempPath))) fs.mkdirSync(path.dirname(tempPath), { recursive: true });
      fs.writeFileSync(tempPath, Buffer.from(response.data));
      fileToTranscribe = tempPath;
      isTempFile = true;
    } else {
      // Local file
      fileToTranscribe = path.resolve(process.cwd(), filePath.replace(/^\//, ''));
    }

    if (!fs.existsSync(fileToTranscribe)) {
      throw new Error(`File not found: ${fileToTranscribe}`);
    }

    // Call OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(fileToTranscribe),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    // Save transcript as a .txt file and update DB
    const transcriptText = transcription.text;
    const transcriptFileName = `transcript-${recordingId}-${Date.now()}.txt`;
    const transcriptPath = path.join('uploads', 'transcripts', transcriptFileName);
    const fullTranscriptPath = path.resolve(process.cwd(), transcriptPath);

    if (!fs.existsSync(path.dirname(fullTranscriptPath))) {
      fs.mkdirSync(path.dirname(fullTranscriptPath), { recursive: true });
    }
    fs.writeFileSync(fullTranscriptPath, transcriptText);

    // Create a new Recording entry for the transcript
    await Recording.create({
      interview: recording.interview,
      candidate: recording.candidate,
      type: 'transcript',
      storageType: 'local',
      filePath: `/${transcriptPath.replace(/\\/g, '/')}`,
      fileName: transcriptFileName,
      mimeType: 'text/plain',
      fileSize: Buffer.byteLength(transcriptText),
    });

    console.log(`Transcription completed for ${recordingId}`);

    // Cleanup temp file
    if (isTempFile && fs.existsSync(fileToTranscribe)) {
      fs.unlinkSync(fileToTranscribe);
    }

    return transcriptText;
  } catch (err) {
    console.error('Transcription error:', err.message);
    // Log error but don't crash
  }
};

module.exports = { transcribeFile };
