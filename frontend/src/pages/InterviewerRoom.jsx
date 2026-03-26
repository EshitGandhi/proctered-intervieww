import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useWebRTC from '../hooks/useWebRTC';
import VideoPanel from '../components/VideoModule/VideoPanel';
import CodeEditorPanel from '../components/CodeEditor/CodeEditorPanel';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import TopBar from '../components/Layout/TopBar';
import ControlBar from '../components/UI/ControlBar';

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
  
  // UI State
  const [viewMode, setViewMode] = useState('split');
  const [chatOpen, setChatOpen] = useState(true);

  // Fetch interview details
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const { data } = await api.get(`/interviews/room/${roomId}`);
        setInterview(data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Room not found or access denied.');
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

  // Socket listeners
  useEffect(() => {
    const socket = connectSocket();
    socket.on('proctoring-violation', (v) => setLiveViolations((prev) => [{ ...v, receivedAt: new Date().toISOString() }, ...prev]));
    socket.on('chat-message', (msg) => setChatMessages((prev) => [...prev, msg]));
    return () => { socket.off('proctoring-violation'); socket.off('chat-message'); };
  }, []);

  // Join
  useEffect(() => {
    if (interview) webRTC.joinRoom().catch((err) => setError(err.message));
  }, [interview?._id]);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const socket = connectSocket();
    socket.emit('chat-message', { roomId, message: chatInput, senderName: user?.name });
    setChatMessages((prev) => [...prev, { message: chatInput, senderName: user?.name, own: true, timestamp: new Date().toISOString() }]);
    setChatInput('');
  };

  const handleStartCall = async () => {
    if (interview?._id) {
      try {
        const { data } = await api.patch(`/interviews/${interview._id}/start`);
        setInterview(data.data);
      } catch (err) {
        alert('Failed to start interview.');
      }
    }
  };

  const handleEndCall = async () => {
    webRTC.socket.current?.emit('end-interview', { roomId });
    if (interview?._id) {
      try { await api.patch(`/interviews/${interview._id}/end`); } catch (err) {}
    }
    webRTC.leaveRoom();
    navigate('/dashboard');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      
      {/* Top Bar with unique Interviewer controls */}
      <div style={{ position: 'relative' }}>
        <TopBar 
          title={`Monitoring: ${interview?.title || 'Main Interview'}`}
          recording={true} // Interviewer always "sees" recording status
        />
        {interview?.status === 'scheduled' && (
          <button 
            className="btn btn-primary btn-sm" 
            style={{ position: 'absolute', right: '350px', top: '10px', zIndex: 110 }}
            onClick={handleStartCall}
          >
            ▶ Start Session
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        {/* Main Stage */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: viewMode === 'video' ? 'column' : 'row',
          padding: 8, gap: 8,
          overflow: 'hidden'
        }}>
          {viewMode !== 'video' && (
            <div style={{ 
              flex: viewMode === 'split' ? 0.65 : 1, 
              display: 'flex', 
              borderRadius: 12, overflow: 'hidden',
              boxShadow: 'var(--shadow)',
              border: '1px solid var(--border)',
              position: 'relative'
            }}>
              <CodeEditorPanel interviewId={interview?._id} readOnly={true} socket={connectSocket()} roomId={roomId} />
              <div style={{
                position: 'absolute', top: 12, right: 16, background: 'rgba(7, 13, 25, 0.7)',
                backdropFilter: 'blur(4px)', padding: '4px 12px', borderRadius: 20,
                fontSize: '0.75rem', color: '#10b981', border: '1px solid #10b981',
                pointerEvents: 'none', zIndex: 10
              }}>
                ⬤ Watching candidate live
              </div>
            </div>
          )}

          {(viewMode === 'split' || viewMode === 'video') && (
            <div style={{ 
              flex: viewMode === 'video' ? 1 : 0.35,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              {/* Maximized Video Stage for Interviewer */}
              <div className="glass" style={{ flex: 1, borderRadius: 12, overflow: 'hidden', display: 'flex' }}>
                 <VideoPanel
                    localStream={webRTC.localStream}
                    remoteStream={webRTC.remoteStream}
                    localName={user?.name}
                    remoteName={interview?.candidateName}
                    micMuted={webRTC.micMuted}
                    cameraOff={webRTC.cameraOff}
                    connected={webRTC.connected}
                    connectionState={webRTC.connectionState}
                    layout={viewMode === 'video' ? 'grid' : 'sidebar'}
                  />
              </div>

              {/* Smaller, cleaner violations status bar instead of a full panel */}
              {viewMode === 'split' && (
                <div className="glass" style={{ padding: '8px 16px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Live Violations</span>
                   <span className="badge badge-danger">{liveViolations.length}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Chat Overlay */}
        {chatOpen && (viewMode === 'full' || viewMode === 'video') && (
          <div className="glass" style={{
            position: 'absolute', top: 8, right: 8, bottom: 8, width: '320px',
            borderRadius: 12, display: 'flex', flexDirection: 'column', zIndex: 50,
            boxShadow: 'var(--shadow)'
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{ fontWeight: 600 }}>Chat</span>
               <button onClick={() => setChatOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="chat-messages" style={{ flex: 1 }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-bubble ${msg.own ? 'own' : 'other'}`}>
                    {!msg.own && <div className="chat-sender">{msg.senderName}</div>}
                    {msg.message}
                  </div>
                ))}
            </div>
            <div style={{ padding: 12, display: 'flex', gap: 8 }}>
              <input className="input" style={{ flex: 1, fontSize: '13px' }} placeholder="Type..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
              <button className="btn btn-primary btn-sm" onClick={sendChat}>Send</button>
            </div>
          </div>
        )}
      </div>

      <ControlBar 
        micMuted={webRTC.micMuted}
        cameraOff={webRTC.cameraOff}
        onToggleMic={webRTC.toggleMic}
        onToggleCamera={webRTC.toggleCamera}
        onEndCall={handleEndCall}
        viewMode={viewMode}
        onViewModeToggle={setViewMode}
        chatOpen={chatOpen}
        onChatToggle={() => setChatOpen(!chatOpen)}
      />
    </div>
  );
};

export default InterviewerRoom;
