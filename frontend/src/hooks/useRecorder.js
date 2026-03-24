import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * useRecorder — handles:
 *  1. Camera/mic stream recording (WebRTC stream) → uploads as `video`
 *  2. Screen recording (getDisplayMedia) with audio → uploads as `screen`
 *  3. Live speech transcription (SpeechRecognition) → uploads as `transcript` (.txt)
 */
const useRecorder = ({ interviewId, stream }) => {
  // --- Camera recording state ---
  const [recording, setRecording] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // --- Screen recording state ---
  const [screenRecording, setScreenRecording] = useState(false);
  const [screenUploaded, setScreenUploaded] = useState(false);
  const screenMediaRecorderRef = useRef(null);
  const screenChunksRef = useRef([]);
  const screenStreamRef = useRef(null);

  // --- Transcription state ---
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef(''); // always up-to-date copy for upload on stop

  // ─── Camera/mic recording ──────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!stream || recording) return;
    chunksRef.current = [];

    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    let mr;
    try {
      mr = new MediaRecorder(stream, options);
    } catch {
      mr = new MediaRecorder(stream);
    }

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'video/webm' });
      await uploadRecording(blob, 'video');
    };

    mr.start(1000);
    mediaRecorderRef.current = mr;
    setRecording(true);
  }, [stream, recording, interviewId]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    setRecording(false);
  }, []);

  // ─── Screen capture + transcription ───────────────────────────────────────
  const startScreenCapture = useCallback(async () => {
    if (screenRecording) return;

    try {
      // Request screen + audio
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15, displaySurface: 'monitor' },
        audio: true,
      });

      screenStreamRef.current = screenStream;
      screenChunksRef.current = [];

      // Screen MediaRecorder
      const opts = { mimeType: 'video/webm;codecs=vp9,opus' };
      let smr;
      try {
        smr = new MediaRecorder(screenStream, opts);
      } catch {
        smr = new MediaRecorder(screenStream);
      }

      smr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) screenChunksRef.current.push(e.data);
      };

      smr.onstop = async () => {
        const blob = new Blob(screenChunksRef.current, { type: smr.mimeType || 'video/webm' });
        await uploadRecording(blob, 'screen');

        // Upload transcript after screen recording stops
        await uploadTranscript();

        // Stop all screen stream tracks
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        setScreenRecording(false);
      };

      // Handle user stopping share via browser UI (e.g. "Stop sharing" button)
      screenStream.getVideoTracks()[0].onended = () => {
        if (smr.state !== 'inactive') smr.stop();
      };

      smr.start(1000);
      screenMediaRecorderRef.current = smr;
      setScreenRecording(true);

      // Start speech recognition transcription
      startTranscription();
    } catch (err) {
      console.error('Screen capture error:', err);
      // Don't hard-fail — the interview can continue without screen recording
    }
  }, [screenRecording, interviewId]);

  const stopScreenCapture = useCallback(() => {
    stopTranscription();
    if (screenMediaRecorderRef.current?.state !== 'inactive') {
      screenMediaRecorderRef.current?.stop();
    }
  }, []);

  // ─── SpeechRecognition transcription ──────────────────────────────────────
  const startTranscription = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalTranscript += res[0].transcript + ' ';
        } else {
          interimText += res[0].transcript;
        }
      }
      const combined = finalTranscript + interimText;
      setTranscript(combined);
      transcriptRef.current = combined;
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error:', e.error);
    };

    // Auto-restart on end (continuous mode stops on long silences in some browsers)
    recognition.onend = () => {
      if (recognitionRef.current === recognition && screenMediaRecorderRef.current?.state === 'recording') {
        recognition.start();
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setTranscribing(true);
  }, []);

  const stopTranscription = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setTranscribing(false);
  }, []);

  // ─── Upload helpers ────────────────────────────────────────────────────────
  const uploadRecording = async (blob, type = 'video') => {
    if (!interviewId) return;
    const ext = blob.type.includes('audio') ? 'webm' : 'webm';
    const formData = new FormData();
    formData.append('recording', blob, `session-${type}-${Date.now()}.${ext}`);
    formData.append('interviewId', interviewId);
    formData.append('type', type);

    try {
      await api.post('/recordings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (type === 'video') setUploaded(true);
      if (type === 'screen') setScreenUploaded(true);
    } catch (err) {
      setUploadError(err.message);
    }
  };

  const uploadTranscript = async () => {
    const text = transcriptRef.current.trim();
    if (!interviewId || !text) return;

    const blob = new Blob([text], { type: 'text/plain' });
    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    formData.append('recording', blob, `transcript-${timestamp}.txt`);
    formData.append('interviewId', interviewId);
    formData.append('type', 'transcript');

    try {
      await api.post('/recordings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      console.error('Transcript upload failed:', err.message);
    }
  };

  // Cleanup on unmount
  useEffect(() => () => {
    stopRecording();
    stopScreenCapture();
  }, []);

  return {
    // Camera recording
    recording,
    uploaded,
    uploadError,
    startRecording,
    stopRecording,
    // Screen recording
    screenRecording,
    screenUploaded,
    startScreenCapture,
    stopScreenCapture,
    // Transcription
    transcript,
    transcribing,
  };
};

export default useRecorder;
