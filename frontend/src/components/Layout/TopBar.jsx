import React from 'react';
import InterviewTimer from '../UI/InterviewTimer';

const TopBar = ({ title, recording, duration, onExpire }) => {
  return (
    <div className="glass-dark" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      height: '48px',
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ 
            width: 24, 
            height: 24, 
            borderRadius: 6, 
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>A</div>
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{title}</span>
        </div>
        
        {recording && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 10px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ef4444',
              animation: 'pulse 1.5s infinite'
            }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fca5a5' }}>Recording</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Connected</span>
          </div>
        </div>

        {duration && (
          <InterviewTimer durationMinutes={duration} onExpire={onExpire} />
        )}
      </div>
    </div>
  );
};

export default TopBar;
