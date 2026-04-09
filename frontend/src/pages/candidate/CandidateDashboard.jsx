import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/Layout/AppLayout';
import api from '../../services/api';
import { jobSkipsCodingRound } from '../../utils/constants';

// ─── Step Status Badge ────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    pending: { label: 'Pending', color: '#f59e0b', bg: '#fef3c7' },
    locked: { label: 'Locked', color: '#94a3b8', bg: '#f1f5f9' },
    passed: { label: 'Passed', color: '#10b981', bg: '#d1fae5' },
    failed: { label: 'Failed', color: '#ef4444', bg: '#fee2e2' },
    active: { label: 'Ready', color: '#3b82f6', bg: '#dbeafe' },
    scheduled: { label: 'Scheduled', color: '#8b5cf6', bg: '#ede9fe' },
  };
  const s = map[status] || map.locked;
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em',
      color: s.color, background: s.bg,
      padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
    }}>{s.label}</span>
  );
};

// ─── Pipeline Tracker ─────────────────────────────────────────────────────────
const getStepInfo = (app) => {
  const s = app.status;
  const jobActive = app.jobId?.isActive !== false; // treat missing as active
  const skipCoding = jobSkipsCodingRound(app.jobId?.domain);

  const resumeStep = {
    label: 'Resume Screening',
    icon: '📄',
    status: s === 'resume_rejected' ? 'failed'
      : s === 'applied' ? 'active'
      : 'passed',
    score: app.scores?.resume?.score,
    threshold: app.jobId?.resumeThreshold,
    actionLabel: null,
    actionPath: null,
  };

  const mcqStep = {
    label: 'MCQ Test',
    icon: '📝',
    status: s === 'resume_rejected' ? 'locked'
      : s === 'applied' ? 'locked'
      : s === 'mcq_pending' ? 'active'
      : s === 'mcq_failed' ? 'failed'
      : 'passed',
    score: app.scores?.mcq?.score,
    threshold: app.jobId?.mcqThreshold,
    actionLabel: s === 'mcq_pending' && jobActive ? 'Start MCQ Test' : null,
    actionPath: s === 'mcq_pending' && jobActive ? `/mcq/${app._id}` : null,
    jobDeactivated: s === 'mcq_pending' && !jobActive,
  };

  if (skipCoding) {
    return [resumeStep, mcqStep];
  }

  const codingStep = {
    label: 'Coding Round',
    icon: '💻',
    status: ['resume_rejected', 'applied', 'mcq_pending', 'mcq_failed'].includes(s) ? 'locked'
      : s === 'coding_pending' ? 'active'
      : s === 'coding_failed' ? 'failed'
      : 'passed',
    score: app.scores?.coding?.score,
    threshold: app.jobId?.codingThreshold,
    actionLabel: s === 'coding_pending' && jobActive ? 'Open Code Editor' : null,
    actionPath: s === 'coding_pending' && jobActive ? `/coding/${app._id}` : null,
    jobDeactivated: s === 'coding_pending' && !jobActive,
  };

  return [resumeStep, mcqStep, codingStep];
};

