import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useWebRTC from '../hooks/useWebRTC';
import useProctoringMonitor from '../hooks/useProctoringMonitor';
import useRecorder from '../hooks/useRecorder';
import VideoPanel from '../components/VideoModule/VideoPanel';
import CodeEditorPanel from '../components/CodeEditor/CodeEditorPanel';
import InterviewTimer from '../components/UI/InterviewTimer';
import { ViolationOverlay } from '../components/Proctoring/ProctoringComponents';
import api from '../services/api';
import { connectSocket } from '../services/socket';

const CandidateRoom = () => {
  const { roomId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activePanel, setActivePanel] = useState('editor'); // 'editor' | 'chat'
  const [sessionEnded, setSessionEnded] = useState(false);
  const [violations, setViolations] = useState([]);

  // Fetch interview details
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const { data } = await api.get(`/interviews/room/${roomId}`);
        setInterview(data.data);
      } catch (err) {
        setError('Interview room not found or access denied.');
      } finally {
        setJoining(false);
      }
    };
    if (roomId) fetchInterview();
  }, [roomId]);

  // WebRTC
  const webRTC = useWebRTC({
    roomId,
    userId: user?._id || user?.id,
    userName: user?.name || 'Candidate',
    role: 'candidate',
  });

  // Recording
  const recorder = useRecorder({
    interviewId: interview?._id,
    stream: webRTC.localStream,
  });

  // Proctoring
  const proctoring = useProctoringMonitor({
    interviewId: interview?._id,
    enabled: !!interview && !sessionEnded,
    onViolation: (v) => setViolations((prev) => [v, ...prev]),
    socket: webRTC.socket,
    roomId,
  });

  // Join when interview loaded
  useEffect(() => {
    if (interview) {
      webRTC.joinRoom().then(() => {
        recorder.startRecording();
        recorder.startScreenCapture(); // starts screen recording + transcription
        proctoring.requestFullscreen();
      }).catch((err) => setError(err.message));
    }
  }, [interview?._id]);

  // Chat via socket
  useEffect(() => {
    const socket = connectSocket();
    socket.on('chat-message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });
    socket.on('peer-left', ({ role }) => {
      if (role === 'interviewer') {
        setChatMessages((prev) => [...prev, {
          message: 'Interviewer has left the session. (Testing mode only, awaiting end command)',
          senderName: 'System',
          timestamp: new Date().toISOString(),
          isSystem: true,
        }]);
      }
    });
    socket.on('end-interview', () => {
      alert("The interviewer has officially ended the session. You will be redirected.");
      handleEndSession();
    });
    return () => { socket.off('chat-message'); socket.off('peer-left'); socket.off('end-interview'); };
  }, []);

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

  const handleEndSession = async () => {
    recorder.stopRecording();
    recorder.stopScreenCapture(); // stops screen recording + uploads transcript
    webRTC.leaveRoom();
    setSessionEnded(true);
    navigate('/join?ended=1');
  };

  if (joining) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Joining interview room…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ marginBottom: 8 }}>Room Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/join')}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Proctoring violation overlay */}
      {proctoring.warningVisible && (
        <ViolationOverlay
          violation={proctoring.lastViolation}
          onDismiss={proctoring.dismissWarning}
          count={proctoring.violationCount}
        />
      )}

      <div className="room-layout">
        {/* Main area: code editor */}
        <div className="room-main">
          {/* Top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
            borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{interview?.title || 'Interview Session'}</span>
            </div>
            <div style={{ flex: 1 }} />
            {/* Screen recording status */}
            {recorder.screenRecording && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 20, padding: '3px 10px', fontSize: '0.72rem', color: '#fca5a5',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
                  animation: 'pulse 1.4s infinite',
                }} />
                🖥 Screen Recording
              </div>
            )}
            {recorder.transcribing && recorder.transcript && (
              <div style={{
                maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', fontSize: '0.7rem', color: 'var(--text-muted)',
                background: 'var(--bg-secondary)', borderRadius: 20, padding: '3px 10px',
                border: '1px solid var(--border)',
              }} title={recorder.transcript}>
                📝 {recorder.transcript.slice(-60)}
              </div>
            )}
            <span className={`badge ${proctoring.violationCount > 5 ? 'badge-danger' : proctoring.violationCount > 0 ? 'badge-warning' : 'badge-success'}`}>
              {proctoring.violationCount} violations
            </span>
            {interview?.duration && (
              <InterviewTimer
                durationMinutes={interview.duration}
                onExpire={() => { alert('Time is up!'); handleEndSession(); }}
              />
            )}
          </div>

          {/* Code editor - fills remaining space */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <CodeEditorPanel interviewId={interview?._id} socket={connectSocket()} roomId={roomId} />
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
              remoteName={interview?.interviewer?.name || 'Interviewer'}
              micMuted={webRTC.micMuted}
              cameraOff={webRTC.cameraOff}
              connected={webRTC.connected}
              connectionState={webRTC.connectionState}
              onToggleMic={webRTC.toggleMic}
              onToggleCamera={webRTC.toggleCamera}
              onEndCall={handleEndSession}
              recording={recorder.recording}
            />
          </div>

          {/* Panel tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {[{ id: 'editor', label: '💬 Chat' }, { id: 'violations', label: `⚠ Alerts (${violations.length})` }].map((tab) => (
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
                    Chat with your interviewer here
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

          {/* Violations log for candidate view */}
          {activePanel === 'violations' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {violations.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: 20 }}>
                  ✅ No violations recorded
                </p>
              ) : violations.map((v, i) => (
                <div key={i} className="violation-item">
                  <div className={`violation-dot ${v.severity}`} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{v.eventType.replace(/_/g, ' ')}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CandidateRoom;
