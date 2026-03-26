import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * useRecorder — handles:
 *  1. Camera/mic stream recording (WebRTC stream) → uploads as `video`
 *  2. Screen recording (getDisplayMedia) with MIXED audio (Mic + System) → uploads as `screen`
 *  3. Live speech transcription (SpeechRecognition) → uploads as `transcript` (.txt)
 *
 * NOTE: For best accuracy, we now mix local + remote audio for the recording.
 */
const useRecorder = ({ interviewId, stream, remoteStream }) => {
  // --- Recording state ---
  const [recording, setRecording] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const mixedStreamRef = useRef(null);

  // Hidden video elements for canvas composition
  const localVideoRef = useRef(document.createElement('video'));
  const remoteVideoRef = useRef(document.createElement('video'));

  // --- Transcription state ---
  const [transcript, setTranscript] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');

  // ─── Shared Uploader helper ────────────────────────────────────────────────
  const performUpload = useCallback(async (blob, type = 'video') => {
    if (!interviewId || blob.size === 0) {
      console.warn(`Skip upload: interviewId=${interviewId}, blobSize=${blob.size}`);
      return;
    }
    
    setIsUploading(true);
    const formData = new FormData();
    const ext = type === 'transcript' ? 'txt' : 'webm';
    formData.append('interviewId', interviewId);
    formData.append('type', type);
    formData.append('recording', blob, `session-${type}-${Date.now()}.${ext}`);

    try {
      console.log(`Uploading ${type}...`);
      await api.post('/recordings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log(`Upload successful: ${type}`);
      if (type === 'video') setUploaded(true);
    } catch (err) {
      console.error(`Upload failed for ${type}:`, err.message);
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  }, [interviewId]);

  // ─── WebRTC Compositor & Recorder ──────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (recording || !stream || !remoteStream) {
      console.warn('Cannot start recording: missing stream, remoteStream, or already recording.');
      return;
    }

    try {
      console.log('--- Initializing Multi-Stream Recording ---');
      
      // 1. Setup Audio Mixing
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const dest = audioContext.createMediaStreamDestination();

      if (stream.getAudioTracks().length > 0) {
        const localSource = audioContext.createMediaStreamSource(stream);
        localSource.connect(dest);
      }
      if (remoteStream.getAudioTracks().length > 0) {
        const remoteSource = audioContext.createMediaStreamSource(remoteStream);
        remoteSource.connect(dest);
      }

      // 2. Setup Video Composition via Canvas
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');

      // Setup hidden video elements to provide frames
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(e => console.warn('Local video play delay:', e));

      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.muted = true;
      remoteVideoRef.current.play().catch(e => console.warn('Remote video play delay:', e));

      const drawFrame = () => {
        // Clear background
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Local Video (Left Half)
        ctx.drawImage(localVideoRef.current, 0, 0, 640, 720);
        
        // Draw Remote Video (Right Half)
        ctx.drawImage(remoteVideoRef.current, 640, 0, 640, 720);

        // Overlay participants name if needed (optional polish)
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(10, 680, 150, 30);
        ctx.fillRect(650, 680, 150, 30);
        ctx.fillStyle = 'white';
        ctx.font = '16px Inter, sans-serif';
        ctx.fillText('Candidate', 20, 700);
        ctx.fillText('Interviewer', 660, 700);

        animationFrameRef.current = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      // 3. Create Combined Stream
      const canvasStream = canvas.captureStream(30);
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ];
      const finalStream = new MediaStream(combinedTracks);
      mixedStreamRef.current = finalStream;

      // 4. Initialize MediaRecorder
      chunksRef.current = [];
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      let mr;
      try {
        mr = new MediaRecorder(finalStream, options);
      } catch {
        mr = new MediaRecorder(finalStream);
      }

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        console.log('Recording stopped, processing upload...');
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        await performUpload(blob, 'video');
        
        const text = transcriptRef.current.trim();
        if (text) {
          const tBlob = new Blob([text], { type: 'text/plain' });
          await performUpload(tBlob, 'transcript');
        }

        // Cleanup
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
        localVideoRef.current.srcObject = null;
        remoteVideoRef.current.srcObject = null;
      };

      mr.start(1000);
      mediaRecorderRef.current = mr;
      setRecording(true);
      startTranscription();

    } catch (err) {
      console.error('Failed to start multi-stream recording:', err);
      setUploadError(`Recording failed: ${err.message}`);
    }
  }, [recording, stream, remoteStream, performUpload]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    stopTranscription();
    setRecording(false);
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
        if (res.isFinal) finalTranscript += res[0].transcript + ' ';
        else interimText += res[0].transcript;
      }
      const combined = (finalTranscript + interimText).trim();
      setTranscript(combined);
      transcriptRef.current = combined;
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') console.warn('Transcription error:', e.error);
    };

    recognition.onend = () => {
      if (mediaRecorderRef.current?.state === 'recording') {
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

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  return {
    recording, uploaded, uploadError, isUploading, startRecording, stopRecording,
    transcript, transcribing
  };
};


export default useRecorder;
