import { useState, useEffect, useRef, useCallback } from 'react';

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
const useTabProctor = ({ maxViolations = 3, onViolation, onAutoSubmit, enabled = true } = {}) => {
  const [violationCount, setViolationCount] = useState(0);

  // Use a ref so the trigger callback never goes stale regardless of re-renders
  const stateRef = useRef({ count: 0, done: false });
  const onViolationRef  = useRef(onViolation);
  const onAutoSubmitRef = useRef(onAutoSubmit);

  // Keep refs in sync with latest props on every render
  useEffect(() => { onViolationRef.current  = onViolation;  });
  useEffect(() => { onAutoSubmitRef.current = onAutoSubmit; });

  const trigger = useCallback(() => {
    if (!enabled || stateRef.current.done) return;
    stateRef.current.count += 1;
    const count = stateRef.current.count;
    setViolationCount(count);
    onViolationRef.current?.(count, maxViolations);
    if (count >= maxViolations) {
      stateRef.current.done = true;
      // Small delay so the final warning toast is visible before submit fires
      setTimeout(() => onAutoSubmitRef.current?.(), 2500);
    }
  }, [enabled, maxViolations]);

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
