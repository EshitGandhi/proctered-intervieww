import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useJitsi from '../hooks/useJitsi';
import useProctoringMonitor from '../hooks/useProctoringMonitor';
import JitsiPanel from '../components/VideoModule/JitsiPanel';
import CodeEditorPanel from '../components/CodeEditor/CodeEditorPanel';
import { ViolationOverlay } from '../components/Proctoring/ProctoringComponents';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import TopBar from '../components/Layout/TopBar';
import ControlBar from '../components/UI/ControlBar';

const CandidateRoom = () => {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [violations, setViolations] = useState([]);

  // UI State
  const [viewMode, setViewMode] = useState('split'); // 'full' | 'split' | 'video'
  const [chatOpen, setChatOpen] = useState(true);

  // ── Fetch interview details ─────────────────────────────────────────────────
  useEffect(() => {
    let timeoutId;

    const fetchInterview = async () => {
      try {
        const { data } = await api.get(`/interviews/room/${roomId}`);
        setInterview(data.data);
        setError('');
        setJoining(false);
      } catch (err) {
        const errMsg = err.response?.data?.message || 'Interview room not found.';
        setError(errMsg);

        // If 403 (not active yet), poll every 5 seconds
        if (err.response?.status === 403) {
          timeoutId = setTimeout(fetchInterview, 5000);
        } else {
          setJoining(false);
        }
      }
    };

    if (roomId) fetchInterview();
    return () => clearTimeout(timeoutId);
  }, [roomId]);

  // ── Jitsi ──────────────────────────────────────────────────────────────────
  const jitsi = useJitsi({
    roomId,
    userId: user?._id || user?.id,
    userName: user?.name || 'Candidate',
    role: 'candidate',
  });

  // ── Proctoring ─────────────────────────────────────────────────────────────
  const proctoring = useProctoringMonitor({
    interviewId: interview?._id,
    enabled: !!interview && !sessionEnded,
    onViolation: (v) => setViolations((prev) => [v, ...prev]),
    socket: jitsi.socket,
    roomId,
  });

  const [isEnding, setIsEnding] = useState(false);

  // ── Join when interview loaded ─────────────────────────────────────────────
  useEffect(() => {
    if (interview) {
      jitsi
        .joinRoom()
        .then(() => proctoring.requestFullscreen())
        .catch((err) => setError(`Connection Error: ${err.message}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview?._id]);

  // ── Handle auto-navigation after end ──────────────────────────────────────
  useEffect(() => {
    if (isEnding) {
      const timer = setTimeout(() => navigate('/join?ended=1'), 2000);
      return () => clearTimeout(timer);
    }
  }, [isEnding, navigate]);

  // ── Chat ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = connectSocket();
    socket.on('chat-message', (msg) => setChatMessages((prev) => [...prev, msg]));
    socket.on('end-interview', () => handleEndSession());
    return () => {
      socket.off('chat-message');
      socket.off('end-interview');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const socket = connectSocket();
    socket.emit('chat-message', { roomId, message: chatInput, senderName: user?.name });
    setChatMessages((prev) => [
      ...prev,
      { message: chatInput, senderName: user?.name, own: true, timestamp: new Date().toISOString() },
    ]);
    setChatInput('');
  };

  const handleEndSession = async () => {
    if (isEnding) return;
    setIsEnding(true);
    jitsi.leaveRoom();
    setSessionEnded(true);
  };

  // ── Loading / waiting states ───────────────────────────────────────────────
  if (joining || isEnding) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>
          {isEnding ? 'Ending session…' : 'Joining interview room…'}
        </p>
      </div>
    );
  }

  if (!interview && error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center flex-col gap-4"
        style={{ background: 'var(--bg-primary)', textAlign: 'center', padding: 20 }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Waiting for Interviewer</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>{error}</p>
        <div
          style={{
            marginTop: 24,
            padding: '12px 24px',
            background: 'rgba(37,99,235,0.1)',
            color: 'var(--accent-primary)',
            borderRadius: 8,
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          This page will automatically connect once the session starts.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {proctoring.warningVisible && (
        <ViolationOverlay
          violation={proctoring.lastViolation}
          onDismiss={proctoring.dismissWarning}
          count={proctoring.violationCount}
        />
      )}

      {/* Top Navigation */}
      <TopBar
        title={interview?.title || 'KL Prarambh — Interview'}
        recording={false}
        duration={interview?.duration}
        onExpire={handleEndSession}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Main Stage */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: viewMode === 'video' ? 'column' : 'row',
            padding: 8,
            gap: 8,
            overflow: 'hidden',
          }}
        >
          {/* Code Editor */}
          {viewMode !== 'video' && (
            <div
              style={{
                flex: viewMode === 'split' ? 0.6 : 1,
                display: 'flex',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: 'var(--shadow)',
                border: '1px solid var(--border)',
              }}
            >
              <CodeEditorPanel
                interviewId={interview?._id}
                socket={connectSocket()}
                roomId={roomId}
              />
            </div>
          )}

          {/* Jitsi Video Panel */}
          {(viewMode === 'split' || viewMode === 'video') && (
            <div
              style={{
                flex: viewMode === 'video' ? 1 : 0.4,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                className="glass"
                style={{ flex: 1, borderRadius: 12, overflow: 'hidden', display: 'flex' }}
              >
                <JitsiPanel
                  containerRef={jitsi.containerRef}
                  connected={jitsi.connected}
                  connectionState={jitsi.connectionState}
                  localName={user?.name}
                  remoteName={interview?.interviewer?.name || 'Interviewer'}
                  recording={false}
                  layout={viewMode === 'video' ? 'grid' : 'sidebar'}
                />
              </div>

              {/* Chat in split view */}
              {chatOpen && viewMode !== 'video' && (
                <div
                  className="glass"
                  style={{
                    height: '280px',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    Chat
                  </div>
                  <div className="chat-messages" style={{ flex: 1 }}>
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`chat-bubble ${msg.own ? 'own' : 'other'}`}>
                        {!msg.own && <div className="chat-sender">{msg.senderName}</div>}
                        {msg.message}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 8, display: 'flex', gap: 8 }}>
                    <input
                      className="input"
                      style={{ flex: 1, fontSize: '13px' }}
                      placeholder="Message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                    />
                    <button className="btn btn-primary btn-sm" onClick={sendChat}>
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Chat Overlay (full / video mode) */}
        {chatOpen && (viewMode === 'full' || viewMode === 'video') && (
          <div
            className="glass"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              bottom: 8,
              width: '320px',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              zIndex: 50,
              boxShadow: 'var(--shadow)',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600 }}>Chat</span>
              <button
                onClick={() => setChatOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                ✕
              </button>
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
              <input
                className="input"
                style={{ flex: 1, fontSize: '13px' }}
                placeholder="Type..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              />
              <button className="btn btn-primary btn-sm" onClick={sendChat}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Control Bar */}
      <ControlBar
        micMuted={jitsi.micMuted}
        cameraOff={jitsi.cameraOff}
        onToggleMic={jitsi.toggleMic}
        onToggleCamera={jitsi.toggleCamera}
        onEndCall={handleEndSession}
        viewMode={viewMode}
        onViewModeToggle={setViewMode}
        chatOpen={chatOpen}
        onChatToggle={() => setChatOpen(!chatOpen)}
      />
    </div>
  );
};

export default CandidateRoom;
