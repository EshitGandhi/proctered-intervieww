import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';

/**
 * useFaceProctor
 * ──────────────
 * Uses MediaPipe FaceDetector to continuously monitor a webcam feed.
 * Detects: no face, multiple faces, face looking away, camera blocked.
 * 
 * Includes:
 * - 5 sec Cooldown: Avoid Rapid double-logging
 * - Look-away Debounce: 2s threshold before logging
 * - Screenshot Capture: Canvas snapshot on violation
 */
const useFaceProctor = ({
  videoRef,
  enabled = true,
  maxViolations = 3,
  sessionId = '',
  onViolation,
  onAutoSubmit,
} = {}) => {
  const [faceViolationCount, setFaceViolationCount] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Internal mutable state
  const stateRef = useRef({ count: 0, done: false });
  const detectorRef = useRef(null);
  const loopRef = useRef(null);
  const lastDetectRef = useRef(0);
  const lastViolationTimeRef = useRef(0); // For 5s cooldown
  const lookAwayStartRef = useRef(null);

  const onViolationRef = useRef(onViolation);
  const onAutoSubmitRef = useRef(onAutoSubmit);

  useEffect(() => { onViolationRef.current = onViolation; });
  useEffect(() => { onAutoSubmitRef.current = onAutoSubmit; });

  // ── Helper: Capture Screenshot ──────────────────────────────────────────────
  const captureScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.6); // compressed jpeg
    } catch (err) {
      return null;
    }
  }, [videoRef]);

  // ── Log violation to backend (fire-and-forget) ──────────────────────────────
  const logToBackend = useCallback((eventType, description, severity) => {
    const screenshot = captureScreenshot();
    api.post('/proctoring/log', {
      sessionId: sessionId || 'face-proctor',
      eventType,
      description,
      severity: severity || 'high',
      screenshot,
      metadata: { timestamp: new Date().toISOString(), roundType: sessionId },
    }).catch(() => {});
  }, [sessionId, captureScreenshot]);

  // ── Trigger a face violation ────────────────────────────────────────────────
  const triggerViolation = useCallback((type, description) => {
    if (!enabled || stateRef.current.done) return;

    // ── 5 Second Cooldown Check ──
    const now = Date.now();
    if (now - lastViolationTimeRef.current < 5000) return;
    lastViolationTimeRef.current = now;

    stateRef.current.count += 1;
    const count = stateRef.current.count;
    setFaceViolationCount(count);
    onViolationRef.current?.(count, maxViolations, type, description);
    logToBackend(type, description, type === 'face_look_away' ? 'medium' : 'high');

    if (count >= maxViolations) {
      stateRef.current.done = true;
      setTimeout(() => onAutoSubmitRef.current?.(), 2500);
    }
  }, [enabled, maxViolations, logToBackend]);

  // ── Initialise MediaPipe FaceDetector ───────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const initDetector = async () => {
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
          minSuppressionThreshold: 0.3,
        });
        if (cancelled) { detector.close(); return; }
        detectorRef.current = detector;
        setIsMonitoring(true);
      } catch (err) {
        console.warn('[useFaceProctor] MediaPipe init failed:', err);
      }
    };
    initDetector();
    return () => {
      cancelled = true;
      if (detectorRef.current) {
        try { detectorRef.current.close(); } catch (_) { }
        detectorRef.current = null;
      }
      setIsMonitoring(false);
    };
  }, [enabled]);

  // ── Detection loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !isMonitoring) return;
    const INTERVAL_MS = 2000;
    const detect = (timestamp) => {
      loopRef.current = requestAnimationFrame(detect);
      if (timestamp - lastDetectRef.current < INTERVAL_MS) return;
      lastDetectRef.current = timestamp;

      const video = videoRef?.current;
      const detector = detectorRef.current;
      if (!detector || !video || video.readyState < 2) return;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        triggerViolation('camera_blocked', 'Camera stream appears blocked or unavailable.');
        return;
      }

      let result;
      try {
        result = detector.detectForVideo(video, timestamp);
      } catch (e) { return; }

      const detections = result?.detections ?? [];

      if (detections.length === 0) {
        triggerViolation('no_face_detected', 'No face detected. Please stay in front of the camera.');
        return;
      }

      if (detections.length > 1) {
        triggerViolation('multiple_faces', `${detections.length} faces detected. Only you should be visible.`);
        return;
      }

      const detection = detections[0];
      const box = detection.boundingBox;

      if (box) {
        const centerX = (box.originX + box.width / 2) / video.videoWidth;
        const centerY = (box.originY + box.height / 2) / video.videoHeight;

        if (centerX < 0.1 || centerX > 0.9 || centerY < 0.1 || centerY > 0.9) {
          if (!lookAwayStartRef.current) lookAwayStartRef.current = Date.now();
          if (Date.now() - lookAwayStartRef.current > 2000) {
            triggerViolation('face_look_away', 'You appear to be looking away from the screen.');
          }
        } else {
          lookAwayStartRef.current = null;
        }
      }

      const kp = detection.keypoints;
      if (kp && kp.length >= 3) {
        const rightEye = kp[0], leftEye = kp[1], noseTip = kp[2];
        if (rightEye?.x != null && leftEye?.x != null && noseTip?.x != null) {
          const dist1 = Math.abs(noseTip.x - rightEye.x);
          const dist2 = Math.abs(noseTip.x - leftEye.x);
          const ratio = Math.max(dist1, dist2) / (Math.min(dist1, dist2) || 0.0001);
          if (ratio > 2.4) {
            if (!lookAwayStartRef.current) lookAwayStartRef.current = Date.now();
            if (Date.now() - lookAwayStartRef.current > 2000) {
              triggerViolation('face_look_away', 'You appear to be looking away from the screen.');
            }
          }
        }
      }
    };
    loopRef.current = requestAnimationFrame(detect);
    return () => { if (loopRef.current) cancelAnimationFrame(loopRef.current); };
  }, [enabled, isMonitoring, triggerViolation, videoRef]);

  useEffect(() => {
    if (!enabled) {
      stateRef.current = { count: 0, done: false };
      setFaceViolationCount(0);
      setIsMonitoring(false);
    }
  }, [enabled]);

  return { faceViolationCount, isMonitoring };
};

export default useFaceProctor;
