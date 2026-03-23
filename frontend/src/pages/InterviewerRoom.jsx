import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useWebRTC from '../hooks/useWebRTC';
import VideoPanel from '../components/VideoModule/VideoPanel';
import { ProctoringWidget } from '../components/Proctoring/ProctoringComponents';
import api from '../services/api';
import { connectSocket } from '../services/socket';

const InterviewerRoom = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveViolations, setLiveViolations] = useState([]);

  // Fetch interview details
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const { data } = await api.get(`/interviews/room/${roomId}`);
        setInterview(data.data);
      } catch (err) {
        setError('Room not found or access denied.');
      } finally {
        setLoading(false);
      }
    };
    if (roomId) fetchInterview();
  }, [roomId]);

  // WebRTC
  const webRTC = useWebRTC({
    roomId,
    userId: user?._id || user?.id,
    userName: user?.name || 'Interviewer',
    role: 'interviewer',
  });

  // Listen for live proctoring events
  useEffect(() => {
    const socket = connectSocket();
    socket.connect();
    socket.on('proctoring-violation', (violation) => {
      setLiveViolations((prev) => [{ ...violation, receivedAt: new Date().toISOString() }, ...prev]);
    });
    return () => socket.off('proctoring-violation');
  }, []);

  // Join automatically when loaded
  useEffect(() => {
    if (interview) {
      webRTC.joinRoom().catch((err) => setError(err.message));
    }
  }, [interview?._id]);

  const handleEndCall = () => {
    webRTC.leaveRoom();
    // Close the popup window
    window.close();
    // Fallback if window.close() is blocked
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card text-center" style={{ maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2>Error</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: 24 }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>👁️</span>
          <span style={{ fontWeight: 700 }}>Live Monitoring: {interview?.title}</span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', gap: 16, padding: 16, overflow: 'hidden' }}>
        {/* Left: Video */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <VideoPanel
            localStream={webRTC.localStream}
            remoteStream={webRTC.remoteStream}
            localName={user?.name}
            remoteName={interview?.candidateName || 'Candidate'}
            micMuted={webRTC.micMuted}
            cameraOff={webRTC.cameraOff}
            connected={webRTC.connected}
            connectionState={webRTC.connectionState}
            onToggleMic={webRTC.toggleMic}
            onToggleCamera={webRTC.toggleCamera}
            onEndCall={handleEndCall}
          />
        </div>

        {/* Right: Proctoring */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 0 }}>
            <ProctoringWidget violations={liveViolations} candidateName={interview?.candidateName} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewerRoom;
