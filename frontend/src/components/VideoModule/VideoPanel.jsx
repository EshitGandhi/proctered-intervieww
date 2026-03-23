import React, { useRef, useEffect } from 'react';

const VideoPanel = ({
  localStream,
  remoteStream,
  localName = 'You',
  remoteName = 'Participant',
  micMuted,
  cameraOff,
  connected,
  connectionState,
  onToggleMic,
  onToggleCamera,
  onEndCall,
  recording,
}) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, cameraOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && connected) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, connected]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden' }}>
      {/* Connection status banner */}
      {connectionState !== 'connected' && connectionState !== 'new' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px',
          background: connectionState === 'connecting' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
          borderBottom: '1px solid rgba(245,158,11,0.3)',
          fontSize: '0.75rem', color: connectionState === 'connecting' ? '#fcd34d' : '#fca5a5',
          fontWeight: 600,
        }}>
          <span>{connectionState === 'connecting' ? '⟳' : '⚠'}</span>
          {connectionState === 'connecting' && 'Connecting to peer…'}
          {connectionState === 'disconnected' && 'Peer disconnected. Waiting for reconnect…'}
          {connectionState === 'failed' && 'Connection failed. Attempting to restart ICE…'}
        </div>
      )}

      {/* Video grid */}
      <div className="video-grid" style={{ flex: 1 }}>
        {/* Remote video */}
        <div className="video-tile">
          {remoteStream && connected ? (
            <video ref={remoteVideoRef} autoPlay playsInline />
          ) : (
            <div className="video-no-stream">
              <span style={{ fontSize: 40 }}>👤</span>
              <span>{connected ? remoteName : 'Waiting for participant…'}</span>
            </div>
          )}
          <div className="video-tile-label">
            {remoteName}
            {connected && <span style={{ marginLeft: 6, color: '#10b981' }}>● Live</span>}
          </div>
        </div>

        {/* Local video */}
        <div className="video-tile" style={{ maxHeight: 180, maxWidth: 240, justifySelf: 'end' }}>
          {localStream && !cameraOff ? (
            <video ref={localVideoRef} autoPlay playsInline muted />
          ) : (
            <div className="video-no-stream">
              <span style={{ fontSize: 28 }}>📷</span>
              <span style={{ fontSize: '0.7rem' }}>Camera off</span>
            </div>
          )}
          <div className="video-tile-label">
            {localName} (You)
            {recording && <span style={{ marginLeft: 6, color: '#ef4444' }}>⬤ REC</span>}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="controls-bar">
        <button
          className={`control-btn ${micMuted ? 'muted' : ''}`}
          onClick={onToggleMic}
          title={micMuted ? 'Unmute' : 'Mute'}
        >
          {micMuted ? '🔇' : '🎤'}
        </button>
        <button
          className={`control-btn ${cameraOff ? 'muted' : ''}`}
          onClick={onToggleCamera}
          title={cameraOff ? 'Turn camera on' : 'Turn camera off'}
        >
          {cameraOff ? '📷' : '🎥'}
        </button>
        <button
          className="control-btn end-call"
          onClick={onEndCall}
          title="End call"
        >
          📵
        </button>
      </div>
    </div>
  );
};

export default VideoPanel;
