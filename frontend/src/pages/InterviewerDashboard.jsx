import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProctoringWidget } from '../components/Proctoring/ProctoringComponents';
import VideoPanel from '../components/VideoModule/VideoPanel';
import JobManagement from './admin/JobManagement';
import CandidatePipeline from './admin/CandidatePipeline';
import api from '../services/api';
import useWebRTC from '../hooks/useWebRTC';
import { connectSocket } from '../services/socket';

const INITIAL_FORM = {
  title: '', description: '', candidateName: '', candidateEmail: '',
  duration: 60, settings: { enableProctoring: true, fullscreenRequired: true, codeExecutionEnabled: true },
};

const InterviewerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [activeSession, setActiveSession] = useState(null); // monitoring a live session
  const [liveViolations, setLiveViolations] = useState([]);
  const [copied, setCopied] = useState('');
  
  // Dashboard Tabs: 'interviews' | 'jobs' | 'pipeline'
  const [activeTab, setActiveTab] = useState('interviews');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'scheduled', 'active', 'completed'

  // Fetch interviews
  const fetchInterviews = async () => {
    try {
      const { data } = await api.get('/interviews');
      setInterviews(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInterviews(); }, []);

  // Listen for live proctoring events from all rooms
  useEffect(() => {
    const socket = connectSocket();
    socket.connect();
    socket.on('proctoring-violation', (violation) => {
      setLiveViolations((prev) => [{ ...violation, receivedAt: new Date().toISOString() }, ...prev]);
    });
    return () => socket.off('proctoring-violation');
  }, []);

  // Live monitoring WebRTC
  const webRTC = useWebRTC({
    roomId: activeSession?.roomId,
    userId: user?._id || user?.id,
    userName: user?.name,
    role: 'interviewer',
  });

  const startMonitoring = async (interview) => {
    setActiveSession(interview);
    setLiveViolations([]);
    await webRTC.joinRoom().catch(console.error);
  };

  const stopMonitoring = () => {
    webRTC.leaveRoom();
    setActiveSession(null);
  };

  const createInterview = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const { data } = await api.post('/interviews', form);
      setInterviews((prev) => [data.data, ...prev]);
      setShowModal(false);
      setForm(INITIAL_FORM);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create interview');
    } finally {
      setCreating(false);
    }
  };

  const endInterview = async (id) => {
    try {
      await api.patch(`/interviews/${id}/end`);
      fetchInterviews();
    } catch {}
  };

  const startInterview = async (id) => {
    try {
      await api.patch(`/interviews/${id}/start`);
      fetchInterviews();
    } catch {}
  };

  const rescheduleInterview = async (id) => {
    if (!window.confirm("This will create a NEW interview session for this candidate while keeping the old one as history. Proceed?")) return;

    const newDate = prompt("Enter new scheduled time (e.g., 2026-03-27T10:00):", new Date().toISOString().slice(0, 16));
    if (!newDate) return;
    try {
      await api.post(`/interviews/${id}/reschedule`, { scheduledAt: new Date(newDate) });
      fetchInterviews();
    } catch (err) {
      alert("Failed to reschedule: " + (err.response?.data?.message || err.message));
    }
  };

  const copyRoomLink = (roomId) => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(roomId);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  const stats = {
    total: interviews.length,
    active: interviews.filter((i) => i.status === 'active').length,
    completed: interviews.filter((i) => i.status === 'completed').length,
    scheduled: interviews.filter((i) => i.status === 'scheduled').length,
  };

  const STATUS_COLORS = {
    scheduled: 'badge-neutral', active: 'badge-success',
    completed: 'badge-primary', cancelled: 'badge-danger',
  };

  const filteredInterviews = interviews.filter((iv) => {
    if (statusFilter === 'all') return true;
    return iv.status === statusFilter;
  });

  return (
    <div className="dashboard-page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">🎯 InterviewPro</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user?.name}</span>
          <span className="badge badge-primary">Interviewer</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </nav>

      <div className="dashboard-content">
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Interviews', value: stats.total, icon: '📋' },
            { label: 'Active Now', value: stats.active, icon: '🟢' },
            { label: 'Interview Completed', value: stats.completed, icon: '✅' },
            { label: 'Scheduled', value: stats.scheduled, icon: '📅' },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div className="stat-number">{s.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <button className={`btn ${activeTab === 'interviews' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('interviews')}>Video Interviews</button>
          <button className={`btn ${activeTab === 'jobs' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('jobs')}>Jobs & MCQs</button>
          <button className={`btn ${activeTab === 'pipeline' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('pipeline')}>Candidate Pipeline</button>
        </div>

        {/* Live monitoring panel */}
        {activeSession && (
          <div className="card" style={{ marginBottom: 24, borderColor: '#10b981' }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#10b981', fontSize: 12 }}>⬤</span>
                <span style={{ fontWeight: 700 }}>Live Monitoring: {activeSession.title}</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={stopMonitoring}>Stop Monitoring</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
              <div>
                <VideoPanel
                  localStream={webRTC.localStream}
                  remoteStream={webRTC.remoteStream}
                  localName={user?.name}
                  remoteName={activeSession.candidateName || 'Candidate'}
                  micMuted={webRTC.micMuted}
                  cameraOff={webRTC.cameraOff}
                  connected={webRTC.connected}
                  connectionState={webRTC.connectionState}
                  onToggleMic={webRTC.toggleMic}
                  onToggleCamera={webRTC.toggleCamera}
                  onEndCall={stopMonitoring}
                />
              </div>
              <ProctoringWidget violations={liveViolations} candidateName={activeSession.candidateName} />
            </div>
          </div>
        )}

        {/* Tab Content: Jobs */}
        {activeTab === 'jobs' && <JobManagement />}

        {/* Tab Content: Candidate Pipeline */}
        {activeTab === 'pipeline' && <CandidatePipeline />}

        {/* Tab Content: Interviews table */}
        {activeTab === 'interviews' && (
          <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Interview Sessions</h2>
              {/* Filter pills */}
              <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                {['all', 'scheduled', 'active', 'completed'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    style={{
                      padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                      border: '1px solid var(--border)', fontSize: '0.75rem',
                      background: statusFilter === f ? 'var(--primary)' : 'var(--bg-secondary)',
                      color: statusFilter === f ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              + New Interview
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : filteredInterviews.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p>No {statusFilter === 'all' ? '' : `${statusFilter} `}interviews found.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Candidate</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInterviews.map((iv) => (
                  <tr key={iv._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{iv.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {iv.roomId.substring(0, 18)}…
                      </div>
                    </td>
                    <td>
                      <div>{iv.candidateName || '—'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{iv.candidateEmail}</div>
                    </td>
                    <td>{iv.duration} min</td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[iv.status]}`}>
                        {iv.status === 'completed' ? 'Interview Completed' : iv.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(iv.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => copyRoomLink(iv.roomId)}
                          title="Copy room link"
                        >
                          {copied === iv.roomId ? '✅ Copied' : '🔗 Link'}
                        </button>
                        {iv.status === 'scheduled' && (
                          <button className="btn btn-success btn-sm" onClick={async () => {
                            await startInterview(iv._id);
                            window.open(`/monitor/${iv.roomId}`, '_blank', 'popup=yes,fullscreen=yes,width=1280,height=720');
                          }}>
                            ▶ Start
                          </button>
                        )}
                        {iv.status === 'active' && (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              window.open(`/monitor/${iv.roomId}`, '_blank', 'popup=yes,fullscreen=yes,width=1280,height=720');
                            }}>
                              👁 Monitor
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => endInterview(iv._id)}>
                              ⏹ End
                            </button>
                          </>
                        )}
                        {iv.status === 'completed' && (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/playback/${iv._id}`)}>
                              ▶ Playback
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => rescheduleInterview(iv._id)}>
                              🔁 Reschedule
                            </button>
                          </>
                        )}
                        {(iv.status === 'cancelled' || (iv.status === 'scheduled' && new Date(iv.scheduledAt) < new Date())) && (
                           <button className="btn btn-ghost btn-sm" onClick={() => rescheduleInterview(iv._id)}>
                            🔁 Reschedule
                           </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        )}
      </div>

      {/* Create Interview Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.1rem' }}>New Interview Session</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {createError && (
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>⚠ {createError}</div>
            )}

            <form onSubmit={createInterview} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="label">Interview Title *</label>
                <input
                  className="input" required placeholder="e.g. Senior Frontend Developer Interview"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="label">Candidate Name</label>
                  <input
                    className="input" placeholder="Full name"
                    value={form.candidateName}
                    onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="label">Candidate Email</label>
                  <input
                    className="input" type="email" placeholder="email@example.com"
                    value={form.candidateEmail}
                    onChange={(e) => setForm({ ...form, candidateEmail: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Duration (minutes)</label>
                <input
                  className="input" type="number" min="15" max="180"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label className="label">Description</label>
                <textarea
                  className="input" rows={3} placeholder="Interview description, topics to cover…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ resize: 'vertical', minHeight: 80 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="btn btn-secondary w-full" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary w-full" disabled={creating}>
                  {creating ? '⟳ Creating…' : '✓ Create Interview'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewerDashboard;
