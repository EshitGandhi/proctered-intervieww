import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const JoinPage = () => {
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const ended = new URLSearchParams(window.location.search).get('ended');

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomId.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.get(`/interviews/room/${roomId.trim()}`);
      // Success - open in new fullscreen window
      window.open(`/room/${roomId.trim()}`, '_blank', 'popup=yes,fullscreen=yes,width=1280,height=720');
      
      // Optionally show a message in the current tab
      setRoomId(''); // clear so they know it worked
    } catch (err) {
      setError(err.response?.data?.message || 'Room not found. Please check the link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Join Interview</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Welcome back, <strong style={{ color: 'var(--text-primary)' }}>{user?.name}</strong>
          </p>
        </div>

        {ended && (
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            ✅ Session ended successfully. Your recording has been uploaded.
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>⚠ {error}</div>
        )}

        <div style={{
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: '0.82rem',
          color: '#fcd34d',
        }}>
          <strong>⚠ Important:</strong> This interview is proctored. By joining you agree to:
          <ul style={{ marginTop: 6, paddingLeft: 16 }}>
            <li>Keep this tab focused at all times</li>
            <li>Allow camera and microphone access</li>
            <li>Enter and stay in fullscreen mode</li>
            <li>Not use copy-paste shortcuts outside the code editor</li>
          </ul>
        </div>

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="label">Room ID or Interview Link</label>
            <input
              className="input"
              type="text"
              placeholder="Paste your room ID or link here"
              value={roomId}
              onChange={(e) => {
                // Extract UUID from a URL if pasted
                const val = e.target.value;
                const match = val.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                setRoomId(match ? match[0] : val);
              }}
            />
          </div>

          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading || !roomId.trim()}>
            {loading ? '⟳ Checking…' : '🚀 Join Interview'}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 16, textAlign: 'center' }}>
          <button onClick={logout} className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinPage;
