import { useEffect, useCallback, useRef, useState } from 'react';
import api from '../services/api';

const SEVERITY = {
  tab_switch: 'high',
  window_blur: 'medium',
  copy_attempt: 'high',
  paste_attempt: 'high',
  cut_attempt: 'medium',
  right_click: 'low',
  keyboard_shortcut: 'medium',
  fullscreen_exit: 'medium',
  devtools_open: 'high',
  multiple_screens: 'high',
};

const BLOCKED_KEYS = new Set([
  'c', 'v', 'x', 'a',   // copy, paste, cut, select-all (with ctrl/cmd)
  'u', 's', 'p',          // view-source, save, print
  'j', 'i', 'F12',        // devtools shortcuts
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11',
  'PrintScreen',
]);

/**
 * useProctoringMonitor
 * Monitors and logs cheating-related browser events.
 * IMPORTANT: Some restrictions (screenshots, extensions) cannot be fully blocked by browsers.
 */
const useProctoringMonitor = ({ interviewId, enabled = true, onViolation, socket, roomId }) => {
  const [violations, setViolations] = useState([]);
  const [warningVisible, setWarningVisible] = useState(false);
  const [lastViolation, setLastViolation] = useState(null);
  const [violationCount, setViolationCount] = useState(0);
  const devToolsRef = useRef(false);
  const skippedCountRef = useRef(0);
  const SKIP_THRESHOLD = 3;
  const prevHeight = useRef(window.outerHeight);

  const logViolation = useCallback(
    async (eventType, description = '', metadata = {}) => {
      const severity = SEVERITY[eventType] || 'medium';
      
      // Ignore first 3 violations (often triggered by permission dialogs)
      if (skippedCountRef.current < SKIP_THRESHOLD) {
        skippedCountRef.current += 1;
        console.log(`Ignoring initial violation (${skippedCountRef.current}/${SKIP_THRESHOLD}): ${eventType}`);
        return;
      }

      const violation = { eventType, description, severity, timestamp: new Date().toISOString(), metadata };

      setViolations((prev) => [violation, ...prev]);
      setLastViolation(violation);
      setWarningVisible(true);
      setViolationCount((c) => c + 1);

      onViolation?.(violation);

      // Emit to Socket.io for live interviewer feed
      if (socket?.current) {
        socket.current.emit('proctoring-violation', { roomId, ...violation });
      }

      // Persist to backend
      try {
        if (interviewId) {
          await api.post('/proctoring/log', { interviewId, sessionId: interviewId, eventType, description, metadata, severity });
        }
      } catch {
        // Non-fatal — violation already logged locally
      }
    },
    [interviewId, onViolation, socket, roomId]
  );

  const dismissWarning = () => setWarningVisible(false);

  useEffect(() => {
    if (!enabled) return;

    // ── Tab Switch / Visibility ────────────────────────────────────
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logViolation('tab_switch', 'Candidate switched to another tab or minimised window');
      }
    };

    // ── Window Blur / Focus Loss ───────────────────────────────────
    const handleBlur = () => {
      logViolation('window_blur', 'Interview window lost focus');
    };

    // ── Right Click ────────────────────────────────────────────────
    const handleContextMenu = (e) => {
      e.preventDefault();
      logViolation('right_click', 'Right-click attempted');
    };

    // ── Keyboard Shortcuts ─────────────────────────────────────────
    const handleKeydown = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key;

      // Allow F11 (fullscreen)
      if (key === 'F11') return;

      // Block F-keys and PrintScreen
      if (['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F12','PrintScreen'].includes(key)) {
        e.preventDefault();
        logViolation('keyboard_shortcut', `Blocked key: ${key}`, { key });
        return;
      }

      // Block devtools shortcuts
      if ((ctrl && shift && ['i','j','c'].includes(key.toLowerCase())) ||
          (ctrl && key.toLowerCase() === 'u')) {
        e.preventDefault();
        logViolation('keyboard_shortcut', `DevTools shortcut blocked: Ctrl+${shift ? 'Shift+' : ''}${key}`, { key });
        return;
      }

      // Block copy/paste (allow paste in code editor — handled by Monaco)
      if (ctrl && ['c','v','x'].includes(key.toLowerCase())) {
        // Don't block inside Monaco editor (it has its own context)
        const inEditor = e.target?.closest?.('.monaco-editor');
        if (!inEditor) {
          e.preventDefault();
          const map = { c: 'copy_attempt', v: 'paste_attempt', x: 'cut_attempt' };
          logViolation(map[key.toLowerCase()], `${key.toUpperCase()} shortcut blocked`, { key });
        }
      }
    };

    // ── Copy / Paste / Cut events ──────────────────────────────────
    const handleCopy = (e) => {
      const inEditor = e.target?.closest?.('.monaco-editor');
      if (!inEditor) { e.preventDefault(); logViolation('copy_attempt', 'Copy blocked outside editor'); }
    };
    const handlePaste = (e) => {
      const inEditor = e.target?.closest?.('.monaco-editor, input, textarea');
      if (!inEditor) { e.preventDefault(); logViolation('paste_attempt', 'Paste blocked'); }
    };
    const handleCut = (e) => {
      const inEditor = e.target?.closest?.('.monaco-editor');
      if (!inEditor) { e.preventDefault(); logViolation('cut_attempt', 'Cut blocked'); }
    };

    // ── Fullscreen Exit ────────────────────────────────────────────
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        logViolation('fullscreen_exit', 'Fullscreen mode exited');
      }
    };

    // ── DevTools Detection (window size heuristic) ─────────────────
    // NOTE: This is a best-effort heuristic, not foolproof
    const devtoolsInterval = setInterval(() => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const isOpen = widthDiff > threshold || heightDiff > threshold;

      if (isOpen && !devToolsRef.current) {
        devToolsRef.current = true;
        logViolation('devtools_open', 'DevTools appear to be open (window size heuristic)', { widthDiff, heightDiff });
      } else if (!isOpen) {
        devToolsRef.current = false;
      }
    }, 2000);

    // ── Multiple Screens (where browser API allows) ─────────────────
    if (window.screen?.isExtended) {
      logViolation('multiple_screens', 'Multiple screens detected at session start');
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearInterval(devtoolsInterval);
    };
  }, [enabled, logViolation]);

  // ── Request fullscreen on mount ─────────────────────────────────
  const requestFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }, []);

  return {
    violations,
    violationCount,
    warningVisible,
    lastViolation,
    dismissWarning,
    requestFullscreen,
    logViolation,
  };
};

export default useProctoringMonitor;
