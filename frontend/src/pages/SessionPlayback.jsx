import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

const SessionPlayback = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recordings');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [transcriptsData, setTranscriptsData] = useState([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const videoRef = useRef(null);

  const BACKEND_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ivRes, recRes, subRes, logRes] = await Promise.all([
          api.get(`/interviews/${interviewId}`),
          api.get(`/recordings/interview/${interviewId}`),
          api.get(`/code/interview/${interviewId}`),
          api.get(`/proctoring/interview/${interviewId}`),
        ]);
        setInterview(ivRes.data.data);
        setRecordings(recRes.data.data);
        setSubmissions(subRes.data.data);
        setViolations(logRes.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [interviewId]);

  const formatDuration = (start, end) => {
    if (!start || !end) return '—';
    const diff = Math.floor((new Date(end) - new Date(start)) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${m}m ${s}s`;
  };

  // Fetch transcripts text when Transcript tab is opened
  const handleTranscriptTab = async () => {
    setActiveTab('transcript');
    const transcriptRecs = recordings.filter((r) => r.type === 'transcript');
    if (transcriptRecs.length === 0) { setTranscriptsData([]); return; }
    
    // If already loaded the same number of transcripts, don't re-fetch everything
    if (transcriptsData.length === transcriptRecs.length) return;

    try {
      setTranscriptLoading(true);
      const allTranscripts = await Promise.all(
        transcriptRecs.map(async (rec) => {
          const res = await api.get(`/recordings/${rec._id}/transcript`);
          return { id: rec._id, content: res.data, date: rec.uploadedAt };
        })
      );
      setTranscriptsData(allTranscripts);
    } catch (err) {
      console.error('Error fetching transcripts:', err);
    } finally {
      setTranscriptLoading(false);
    }
  };

  const downloadTranscript = (content, date) => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${interview?.candidateName || 'session'}-${new Date(date).toISOString().slice(0, 16).replace(':', '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const LANG_ICONS = { python: '🐍', javascript: '🟨', java: '☕', c: '🔵', cpp: '🔷' };
  const STATUS_COLORS = {
    'Accepted': '#10b981', 'Wrong Answer': '#ef4444',
    'Runtime Error': '#f59e0b', 'Compilation Error': '#ef4444', 'pending': '#6c63ff',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading session data…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">🎯 InterviewPro</div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* Session Header */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '1.4rem', marginBottom: 8 }}>{interview?.title}</h1>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  👤 {interview?.candidateName || 'Unknown Candidate'}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  📧 {interview?.candidateEmail}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  ⏱ Duration: {formatDuration(interview?.startedAt, interview?.endedAt)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{violations.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Violations</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6c63ff' }}>
                  {submissions.filter(s => s.isSubmission).length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Submissions</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{recordings.filter(r => r.type !== 'transcript').length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Recordings</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', padding: 4, borderRadius: 10, border: '1px solid var(--border)', width: 'fit-content' }}>
          {[
            { id: 'recordings', label: `🎬 Recordings (${recordings.filter(r => r.type !== 'transcript').length})` },
            { id: 'submissions', label: `💻 Code (${submissions.length})` },
            { id: 'violations', label: `⚠ Violations (${violations.length})` },
            { id: 'transcript', label: `📝 Transcript`, onClick: handleTranscriptTab },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={tab.onClick || (() => setActiveTab(tab.id))}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600,
                background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Recordings Tab */}
        {activeTab === 'recordings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {recordings.filter(r => r.type !== 'transcript').length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <p style={{ color: 'var(--text-muted)' }}>No recordings available for this session</p>
              </div>
            ) : recordings.filter(r => r.type !== 'transcript').map((rec) => {
              const icon = rec.type === 'screen' ? '🖥️' : rec.type === 'audio' ? '🎵' : '🎬';
              const label = rec.type === 'screen' ? 'Screen Recording' : rec.type === 'audio' ? 'Audio Recording' : 'Camera Recording';
              return (
                <div key={rec._id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 24 }}>{icon}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(rec.uploadedAt).toLocaleString()} ·{' '}
                          {(rec.fileSize / 1024 / 1024).toFixed(1)} MB
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                    <video
                      controls
                      preload="metadata"
                      style={{ width: '100%', display: 'block', maxHeight: 450 }}
                      src={rec.filePath.startsWith('http') ? rec.filePath : `${BACKEND_URL}${rec.filePath.startsWith('/') ? '' : '/'}${rec.filePath}`}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 24 }}>📝</span>
              <div>
                <div style={{ fontWeight: 600 }}>Speech Transcripts</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Auto-generated from candidate's microphone during the session
                </div>
              </div>
            </div>

            {transcriptLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
            ) : transcriptsData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <p style={{ color: 'var(--text-muted)' }}>No transcripts found for this interview</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {transcriptsData.map((tr, idx) => {
                  let parsed = null;
                  try {
                    parsed = JSON.parse(tr.content);
                  } catch(e) { /* content is plain text */ }

                  return (
                    <div key={tr.id} style={{ borderBottom: idx < transcriptsData.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          FRAGMENT {idx + 1} — {new Date(tr.date).toLocaleString()}
                        </span>
                        <button className="btn btn-ghost btn-xs" onClick={() => downloadTranscript(tr.content, tr.date)}>
                          ⬇ Download
                        </button>
                      </div>
                      
                      {parsed && parsed.segments && parsed.segments.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {parsed.segments.map((seg, sIdx) => (
                            <div key={sIdx} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
                              <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: 4 }}>
                                {new Date(seg.start * 1000).toISOString().substr(14, 5)} - {new Date(seg.end * 1000).toISOString().substr(14, 5)}
                              </div>
                              <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{seg.text}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <pre style={{
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          background: 'var(--bg-secondary)', padding: 16, borderRadius: 8,
                          fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)',
                          border: '1px solid var(--border)', maxHeight: 300, overflowY: 'auto',
                          fontFamily: 'Inter, sans-serif',
                        }}>
                          {parsed && parsed.text ? parsed.text : tr.content}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Code Submissions Tab */}
        {activeTab === 'submissions' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedSubmission ? '280px 1fr' : '1fr', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {submissions.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>No code submissions</p>
                </div>
              ) : submissions.map((sub) => (
                <div
                  key={sub._id}
                  className="card"
                  onClick={() => setSelectedSubmission(selectedSubmission?._id === sub._id ? null : sub)}
                  style={{
                    cursor: 'pointer', padding: '14px 16px',
                    border: selectedSubmission?._id === sub._id ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{LANG_ICONS[sub.language] || '💻'}</span>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{sub.language}</span>
                      {sub.isSubmission && <span className="badge badge-primary">Final Submit</span>}
                    </div>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
                      borderRadius: 20, background: `${STATUS_COLORS[sub.status] || '#6c63ff'}20`,
                      color: STATUS_COLORS[sub.status] || '#a5a0ff',
                      border: `1px solid ${STATUS_COLORS[sub.status] || '#6c63ff'}40`,
                    }}>
                      {sub.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(sub.submittedAt).toLocaleTimeString()} · {sub.time ? `${sub.time}s` : ''}
                  </div>
                </div>
              ))}
            </div>

            {selectedSubmission && (
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span>{LANG_ICONS[selectedSubmission.language]}</span>
                  <h3 style={{ fontSize: '1rem' }}>{selectedSubmission.language} — Source Code</h3>
                </div>
                <pre style={{
                  background: '#0d0d14', padding: 16, borderRadius: 8, overflow: 'auto',
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem',
                  color: '#e8e8f0', border: '1px solid var(--border)', maxHeight: 400,
                }}>
                  {selectedSubmission.sourceCode}
                </pre>
                {selectedSubmission.stdout && (
                  <>
                    <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600, fontSize: '0.85rem' }}>Output:</div>
                    <pre style={{
                      background: '#0a1a0f', padding: 12, borderRadius: 8,
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem',
                      color: '#86efac', border: '1px solid rgba(16,185,129,0.3)', maxHeight: 150,
                    }}>
                      {selectedSubmission.stdout}
                    </pre>
                  </>
                )}
                {selectedSubmission.stderr && (
                  <>
                    <div style={{ marginTop: 12, marginBottom: 8, fontWeight: 600, fontSize: '0.85rem', color: '#fca5a5' }}>Errors:</div>
                    <pre style={{
                      background: '#1a0a0a', padding: 12, borderRadius: 8,
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem',
                      color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)',
                    }}>
                      {selectedSubmission.stderr}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Violations Tab */}
        {activeTab === 'violations' && (
          <div className="card">
            {violations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ color: 'var(--text-muted)' }}>No violations detected during this session</p>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24,
                }}>
                  {['high', 'medium', 'low'].map((sev) => {
                    const count = violations.filter(v => v.severity === sev).length;
                    return (
                      <div key={sev} style={{
                        padding: 14, borderRadius: 10,
                        background: sev === 'high' ? 'rgba(239,68,68,0.1)' : sev === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                        border: `1px solid ${sev === 'high' ? 'rgba(239,68,68,0.3)' : sev === 'medium' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
                        textAlign: 'center',
                      }}>
                        <div style={{
                          fontSize: '1.5rem', fontWeight: 800,
                          color: sev === 'high' ? '#fca5a5' : sev === 'medium' ? '#fcd34d' : '#6ee7b7',
                        }}>{count}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {sev} severity
                        </div>
                      </div>
                    );
                  })}
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Severity</th>
                      <th>Description</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{v.eventType.replace(/_/g, ' ')}</td>
                        <td>
                          <span className={`badge ${v.severity === 'high' ? 'badge-danger' : v.severity === 'medium' ? 'badge-warning' : 'badge-success'}`}>
                            {v.severity}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{v.description}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {new Date(v.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionPlayback;
