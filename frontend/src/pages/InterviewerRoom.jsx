import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useWebRTC from '../hooks/useWebRTC';
import VideoPanel from '../components/VideoModule/VideoPanel';
import CodeEditorPanel from '../components/CodeEditor/CodeEditorPanel';
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
  
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activePanel, setActivePanel] = useState('editor'); // 'editor', 'violations'

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

  // Listen for live proctoring events & Chat
  useEffect(() => {
    const socket = connectSocket();
    socket.connect();
    
    const handleViolation = (violation) => {
      setLiveViolations((prev) => [{ ...violation, receivedAt: new Date().toISOString() }, ...prev]);
    };
    
    const handleChat = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    };
    
    const handlePeerLeft = ({ role }) => {
      if (role === 'candidate') {
        setChatMessages((prev) => [...prev, {
          message: 'Candidate has left the session.',
          senderName: 'System',
          timestamp: new Date().toISOString(),
          isSystem: true,
        }]);
      }
    };

    socket.on('proctoring-violation', handleViolation);
    socket.on('chat-message', handleChat);
    socket.on('peer-left', handlePeerLeft);
    
    return () => {
      socket.off('proctoring-violation', handleViolation);
      socket.off('chat-message', handleChat);
      socket.off('peer-left', handlePeerLeft);
    };
  }, []);

  // Join automatically when loaded
  useEffect(() => {
    if (interview) {
      webRTC.joinRoom().catch((err) => setError(err.message));
    }
  }, [interview?._id]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const socket = connectSocket();
    socket.emit('chat-message', { roomId, message: chatInput, senderName: user?.name });
    setChatMessages((prev) => [...prev, {
      message: chatInput, senderName: user?.name, own: true,
      timestamp: new Date().toISOString(),
    }]);
    setChatInput('');
  };

  const handleEndCall = () => {
    webRTC.socket.current?.emit('end-interview', { roomId });
    webRTC.leaveRoom();
    window.close();
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
    <div className="room-layout">
      {/* Main area: shared code editor */}
      <div className="room-main">
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
          borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>👁️</span>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Live Monitoring: {interview?.title}</span>
          </div>
          <div style={{ flex: 1 }} />
          <span className={`badge ${liveViolations.length > 5 ? 'badge-danger' : liveViolations.length > 0 ? 'badge-warning' : 'badge-success'}`}>
            {liveViolations.length} violations
          </span>
        </div>

        {/* Code editor (read-only) */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <CodeEditorPanel 
            interviewId={interview?._id} 
            readOnly={true} 
            socket={connectSocket()} 
            roomId={roomId} 
          />
          <div style={{
            position: 'absolute', top: 12, right: 16, background: 'rgba(7, 13, 25, 0.7)',
            backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: 20,
            fontSize: '0.75rem', color: '#10b981', border: '1px solid #10b981',
            pointerEvents: 'none',
          }}>
            ⬤ Watching candidate type live
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="room-sidebar">
        {/* Video */}
        <div style={{ flexShrink: 0 }}>
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

        {/* Panel tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {[{ id: 'editor', label: '💬 Chat' }, { id: 'violations', label: `⚠ Alerts (${liveViolations.length})` }].map((tab) => (
            <button
              key={tab.id}
              className={`console-tab ${activePanel === tab.id ? 'active' : ''}`}
              onClick={() => setActivePanel(tab.id)}
              style={{ flex: 1 }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chat */}
        {activePanel === 'editor' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="chat-messages" style={{ flex: 1 }}>
              {chatMessages.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: 20 }}>
                  Chat with {interview?.candidateName || 'the candidate'} here
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i}>
                  {msg.isSystem ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '4px 0' }}>
                      {msg.message}
                    </div>
                  ) : (
                    <div className={`chat-bubble ${msg.own ? 'own' : 'other'}`}>
                      {!msg.own && <div className="chat-sender">{msg.senderName}</div>}
                      {msg.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                placeholder="Type a message…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              />
              <button className="btn btn-primary btn-sm" onClick={sendChat}>Send</button>
            </div>
          </div>
        )}

        {/* Violations Log */}
        {activePanel === 'violations' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ProctoringWidget violations={liveViolations} candidateName={interview?.candidateName} />
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewerRoom;
