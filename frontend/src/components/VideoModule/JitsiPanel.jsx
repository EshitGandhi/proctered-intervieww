import React from 'react';

/**
 * JitsiPanel
 *
 * A thin wrapper that gives the Jitsi External API a sized DOM container.
 * The actual iframe is injected into `containerRef` by `useJitsi.joinRoom()`.
 *
 * Props:
 *  - containerRef   — ref from useJitsi, attached to the host <div>
 *  - connected      — boolean, whether the conference is joined
 *  - connectionState— string, e.g. 'connecting' | 'connected' | 'failed'
 *  - localName      — display name of the local user (shown before join)
 *  - remoteName     — display name of the remote user  (shown before join)
 *  - recording      — bool, shows a recording badge
 *  - layout         — 'sidebar' | 'grid' (affects aspect ratio hint only)
 */
const JitsiPanel = ({
  containerRef,
  connected,
  connectionState = 'new',
  localName = 'You',
  remoteName = 'Participant',
  recording = false,
  layout = 'sidebar',
}) => {
  const isConnecting = !connected && connectionState !== 'failed';

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#0f172a',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Recording badge */}
      {recording && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            background: 'rgba(239, 68, 68, 0.85)',
            backdropFilter: 'blur(8px)',
            fontSize: '11px',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '0.05em',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#fff',
              animation: 'pulse-rec 1.4s infinite',
            }}
          />
          REC
        </div>
      )}

      {/* Connecting overlay — shown until Jitsi iframe takes over */}
      {isConnecting && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '3px solid rgba(37,99,235,0.2)',
              borderTopColor: '#2563eb',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>
            {connectionState === 'failed'
              ? 'Connection failed — please refresh'
              : 'Connecting to Jitsi…'}
          </p>
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 8,
              fontSize: '13px',
              color: '#64748b',
            }}
          >
            <span>👤 {localName}</span>
            <span>⟷</span>
            <span>👤 {remoteName}</span>
          </div>
        </div>
      )}

      {/* Jitsi iframe container — the External API injects the <iframe> here */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          // Keep div visible so Jitsi can inject iframe immediately
        }}
        id="jitsi-container"
      />

      <style>{`
        @keyframes pulse-rec {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* Make Jitsi iframe fill container */
        #jitsi-container iframe {
          border: none !important;
          border-radius: 0 !important;
        }
      `}</style>
    </div>
  );
};

export default JitsiPanel;
