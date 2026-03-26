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
  // --- Camera recording state ---
  const [recording, setRecording] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false); // Track total uploading status
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
      if (type === 'screen') setScreenUploaded(true);
    } catch (err) {
      console.error(`Upload failed for ${type}:`, err.message);
      setUploadError(err.message);
    } finally {
      // In a real app we'd wait for all concurrent uploads to finish
      // but if we are only stopping once, this is okay for a simple flag
      setIsUploading(false);
    }
  }, [interviewId]);

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
      console.log('Camera recorder stopped, uploading...');
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      await performUpload(blob, 'video');
    };
    mr.start(1000);
    mediaRecorderRef.current = mr;
    setRecording(true);
  }, [stream, recording, performUpload]);

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
        
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const dest = audioContext.createMediaStreamDestination();
        let hasAudio = false;

        if (stream && stream.getAudioTracks().length > 0) {
          const micSource = audioContext.createMediaStreamSource(stream);
          micSource.connect(dest);
          hasAudio = true;
        }

        if (remoteStream) {
          const connectRemote = () => {
            if (remoteStream.getAudioTracks().length > 0) {
              try {
                const remoteSource = audioContext.createMediaStreamSource(remoteStream);
                remoteSource.connect(dest);
              } catch (e) {
                console.warn('Failed to connect remote audio source:', e);
              }
            }
          };
          connectRemote();
          remoteStream.onaddtrack = connectRemote;
          hasAudio = true; 
        }

        if (screenStream?.getAudioTracks().length > 0) {
          const screenAudioSource = audioContext.createMediaStreamSource(screenStream);
          screenAudioSource.connect(dest);
          hasAudio = true;
        }

        if (hasAudio) {
          const tracks = [
            ...screenStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
          ];
          finalStream = new MediaStream(tracks);
        }
      } catch (err) {
        console.warn('Audio mixing failed, falling back:', err);
        const fallbackAudio = stream?.getAudioTracks() || [];
        const srAudio = screenStream?.getAudioTracks() || [];
        const selectedAudio = srAudio.length > 0 ? srAudio : fallbackAudio;
        finalStream = new MediaStream([ ...screenStream.getVideoTracks(), ...selectedAudio ]);
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
        console.log('Screen recorder stopped, uploading...');
        const blob = new Blob(screenChunksRef.current, { type: 'video/webm' });
        await performUpload(blob, 'screen');
        
        // Handle transcript separately as it's a text blob
        const text = transcriptRef.current.trim();
        if (text) {
          const tBlob = new Blob([text], { type: 'text/plain' });
          await performUpload(tBlob, 'transcript');
        }

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
      startTranscription();
    } catch (err) {
      console.error('Screen capture error:', err);
    }
  }, [screenRecording, stream, remoteStream, performUpload]);

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

  useEffect(() => () => {
    stopRecording();
    stopScreenCapture();
  }, []);

  return {
    recording, uploaded, uploadError, isUploading, startRecording, stopRecording,
    screenRecording, screenUploaded, startScreenCapture, stopScreenCapture,
    transcript, transcribing
  };
};

export default useRecorder;
