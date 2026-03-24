import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * useRecorder — handles:
 *  1. Camera/mic stream recording (WebRTC stream) → uploads as `video`
 *  2. Screen recording (getDisplayMedia) with MIXED audio (Mic + System) → uploads as `screen`
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
  const audioContextRef = useRef(null);

  // --- Transcription state ---
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');

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
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      await uploadRecording(blob, 'video');
    };
    mr.start(1000);
    mediaRecorderRef.current = mr;
    setRecording(true);
  }, [stream, recording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    setRecording(false);
  }, []);

  // ─── Screen capture + Composite Audio ──────────────────────────────────────
  const startScreenCapture = useCallback(async () => {
    if (screenRecording) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 20, displaySurface: 'monitor' },
        audio: true, // system audio
      });

      // MIXING AUDIO: Microphone (stream) + System Audio (screenStream)
      let finalStream = screenStream;
      
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        const dest = audioContext.createMediaStreamDestination();

        let hasAudio = false;

        // 1. Add Mic (from camera/mic stream)
        if (stream && stream.getAudioTracks().length > 0) {
          const micSource = audioContext.createMediaStreamSource(stream);
          micSource.connect(dest);
          hasAudio = true;
          console.log('Mixed: Microphone tracks added to screen recording');
        }

        // 2. Add System Audio (from screen share)
        if (screenStream.getAudioTracks().length > 0) {
          const screenAudioSource = audioContext.createMediaStreamSource(screenStream);
          screenAudioSource.connect(dest);
          hasAudio = true;
          console.log('Mixed: System audio tracks added to screen recording');
        }

        // 3. Create final stream
        if (hasAudio) {
          const tracks = [
            ...screenStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
          ];
          finalStream = new MediaStream(tracks);
        }
      } catch (err) {
        console.warn('Audio mixing failed, falling back to screen-only audio:', err);
      }

      screenStreamRef.current = screenStream;
      screenChunksRef.current = [];

      const opts = { mimeType: 'video/webm;codecs=vp9,opus' };
      let smr;
      try {
        smr = new MediaRecorder(finalStream, opts);
      } catch {
        smr = new MediaRecorder(finalStream);
      }

      smr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) screenChunksRef.current.push(e.data);
      };

      smr.onstop = async () => {
        const blob = new Blob(screenChunksRef.current, { type: 'video/webm' });
        await uploadRecording(blob, 'screen');
        await uploadTranscript(); // upload text file on completion

        // Clean up
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        setScreenRecording(false);
      };

      screenStream.getVideoTracks()[0].onended = () => {
        if (smr.state !== 'inactive') smr.stop();
      };

      smr.start(1000);
      screenMediaRecorderRef.current = smr;
      setScreenRecording(true);
      startTranscription(); // Start transcription loop
    } catch (err) {
      console.error('Screen capture error:', err);
    }
  }, [screenRecording, stream, interviewId]);

  const stopScreenCapture = useCallback(() => {
    stopTranscription();
    if (screenMediaRecorderRef.current?.state !== 'inactive') {
      screenMediaRecorderRef.current?.stop();
    }
  }, []);

  // ─── SpeechRecognition ─────────────────────────────────────────────────────
  const startTranscription = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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
      const combined = (finalTranscript + interimText).trim();
      setTranscript(combined);
      transcriptRef.current = combined;
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') console.warn('Transcription error:', e.error);
    };

    recognition.onend = () => {
      // Keep it running as long as we are recording
      if (screenMediaRecorderRef.current?.state === 'recording') {
        try { recognition.start(); } catch (e) {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setTranscribing(true);
    } catch (e) {
      console.error('Failed to start transcription:', e);
    }
  }, []);

  const stopTranscription = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setTranscribing(false);
  }, []);

  // ─── Uploaders ─────────────────────────────────────────────────────────────
  const uploadRecording = async (blob, type = 'video') => {
    if (!interviewId || blob.size === 0) return;
    const formData = new FormData();
    formData.append('recording', blob, `session-${type}-${Date.now()}.webm`);
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
    if (!interviewId || !text) {
      console.log('No transcript text to upload.');
      return;
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('recording', blob, `transcript-${Date.now()}.txt`);
    formData.append('interviewId', interviewId);
    formData.append('type', 'transcript');

    try {
      await api.post('/recordings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('Transcript uploaded successfully');
    } catch (err) {
      console.error('Transcript upload failed:', err.message);
    }
  };

  useEffect(() => () => {
    stopRecording();
    stopScreenCapture();
  }, []);

  return {
    recording, uploaded, uploadError, startRecording, stopRecording,
    screenRecording, screenUploaded, startScreenCapture, stopScreenCapture,
    transcript, transcribing
  };
};

export default useRecorder;
