import React from 'react';

const ControlBar = ({ 
  micMuted, 
  cameraOff, 
  onToggleMic, 
  onToggleCamera, 
  onEndCall, 
  viewMode, 
  onViewModeToggle,
  chatOpen,
  onChatToggle
}) => {
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 16px',
      borderRadius: '32px',
      background: 'rgba(30, 41, 59, 0.8)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)'
    }}>
      <button 
        className={`control-btn ${micMuted ? 'muted' : 'active'}`}
        onClick={onToggleMic}
        title={micMuted ? 'Unmute' : 'Mute'}
      >
        {micMuted ? '🔇' : '🎤'}
      </button>

      <button 
        className={`control-btn ${cameraOff ? 'muted' : 'active'}`}
        onClick={onToggleCamera}
        title={cameraOff ? 'Turn camera on' : 'Turn camera off'}
      >
        {cameraOff ? '📷' : '🎥'}
      </button>

      <div style={{ width: '1px', height: '24px', background: 'rgba(148, 163, 184, 0.2)', margin: '0 4px' }} />

      <button 
        className={`control-btn ${viewMode === 'full' ? 'active' : ''}`}
        onClick={() => onViewModeToggle('full')}
        title="Full Editor View"
      >
        💻
      </button>

      <button 
        className={`control-btn ${viewMode === 'split' ? 'active' : ''}`}
        onClick={() => onViewModeToggle('split')}
        title="Split View"
      >
        🌓
      </button>

      <button 
        className={`control-btn ${viewMode === 'video' ? 'active' : ''}`}
        onClick={() => onViewModeToggle('video')}
        title="Video Focused View"
      >
        👥
      </button>

      <div style={{ width: '1px', height: '24px', background: 'rgba(148, 163, 184, 0.2)', margin: '0 4px' }} />

      <button 
        className={`control-btn ${chatOpen ? 'active' : ''}`}
        onClick={onChatToggle}
        title="Chat"
      >
        💬
      </button>

      <button 
        className="control-btn end-call"
        onClick={onEndCall}
        style={{ marginLeft: 8 }}
        title="End Interview"
      >
        📵
      </button>
    </div>
  );
};

export default ControlBar;
