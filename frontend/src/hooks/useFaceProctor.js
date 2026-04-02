import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';

/**
 * useFaceProctor
 * ──────────────
 * Uses MediaPipe FaceDetector to continuously monitor a webcam feed.
 * Detects: no face, multiple faces, face looking away, camera blocked.
 *
 * @param {object}   opts
 * @param {React.RefObject} opts.videoRef      – ref to a <video> element playing the webcam stream
 * @param {boolean}  opts.enabled              – pause detection when false (loading, result screen)
 * @param {number}   opts.maxViolations        – violations before onAutoSubmit fires (default 3)
 * @param {string}   opts.sessionId            – used when logging to backend
 * @param {Function} opts.onViolation          – (count, max, type, description) => void
 * @param {Function} opts.onAutoSubmit         – () => void, fired 2.5 s after final violation
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
  const [isMonitoring, setIsMonitoring]             = useState(false);

  // Internal mutable state — never cause re-renders
  const stateRef       = useRef({ count: 0, done: false });
  const detectorRef    = useRef(null);
  const loopRef        = useRef(null);
  const lastDetectRef  = useRef(0);
  const onViolationRef = useRef(onViolation);
  const onAutoSubmitRef= useRef(onAutoSubmit);

  // Keep callback refs fresh
  useEffect(() => { onViolationRef.current  = onViolation;  });
  useEffect(() => { onAutoSubmitRef.current = onAutoSubmit; });

  // ── Log violation to backend (fire-and-forget) ──────────────────────────────
  const logToBackend = useCallback((eventType, description, severity) => {
    api.post('/proctoring/log', {
      sessionId: sessionId || 'face-proctor',
      eventType,
      description,
      severity: severity || 'high',
      metadata: { timestamp: new Date().toISOString(), roundType: sessionId },
    }).catch(() => { /* silent fail — don't interrupt the test */ });
  }, [sessionId]);

  // ── Trigger a face violation ────────────────────────────────────────────────
  const triggerViolation = useCallback((type, description) => {
    if (!enabled || stateRef.current.done) return;
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
        // Dynamic import — only loaded when proctoring actually starts
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
        try { detectorRef.current.close(); } catch (_) {}
        detectorRef.current = null;
      }
      setIsMonitoring(false);
    };
  }, [enabled]);

  // ── Detection loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !isMonitoring) return;

    const INTERVAL_MS   = 2000; // detect every 2 s
    const YAW_THRESHOLD = 0.08; // fraction of frame width — nose offset from eye midpoint (lowered for higher sensitivity)

    const detect = (timestamp) => {
      loopRef.current = requestAnimationFrame(detect);

      if (timestamp - lastDetectRef.current < INTERVAL_MS) return;
      lastDetectRef.current = timestamp;

      const video = videoRef?.current;
      const detector = detectorRef.current;
      if (!detector || !video || video.readyState < 2) return;

      // ── Check for black / blocked stream ─────────────────────────────────
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        triggerViolation('camera_blocked', 'Camera stream appears blocked or unavailable.');
        return;
      }

      // Run detection
      let result;
      try {
        result = detector.detectForVideo(video, timestamp);
      } catch (e) {
        return; // frame not ready — skip silently
      }

      const detections = result?.detections ?? [];

      if (detections.length === 0) {
        triggerViolation('no_face_detected', 'No face detected. Please stay in front of the camera.');
        return;
      }

      if (detections.length > 1) {
        triggerViolation('multiple_faces', `${detections.length} faces detected. Only you should be visible.`);
        return;
      }

      // ── Head-pose: check if looking away ─────────────────────────────────
      // keypoints order from BlazeFace: right_eye, left_eye, nose_tip, mouth_center, right_ear_tragion, left_ear_tragion
      const kp = detections[0]?.keypoints;
      if (kp && kp.length >= 3) {
        const rightEye = kp[0]; // {x, y} normalised
        const leftEye  = kp[1];
        const noseTip  = kp[2];

        const eyeMidX = (rightEye.x + leftEye.x) / 2;
        const noseOffset = Math.abs(noseTip.x - eyeMidX);

        if (noseOffset > YAW_THRESHOLD) {
          triggerViolation('face_look_away', 'You appear to be looking away from the screen.');
          return;
        }
      }
    };

    loopRef.current = requestAnimationFrame(detect);
    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [enabled, isMonitoring, triggerViolation, videoRef]);

  // ── Reset when disabled (e.g. after result screen) ─────────────────────────
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
