import React from 'react';

const VIOLATION_LABELS = {
  tab_switch: '🔀 Tab Switch Detected',
  window_blur: '🪟 Window Focus Lost',
  copy_attempt: '📋 Copy Attempt Blocked',
  paste_attempt: '📋 Paste Attempt Blocked',
  cut_attempt: '✂ Cut Attempt Blocked',
  right_click: '🖱 Right-Click Blocked',
  keyboard_shortcut: '⌨ Shortcut Blocked',
  fullscreen_exit: '⛶ Fullscreen Exited',
  devtools_open: '🔧 DevTools Detected',
  multiple_screens: '🖥 Multiple Screens Detected',
};

const ViolationOverlay = ({ violation, onDismiss, count }) => {
  if (!violation) return null;

  return (
    <div className="violation-overlay" onClick={onDismiss}>
      <div className="violation-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <h2 style={{ color: 'var(--danger)', marginBottom: 8, fontSize: '1.25rem' }}>
          {VIOLATION_LABELS[violation.eventType] || 'Violation Detected'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.9rem' }}>
          {violation.description}
        </p>
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 20,
        }}>
          <p style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
            This action has been recorded. Total violations: <strong>{count}</strong>
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Repeated violations will be reported to your interviewer.
          </p>
        </div>
        <button className="btn btn-danger w-full" onClick={onDismiss}>
          I Understand — Return to Interview
        </button>
      </div>
    </div>
  );
};

/**
 * ProctoringWidget — shows live violation feed for the interviewer
 */
const ProctoringWidget = ({ violations = [], candidateName }) => {
  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {candidateName || 'Candidate'} Proctoring Feed
        </span>
        <span className={`badge ${violations.length > 5 ? 'badge-danger' : violations.length > 2 ? 'badge-warning' : 'badge-neutral'}`}>
          {violations.length} events
        </span>
      </div>

      {violations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          ✅ No violations detected yet
        </div>
      ) : (
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {violations.map((v, i) => (
            <div key={i} className="violation-item">
              <div className={`violation-dot ${v.severity}`} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.78rem' }}>
                  {VIOLATION_LABELS[v.eventType] || v.eventType}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  {new Date(v.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <span className={`badge badge-${v.severity === 'high' ? 'danger' : v.severity === 'medium' ? 'warning' : 'neutral'}`}>
                {v.severity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { ViolationOverlay, ProctoringWidget };
