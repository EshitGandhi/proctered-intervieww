import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * useRecorder — records a MediaStream, saves video + audio separately,
 * and uploads to the backend on stop.
 */
const useRecorder = ({ interviewId, stream }) => {
  const [recording, setRecording] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(() => {
    if (!stream || recording) return;
    chunksRef.current = [];

    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    let mr;
    try {
      mr = new MediaRecorder(stream, options);
    } catch {
      mr = new MediaRecorder(stream); // fallback
    }

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'video/webm' });
      await uploadRecording(blob, 'video');
    };

    mr.start(1000); // collect every 1 second
    mediaRecorderRef.current = mr;
    setRecording(true);
  }, [stream, recording, interviewId]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    setRecording(false);
  }, []);

  const uploadRecording = async (blob, type = 'video') => {
    if (!interviewId) return;
    const formData = new FormData();
    const ext = blob.type.includes('audio') ? 'webm' : 'webm';
    formData.append('recording', blob, `session-${type}-${Date.now()}.${ext}`);
    formData.append('interviewId', interviewId);
    formData.append('type', type);

    try {
      await api.post('/recordings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploaded(true);
    } catch (err) {
      setUploadError(err.message);
    }
  };

  useEffect(() => () => stopRecording(), []);

  return { recording, uploaded, uploadError, startRecording, stopRecording };
};

export default useRecorder;
