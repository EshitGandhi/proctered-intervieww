import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../../components/Layout/AppLayout';
import api from '../../services/api';

// ─── Tab: Job Management ──────────────────────────────────────────────────────
const JobsTab = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', domain: '', description: '', skills: '',
    resumeThreshold: 60, mcqThreshold: 70, codingThreshold: 50,
    resumeWeight: 20, mcqWeight: 20, codingWeight: 30, interviewWeight: 30,
  });

  const fetchJobs = () => {
    api.get('/jobs').then(r => setJobs(r.data.data)).finally(() => setLoading(false));
  };
  useEffect(() => { fetchJobs(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await api.post('/jobs', {
        ...form,
        requiredSkills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      setShowForm(false);
      setForm({ title: '', domain: '', description: '', skills: '', resumeThreshold: 60, mcqThreshold: 70, codingThreshold: 50, resumeWeight: 20, mcqWeight: 20, codingWeight: 30, interviewWeight: 30 });
      fetchJobs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (job) => {
    await api.put(`/jobs/${job._id}`, { isActive: !job.isActive });
    fetchJobs();
  };

  const labelStyle = { fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4, color: 'var(--text-secondary)' };
  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Job Postings</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Create Job'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 20, fontSize: '1rem' }}>New Job Posting</h3>
          {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Job Title *</label>
                <input style={inputStyle} placeholder="e.g. Frontend Engineer" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div>
                <label style={labelStyle}>Domain *</label>
                <input style={inputStyle} placeholder="e.g. Engineering" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} required />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Job Description *</label>
              <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} placeholder="Describe the role..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Required Skills (comma-separated) *</label>
              <input style={inputStyle} placeholder="React, Node.js, MongoDB" value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Resume Threshold (%)</label>
                <input type="number" min="0" max="100" style={inputStyle} value={form.resumeThreshold} onChange={e => setForm(f => ({ ...f, resumeThreshold: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={labelStyle}>MCQ Threshold (%)</label>
                <input type="number" min="0" max="100" style={inputStyle} value={form.mcqThreshold} onChange={e => setForm(f => ({ ...f, mcqThreshold: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={labelStyle}>Coding Threshold (%)</label>
                <input type="number" min="0" max="100" style={inputStyle} value={form.codingThreshold} onChange={e => setForm(f => ({ ...f, codingThreshold: Number(e.target.value) }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
              {['resumeWeight','mcqWeight','codingWeight','interviewWeight'].map(k => (
                <div key={k}>
                  <label style={labelStyle}>{k.replace('Weight','').replace(/([A-Z])/g,' $1')} Weight</label>
                  <input type="number" min="0" max="100" style={inputStyle} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: Number(e.target.value) }))} />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {jobs.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No jobs created yet</div>}
          {jobs.map(job => (
            <div key={job._id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{job.title}</h3>
                  <span className={`badge ${job.isActive ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.65rem' }}>{job.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{job.domain} · Resume ≥{job.resumeThreshold}% · MCQ ≥{job.mcqThreshold}% · Code ≥{job.codingThreshold}%</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {job.requiredSkills.map(s => (
                    <span key={s} style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 20, background: 'var(--primary-light)', color: 'var(--primary)' }}>{s}</span>
                  ))}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => toggle(job)} style={{ flexShrink: 0 }}>
                {job.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Tab: MCQ Management ──────────────────────────────────────────────────────
const MCQTab = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/jobs').then(r => {
      setJobs(r.data.data);
      if (r.data.data.length > 0) setSelectedJob(r.data.data[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    setLoadingPreview(true);
    api.get(`/mcq/admin/${selectedJob}`)
      .then(r => setPreview(r.data.data))
      .catch(() => setPreview([]))
      .finally(() => setLoadingPreview(false));
  }, [selectedJob]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !selectedJob) return;
    setUploading(true); setError(''); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post(`/mcq/upload/${selectedJob}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
      setFile(null);
      // Refresh preview
      const r = await api.get(`/mcq/admin/${selectedJob}`);
      setPreview(r.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedJob) return;
    if (!confirm('Delete all MCQs for this job?')) return;
    await api.delete(`/mcq/${selectedJob}`);
    setPreview([]);
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: '1.2rem' }}>MCQ Management</h2>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'end' }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>Select Job</label>
            <select className="input" value={selectedJob} onChange={e => { setSelectedJob(e.target.value); setResult(null); }}>
              {jobs.map(j => <option key={j._id} value={j._id}>{j.title} ({j.domain})</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {preview.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={handleDelete} style={{ height: 'fit-content' }}>
                Delete All MCQs
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleUpload} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 6 }}>Upload Excel File</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
              Columns: <code>Question, Option A, Option B, Option C, Option D, Correct Answer, Difficulty</code>
            </p>
            <input type="file" accept=".xlsx,.xls" className="input" style={{ padding: 8 }}
              onChange={e => setFile(e.target.files[0])} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={uploading || !file} style={{ flexShrink: 0 }}>
            {uploading ? 'Uploading...' : '⬆ Upload MCQs'}
          </button>
        </form>

        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
        {result && (
          <div className="alert alert-success" style={{ marginTop: 12 }}>
            ✓ {result.message}
            {result.errors?.length > 0 && <div style={{ marginTop: 8, fontSize: '0.78rem' }}>Skipped rows: {result.errors.join(', ')}</div>}
          </div>
        )}
      </div>

      {/* Preview */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Questions ({preview.length})</h3>
        </div>
        {loadingPreview ? <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /></div> : preview.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 10 }}>
            No MCQs uploaded for this job yet
          </div>
        ) : (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['#', 'Question', 'Options', 'Answer', 'Difficulty'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((q, i) => (
                  <tr key={q._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', maxWidth: 280 }}>{q.question}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>{q.options.join(' / ')}</td>
                    <td style={{ padding: '10px 14px', color: '#10b981', fontWeight: 600 }}>{q.correctAnswer}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: '0.68rem', padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize',
                        background: q.difficulty === 'easy' ? '#d1fae5' : q.difficulty === 'hard' ? '#fee2e2' : '#fef9c3',
                        color: q.difficulty === 'easy' ? '#065f46' : q.difficulty === 'hard' ? '#991b1b' : '#713f12',
                        fontWeight: 600,
                      }}>{q.difficulty}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Candidate Management ────────────────────────────────────────────────
const CandidatesTab = ({ onSelectCandidate }) => {
  const [apps, setApps] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ jobId: '', minResume: '', minMcq: '', minCoding: '', status: '' });

  const fetchData = async () => {
    setLoading(true);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    try {
      const [appRes, jobRes] = await Promise.all([
        api.get('/applications/admin/all', { params }),
        api.get('/jobs'),
      ]);
      setApps(appRes.data.data);
      setJobs(jobRes.data.data);
    } catch (err) { /* empty */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const statusColors = {
    applied: '#94a3b8', resume_rejected: '#ef4444', mcq_pending: '#f59e0b',
    mcq_failed: '#ef4444', coding_pending: '#3b82f6', coding_failed: '#ef4444',
    interview_pending: '#8b5cf6', interview_scheduled: '#8b5cf6',
    interview_completed: '#10b981', hired: '#10b981', rejected: '#ef4444',
  };

  const inputStyle = { padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Candidate Management</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{apps.length} candidates</span>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>JOB</label>
            <select style={inputStyle} value={filters.jobId} onChange={e => setFilters(f => ({ ...f, jobId: e.target.value }))}>
              <option value="">All Jobs</option>
              {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>STATUS</label>
            <select style={inputStyle} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Stages</option>
              <option value="resume_rejected">ATS Rejected</option>
              <option value="mcq_pending">MCQ Pending</option>
              <option value="mcq_failed">MCQ Failed</option>
              <option value="coding_pending">Coding Pending</option>
              <option value="interview_pending">Interview Pending</option>
              <option value="interview_scheduled">Interview Scheduled</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>RESUME ≥</label>
            <input type="number" min="0" max="100" style={{ ...inputStyle, width: 80 }} placeholder="%" value={filters.minResume} onChange={e => setFilters(f => ({ ...f, minResume: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>MCQ ≥</label>
            <input type="number" min="0" max="100" style={{ ...inputStyle, width: 80 }} placeholder="%" value={filters.minMcq} onChange={e => setFilters(f => ({ ...f, minMcq: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>CODING ≥</label>
            <input type="number" min="0" max="100" style={{ ...inputStyle, width: 80 }} placeholder="%" value={filters.minCoding} onChange={e => setFilters(f => ({ ...f, minCoding: e.target.value }))} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={fetchData}>Apply Filters</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilters({ jobId: '', minResume: '', minMcq: '', minCoding: '', status: '' }); }}>Reset</button>
        </div>
      </div>

      {/* Table */}
      {loading ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div> : (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {apps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No candidates match filters</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {['Candidate', 'Job', 'Stage', 'Resume', 'MCQ', 'Coding', 'Final', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apps.map(app => (
                  <tr key={app._id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => onSelectCandidate(app._id)}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{app.candidateId?.name || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{app.candidateId?.email}</div>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{app.jobId?.title}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: statusColors[app.status] || '#94a3b8', background: `${statusColors[app.status]}20`, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                        {app.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{app.scores?.resume?.score || 0}%</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{app.scores?.mcq?.score || 0}%</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{app.scores?.coding?.score || 0}%</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--primary)' }}>{app.scores?.finalScore || 0}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); onSelectCandidate(app._id); }}>View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Tab: Candidate Detail ────────────────────────────────────────────────────
const CandidateDetail = ({ appId, onBack }) => {
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  useEffect(() => {
    api.get(`/applications/${appId}`)
      .then(r => setApp(r.data.data))
      .finally(() => setLoading(false));
  }, [appId]);

  const handleGenerate = async () => {
    setGenerating(true); setGenError('');
    try {
      const { data } = await api.post(`/applications/${appId}/generate-interview`);
      setApp(data.data);
    } catch (err) {
      setGenError(err.response?.data?.error || 'Failed to generate interview');
    } finally {
      setGenerating(false);
    }
  };

  const handleOverride = async (action) => {
    if (!window.confirm('Are you sure you want to perform this override action?')) return;
    setGenerating(true); setGenError('');
    try {
      if (action === 'delete') {
        await api.delete(`/applications/${appId}`);
        onBack(); // go back to candidates list
      } else {
        const { data } = await api.post(`/applications/${appId}/override`, { action });
        setApp(data.data);
      }
    } catch (err) {
      setGenError(err.response?.data?.error || 'Action failed');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>;
  if (!app) return <div>Application not found</div>;

  const scoreBox = (label, score, threshold, extra) => (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 20, textAlign: 'center' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: score >= (threshold || 0) ? '#10b981' : score === 0 ? 'var(--text-muted)' : '#ef4444', lineHeight: 1 }}>{score}%</div>
      {threshold && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>Min: {threshold}%</div>}
      {extra}
    </div>
  );

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 20 }}>← Back to Candidates</button>

      {/* Header */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.4rem', flexShrink: 0 }}>
          {app.candidateId?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{app.candidateId?.name}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{app.candidateId?.email}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Applied for: <strong>{app.jobId?.title}</strong> ({app.jobId?.domain})</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 14px', borderRadius: 20, textTransform: 'capitalize' }}>
            {app.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Admin Overrides */}
      {(app.status === 'resume_rejected' || app.status === 'mcq_failed') && (
        <div className="card" style={{ marginBottom: 20, background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 10, color: '#991b1b' }}>Admin Overrides</h3>
          <p style={{ fontSize: '0.8rem', color: '#7f1d1d', marginBottom: 14 }}>
            Candidate was rejected. You can manually intervene to give them another chance.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => handleOverride('delete')} disabled={generating}>
              {generating ? '...' : '🗑 Delete Application (Allows Re-upload)'}
            </button>
            {app.status === 'resume_rejected' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleOverride('force_mcq')} disabled={generating}>
                📝 Ignore Resume & Allow MCQ
              </button>
            )}
            {app.status === 'mcq_failed' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleOverride('retry_mcq')} disabled={generating}>
                🔄 Allow MCQ Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {scoreBox('Resume', app.scores?.resume?.score || 0, app.jobId?.resumeThreshold)}
        {scoreBox('MCQ', app.scores?.mcq?.score || 0, app.jobId?.mcqThreshold)}
        {scoreBox('Coding', app.scores?.coding?.score || 0, app.jobId?.codingThreshold)}
        {scoreBox('Final Score', app.scores?.finalScore || 0, null)}
      </div>

      {/* Resume detail */}
      {app.scores?.resume?.matchedSkills?.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Resume Analysis</h3>
            {app.scores?.resume?.resumeUrl && (
              <a
                href={`${api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000'}${app.scores.resume.resumeUrl}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                📄 View Resume
              </a>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', marginBottom: 8, textTransform: 'uppercase' }}>Matched Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {app.scores.resume.matchedSkills.map(s => (
                  <span key={s} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, background: '#d1fae5', color: '#065f46', fontWeight: 600 }}>✓ {s}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', marginBottom: 8, textTransform: 'uppercase' }}>Missing Skills</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {app.scores.resume.missingSkills.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None</span>
                ) : app.scores.resume.missingSkills.map(s => (
                  <span key={s} style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>✗ {s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interview section */}
      <div className="card">
        <h3 style={{ fontSize: '0.95rem', marginBottom: 14 }}>Interview Stage</h3>

        {app.scores?.interview?.interviewId ? (
          <div>
            <div className="alert alert-success" style={{ marginBottom: 14 }}>
              Interview session provisioned · Status: <strong>{app.scores.interview.interviewId.status || 'scheduled'}</strong>
            </div>
            {app.scores.interview.interviewId.roomId && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={() => navigate(`/monitor/${app.scores.interview.interviewId.roomId}`)}>
                  Join as Interviewer
                </button>
                <button className="btn btn-secondary" onClick={() => navigate(`/playback/${app.scores.interview.interviewId._id}`)}>
                  View Recording / Transcript
                </button>
              </div>
            )}
          </div>
        ) : app.status === 'interview_pending' ? (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 14 }}>
              This candidate has passed all rounds and is awaiting an interview session.
            </p>
            {genError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{genError}</div>}
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating...' : '🎥 Generate Interview Session'}
            </button>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Candidate has not yet reached the interview stage.
          </p>
        )}
      </div>
    </div>
  );
};

// ─── Admin Dashboard Shell ─────────────────────────────────────────────────────
const AdminDashboard = () => {
  const [tab, setTab] = useState('jobs');
  const [selectedAppId, setSelectedAppId] = useState(null);

  const nav = [
    { id: 'jobs', label: '💼 Jobs' },
    { id: 'mcq', label: '📝 MCQ' },
    { id: 'candidates', label: '👥 Candidates' },
  ];

  const handleSelectCandidate = (appId) => {
    setSelectedAppId(appId);
    setTab('detail');
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, marginBottom: 4 }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage jobs, questions, and the hiring pipeline</p>
        </div>

        {/* Top nav tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 28, gap: 4 }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => { setTab(n.id); setSelectedAppId(null); }} style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: tab === n.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: tab === n.id ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>{n.label}</button>
          ))}
          {selectedAppId && (
            <button onClick={() => setTab('detail')} style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: tab === 'detail' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: tab === 'detail' ? 'var(--primary)' : 'var(--text-muted)',
            }}>🔍 Candidate Detail</button>
          )}
        </div>

        {tab === 'jobs' && <JobsTab />}
        {tab === 'mcq' && <MCQTab />}
        {tab === 'candidates' && <CandidatesTab onSelectCandidate={handleSelectCandidate} />}
        {tab === 'detail' && selectedAppId && (
          <CandidateDetail appId={selectedAppId} onBack={() => setTab('candidates')} />
        )}
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