const PipelineCard = ({ app, navigate }) => {
  const steps = getStepInfo(app);
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 24,
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
            {app.jobId?.title}
            {app.jobId?.isActive === false && (
              <span style={{ marginLeft: 8, fontSize: '0.65rem', background: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: 20, fontWeight: 700, verticalAlign: 'middle' }}>CLOSED</span>
            )}
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.jobId?.domain}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Applied {new Date(app.createdAt).toLocaleDateString()}
        </div>
      </div>

      {/* Step Tracker */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 12 }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            background: step.status === 'locked' ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            border: `1px solid ${step.status === 'active' || step.status === 'scheduled' ? 'var(--accent-primary)' : step.status === 'failed' ? '#fca5a5' : step.status === 'passed' ? '#6ee7b7' : 'var(--border)'}`,
            borderRadius: 10,
            padding: '16px 14px',
            position: 'relative',
            opacity: step.status === 'locked' ? 0.55 : 1,
            transition: 'all 0.2s',
          }}>
            {/* Step number connector line */}
            {i < steps.length - 1 && (
              <div style={{
                position: 'absolute',
                right: -7, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 12,
                color: 'var(--text-muted)',
                zIndex: 1,
              }}>→</div>
            )}

            <div style={{ fontSize: 24, marginBottom: 8 }}>{step.icon}</div>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 6, color: 'var(--text-primary)' }}>{step.label}</div>
            <StatusBadge status={step.status} />

            {step.score !== undefined && step.score !== null && step.score > 0 && (
              <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Score: <strong style={{ color: 'var(--text-primary)' }}>{step.score}%</strong>
                {step.threshold && <span> / {step.threshold}% req</span>}
              </div>
            )}

            {step.actionLabel && (
              <button
                className="btn btn-primary"
                style={{ marginTop: 12, padding: '6px 12px', fontSize: '0.75rem', width: '100%' }}
                onClick={() => navigate(step.actionPath)}
              >
                {step.actionLabel}
              </button>
            )}

            {/* Show closed notice instead of action button */}
            {step.jobDeactivated && (
              <div style={{ marginTop: 10, fontSize: '0.72rem', color: '#ef4444', fontWeight: 600, lineHeight: 1.4 }}>
                🔒 This job is closed. Test unavailable.
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Job Board Tab ────────────────────────────────────────────────────────────
const JobBoard = ({ myApplications, onApply }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);
  const [resume, setResume] = useState(null);
  const [error, setError] = useState('');
  const [applyTarget, setApplyTarget] = useState(null);

  useEffect(() => {
    api.get('/jobs').then(r => setJobs(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const appliedJobIds = new Set(myApplications.map(a => a.jobId?._id));

  const handleResumeChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      setError("Only resume files (PDF/DOC) are accepted");
      e.target.value = '';
      setResume(null);
      return;
    }
    setError('');
    setResume(file);
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!resume) return setError('Please select your resume PDF');
    const ext = resume.name.split('.').pop().toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      return setError("Only resume files (PDF/DOC) are accepted");
    }
    setApplyingId(applyTarget._id);
    setError('');
    const formData = new FormData();
    formData.append('resume', resume);
    try {
      await api.post(`/applications/apply/${applyTarget._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setApplyTarget(null);
      setResume(null);
      onApply(); // refresh
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Application failed');
    } finally {
      setApplyingId(null);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;

  return (
    <div>
      {jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p>No open positions right now. Check back later!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {jobs.map(job => {
            const alreadyApplied = appliedJobIds.has(job._id);
            return (
              <div key={job._id} style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{job.title}</h3>
                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{job.domain}</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 0, lineHeight: 1.5 }}>
                    {job.description?.substring(0, 180)}{job.description?.length > 180 ? '...' : ''}
                  </p>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {alreadyApplied ? (
                    <span className="badge badge-success" style={{ fontSize: '0.78rem' }}>✓ Applied</span>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => { setApplyTarget(job); setError(''); setResume(null); }}
                    >
                      Apply Now
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Apply Modal */}
      {applyTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: 440, maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Apply for: {applyTarget.title}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setApplyTarget(null)}>✕</button>
            </div>
            <form onSubmit={handleApplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Upload your resume. Our ATS will automatically evaluate it against the job requirements.
              </p>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-group">
                <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Resume (PDF / DOC / DOCX)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeChange}
                  className="input"
                  style={{ padding: 8 }}
                  required
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
                  Only PDF or DOC/DOCX files are accepted
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setApplyTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!!applyingId || !resume}>
                  {applyingId ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const CandidateDashboard = () => {
  const [tab, setTab] = useState('pipeline');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchApplications = async () => {
    try {
      const { data } = await api.get('/applications/my');
      setApplications(data.data);
    } catch (err) { /* empty */ } finally {
      setLoading(false);
    }
  };

  // Initial fetch + re-fetch on tab switch
  useEffect(() => { setLoading(true); fetchApplications(); }, [tab]);

  // Refetch when the user returns to the window (e.g., after admin deletes an application)
  useEffect(() => {
    const onFocus = () => fetchApplications();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) fetchApplications();
    });
    // Also poll every 30s so the dashboard stays in sync
    const poll = setInterval(fetchApplications, 30000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(poll);
    };
  }, []);

  return (
    <AppLayout>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, marginBottom: 4 }}>My Job Portal</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Track your application pipeline or explore new opportunities</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {[
            { id: 'pipeline', label: '🔄 My Applications', count: applications.length },
            { id: 'jobs', label: '💼 Job Board' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 18px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                background: tab === t.id ? 'var(--bg-surface)' : 'transparent',
                color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t.label}{t.count ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'pipeline' && (
          <div>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" /></div>
            ) : applications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
                <h3 style={{ marginBottom: 8 }}>No applications yet</h3>
                <p style={{ marginBottom: 20 }}>Browse the job board and apply to get started</p>
                <button className="btn btn-primary" onClick={() => setTab('jobs')}>Browse Jobs</button>
              </div>
            ) : (
              applications.map(app => (
                <PipelineCard key={app._id} app={app} navigate={navigate} />
              ))
            )}
          </div>
        )}

        {tab === 'jobs' && (
          <JobBoard
            myApplications={applications}
            onApply={() => { fetchApplications(); setTab('pipeline'); }}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default CandidateDashboard;
