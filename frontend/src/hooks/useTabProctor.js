import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * useTabProctor
 * Detects tab-switching / window-blur and fires violation callbacks.
 *
 * @param {object}   opts
 * @param {number}   opts.maxViolations  – violations before auto-submit (default 3)
 * @param {Function} opts.onViolation    – (count, max) => void, fired on each detection
 * @param {Function} opts.onAutoSubmit   – () => void, fired 2.5 s after final violation
 * @param {boolean}  opts.enabled        – set false during loading / after result
 */
const useTabProctor = ({ maxViolations = 3, onViolation, onAutoSubmit, enabled = true, sessionId = '' } = {}) => {
  const [violationCount, setViolationCount] = useState(0);

  // Use a ref so the trigger callback never goes stale regardless of re-renders
  const stateRef = useRef({ count: 0, done: false });
  const onViolationRef  = useRef(onViolation);
  const onAutoSubmitRef = useRef(onAutoSubmit);

  // Keep refs in sync with latest props on every render
  useEffect(() => { onViolationRef.current  = onViolation;  });
  useEffect(() => { onAutoSubmitRef.current = onAutoSubmit; });

  const logToBackend = useCallback((eventType, description) => {
    api.post('/proctoring/log', {
      sessionId: sessionId || 'tab-proctor',
      eventType,
      description,
      severity: 'high',
      metadata: { timestamp: new Date().toISOString() },
    }).catch(() => {});
  }, [sessionId]);

  const lastTriggerRef = useRef(0);

  const trigger = useCallback(() => {
    if (!enabled || stateRef.current.done) return;

    // Debounce to prevent double-counting when blur and visibilitychange fire sequentially
    const now = Date.now();
    if (now - lastTriggerRef.current < 2000) return;
    lastTriggerRef.current = now;

    stateRef.current.count += 1;
    const count = stateRef.current.count;
    setViolationCount(count);

    logToBackend('tab_switch', `Tab switch or window blur detected (Violation ${count}/${maxViolations})`);

    onViolationRef.current?.(count, maxViolations);
    if (count >= maxViolations) {
      stateRef.current.done = true;
      // Small delay so the final warning toast is visible before submit fires
      setTimeout(() => onAutoSubmitRef.current?.(), 2500);
    }
  }, [enabled, maxViolations, logToBackend]);

  useEffect(() => {
    if (!enabled) return;
    const onVisChange = () => { if (document.hidden) trigger(); };
    const onBlur      = () => trigger();
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled, trigger]);

  return { violationCount };
};

export default useTabProctor;
