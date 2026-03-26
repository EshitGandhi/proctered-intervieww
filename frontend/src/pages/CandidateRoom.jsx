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

  // Fetch interview details
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const { data } = await api.get(`/interviews/room/${roomId}`);
        setInterview(data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Interview room not found or access denied.');
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
    remoteStream: webRTC.remoteStream,
  });

  // Proctoring
  const proctoring = useProctoringMonitor({
    interviewId: interview?._id,
    enabled: !!interview && !sessionEnded,
    onViolation: (v) => setViolations((prev) => [v, ...prev]),
    socket: webRTC.socket,
    roomId,
  });

  const [isEnding, setIsEnding] = useState(false);

  // Join when interview loaded
  useEffect(() => {
    if (interview) {
      webRTC.joinRoom().then(() => proctoring.requestFullscreen()).catch((err) => {
        setError(`Media Error: ${err.message}`);
      });
    }
  }, [interview?._id]);

  // Auto-start recording
  useEffect(() => {
    if (webRTC.localStream && webRTC.remoteStream && !recorder.recording && !isEnding) {
      recorder.startRecording();
    }
  }, [webRTC.localStream, webRTC.remoteStream, recorder.recording, isEnding]);

  // Handle auto-navigation
  useEffect(() => {
    if (isEnding && !recorder.isUploading) {
      const timer = setTimeout(() => navigate('/join?ended=1'), 1500);
      return () => clearTimeout(timer);
    }
  }, [isEnding, recorder.isUploading, navigate]);

  // Chat
  useEffect(() => {
    const socket = connectSocket();
    socket.on('chat-message', (msg) => setChatMessages((prev) => [...prev, msg]));
    socket.on('end-interview', () => handleEndSession());
    return () => { socket.off('chat-message'); socket.off('end-interview'); };
  }, []);

  const sendChat = () => {
    if (!chatInput.trim()) return;
    const socket = connectSocket();
    socket.emit('chat-message', { roomId, message: chatInput, senderName: user?.name });
    setChatMessages((prev) => [...prev, { message: chatInput, senderName: user?.name, own: true, timestamp: new Date().toISOString() }]);
    setChatInput('');
  };

  const handleEndSession = async () => {
    if (isEnding) return;
    setIsEnding(true);
    recorder.stopRecording();
    webRTC.leaveRoom();
    setSessionEnded(true);
  };

  if (joining || isEnding) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>
          {isEnding ? 'Saving session recordings...' : 'Joining interview room…'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {proctoring.warningVisible && (
        <ViolationOverlay
          violation={proctoring.lastViolation}
          onDismiss={proctoring.dismissWarning}
          count={proctoring.violationCount}
        />
      )}

      {/* Top Navigation */}
      <TopBar 
        title={interview?.title || 'TSE MERN — Final Interview'}
        recording={recorder.recording}
        duration={interview?.duration}
        onExpire={handleEndSession}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        {/* Main Stage (Changeable Layout) */}
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
              border: '1px solid var(--border)'
            }}>
              <CodeEditorPanel interviewId={interview?._id} socket={connectSocket()} roomId={roomId} />
            </div>
          )}

          {(viewMode === 'split' || viewMode === 'video') && (
            <div style={{ 
              flex: viewMode === 'video' ? 1 : 0.35,
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div className="glass" style={{ flex: 1, borderRadius: 12, overflow: 'hidden', display: 'flex' }}>
                 <VideoPanel
                    localStream={webRTC.localStream}
                    remoteStream={webRTC.remoteStream}
                    localName={user?.name}
                    remoteName={interview?.interviewer?.name}
                    micMuted={webRTC.micMuted}
                    cameraOff={webRTC.cameraOff}
                    connected={webRTC.connected}
                    connectionState={webRTC.connectionState}
                    recording={recorder.recording}
                    layout={viewMode === 'video' ? 'grid' : 'sidebar'}
                  />
              </div>

              {/* Chat Integration (if in split and chat is open) */}
              {chatOpen && viewMode !== 'video' && (
                <div className="glass" style={{ height: '300px', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600 }}>Chat</div>
                  <div className="chat-messages" style={{ flex: 1 }}>
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`chat-bubble ${msg.own ? 'own' : 'other'}`}>
                        {!msg.own && <div className="chat-sender">{msg.senderName}</div>}
                        {msg.message}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 8, display: 'flex', gap: 8 }}>
                    <input className="input" style={{ flex: 1, fontSize: '13px' }} placeholder="Message..." value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} />
                    <button className="btn btn-primary btn-sm" onClick={sendChat}>Send</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global Chat Overlay (if viewMode is 'full' and chat is open) */}
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

      {/* Floating Control Bar */}
      <ControlBar 
        micMuted={webRTC.micMuted}
        cameraOff={webRTC.cameraOff}
        onToggleMic={webRTC.toggleMic}
        onToggleCamera={webRTC.toggleCamera}
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
