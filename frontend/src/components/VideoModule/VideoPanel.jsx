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
  recording,
  layout = 'sidebar' // 'sidebar' | 'grid'
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

  const tileStyle = {
    position: 'relative',
    borderRadius: '12px',
    overflow: 'hidden',
    background: '#000',
    aspectRatio: '16/9',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    border: '1px solid var(--border)'
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: layout === 'sidebar' ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: 12,
      padding: 12,
      background: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%'
    }}>
      {/* Remote Participant */}
      <div style={{ ...tileStyle, flex: layout === 'sidebar' ? '0 0 auto' : '1 1 400px', maxWidth: layout === 'sidebar' ? '100%' : '800px' }}>
        {remoteStream && connected ? (
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="video-no-stream" style={{ background: '#1e293b' }}>
            <span style={{ fontSize: 40 }}>👤</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{connected ? remoteName : 'Connecting…'}</span>
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          padding: '4px 12px', borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          fontSize: '12px', fontWeight: 600, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span>{remoteName}</span>
          {connected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />}
        </div>
      </div>

      {/* Local Participant */}
      <div style={{ ...tileStyle, flex: layout === 'sidebar' ? '0 0 auto' : '1 1 400px', maxWidth: layout === 'sidebar' ? '100%' : '800px' }}>
        {localStream && !cameraOff ? (
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="video-no-stream" style={{ background: '#1e293b' }}>
            <span style={{ fontSize: 40 }}>📷</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Camera Off</span>
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: 12, left: 12,
          padding: '4px 12px', borderRadius: 8,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          fontSize: '12px', fontWeight: 600, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span>{localName} (You)</span>
          {micMuted && <span title="Muted">🔇</span>}
        </div>
      </div>
    </div>
  );
};

export default VideoPanel;
