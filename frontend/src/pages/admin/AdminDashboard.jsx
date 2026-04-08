import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../../components/Layout/AppLayout';
import api from '../../services/api';
import { DOMAINS } from '../../utils/constants';

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
    resumeWeight: 30, mcqWeight: 30, codingWeight: 40,
    mcqCount: 20, mcqDuration: 30, codingDuration: 60
  });
  const [showInactive, setShowInactive] = useState(false);

  const [viewMetricsJob, setViewMetricsJob] = useState(null);

  const fetchJobs = () => {
    setLoading(true);
    api.get('/jobs').then(r => setJobs(r.data.data)).finally(() => setLoading(false));
  };

  const handleViewMetrics = (job) => {
    setViewMetricsJob(job);
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
      setForm({ title: '', domain: '', description: '', skills: '', resumeThreshold: 60, mcqThreshold: 70, codingThreshold: 50, resumeWeight: 30, mcqWeight: 30, codingWeight: 40, mcqCount: 20, mcqDuration: 30, codingDuration: 60 });
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

  const filteredJobs = showInactive ? jobs : jobs.filter(j => j.isActive);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Job Postings</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show Deactivated
          </label>
        </div>
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
                <select
                  style={inputStyle}
                  value={form.domain}
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                  required
                >
                  <option value="">— Select Domain —</option>
                  {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
              {['resumeWeight', 'mcqWeight', 'codingWeight'].map(k => (
                <div key={k}>
                  <label style={labelStyle}>{k.replace('Weight', '').replace(/([A-Z])/g, ' $1')} Weight</label>
                  <input type="number" min="0" max="100" style={inputStyle} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: Number(e.target.value) }))} />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>MCQ Questions Count</label>
                <input type="number" min="1" max="100" style={inputStyle} value={form.mcqCount} onChange={e => setForm(f => ({ ...f, mcqCount: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={labelStyle}>MCQ Duration (mins)</label>
                <input type="number" min="1" style={inputStyle} value={form.mcqDuration} onChange={e => setForm(f => ({ ...f, mcqDuration: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={labelStyle}>Coding Duration (mins)</label>
                <input type="number" min="1" style={inputStyle} value={form.codingDuration} onChange={e => setForm(f => ({ ...f, codingDuration: Number(e.target.value) }))} />
              </div>
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
          {filteredJobs.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No {showInactive ? '' : 'active'} jobs found</div>}
          {filteredJobs.map(job => {
            const skillColors = [
              { bg: '#dcfce7', color: '#166534' }, // Green
              { bg: '#fef9c3', color: '#854d0e' }, // Yellow
              { bg: '#ffedd5', color: '#9a3412' }  // Orange
            ];
            return (
              <div key={job._id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, boxShadow: 'var(--shadow)' }}>
                {/* Info Block */}
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{job.title}</h3>
                    {job.isActive && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700 }}>ACTIVE</span>}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{job.domain}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>sdlis</div>
                </div>

                {/* Score Stats Block */}
                <div style={{ display: 'flex', gap: 16, borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '0 24px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <span style={{ fontSize: 14, background: 'var(--bg-tertiary)', padding: 4, borderRadius: 6, border: '1px solid var(--border-bright)' }}>📄</span>
                      + {job.resumeThreshold}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>Resume %</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <span style={{ fontSize: 14, background: '#e0f2fe', padding: 4, borderRadius: 6, border: '1px solid #bae6fd' }}>📝</span>
                      + {job.mcqThreshold}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>MCQ %</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <span style={{ fontSize: 14, background: '#dcfce7', padding: 4, borderRadius: 6, border: '1px solid #bbf7d0' }}>&lt;/&gt;</span>
                      + {job.codingThreshold}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>Code %</div>
                  </div>
                </div>

                {/* Skills Block */}
                <div style={{ flex: '1 1 200px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Skills</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {job.requiredSkills.slice(0, 4).map((s, idx) => {
                      const color = skillColors[idx % skillColors.length];
                      return (
                        <span key={s} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: color.bg, color: color.color }}>{s}</span>
                      );
                    })}
                  </div>
                </div>

                {/* Action Block */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: 140 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleViewMetrics(job)}
                    style={{ width: '100%', fontSize: '0.8rem', padding: '6px 0', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  >
                    👁 View Applicants
                  </button>
                  <button onClick={() => toggle(job)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    {job.isActive ? 'Deactivate ⏻' : 'Activate ⏻'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {viewMetricsJob && (
        <MetricsModal
          job={viewMetricsJob}
          onClose={() => setViewMetricsJob(null)}
        />
      )}
    </div>
  );
};

// ─── Metrics Modal Component ──────────────────────────────────────────────────
const MetricsModal = ({ job, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await api.get(`/applications/job/${job._id}`);
        const apps = res.data.data;

        const data = {
          total: apps.length,
          resume: {
            passed: apps.filter(a => a.status !== 'resume_rejected').length,
            rejected: apps.filter(a => a.status === 'resume_rejected').length,
          },
          mcq: {
            passed: apps.filter(a => !['resume_rejected', 'mcq_pending', 'mcq_failed'].includes(a.status)).length,
            rejected: apps.filter(a => a.status === 'mcq_failed').length,
            pending: apps.filter(a => a.status === 'mcq_pending').length,
          },
          coding: {
            passed: apps.filter(a => ['coding_passed', 'hired', 'rejected'].includes(a.status)).length,
            rejected: apps.filter(a => a.status === 'coding_failed').length,
            pending: apps.filter(a => a.status === 'coding_pending').length,
          },
        };
        setMetrics(data);
      } catch (err) {
        console.error('Failed to fetch metrics', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [job._id]);

  if (!job) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Pipeline Metrics</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{job.title} • {job.domain}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : metrics ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Overall Stat */}
            <div style={{ background: 'var(--accent-gradient)', padding: '24px', borderRadius: 16, color: 'white', textAlign: 'center', boxShadow: '0 10px 25px -5px var(--accent-glow)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Applicants</div>
              <div style={{ fontSize: '3rem', fontWeight: 800, margin: '8px 0' }}>{metrics.total}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Candidates applied for this position</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="card" style={{ padding: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>📄 Resume Round</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Passed ATS</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>{metrics.resume.passed}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rejected</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger)' }}>{metrics.resume.rejected}</span>
                </div>
              </div>

              <div className="card" style={{ padding: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>📝 MCQ Round</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Passed</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>{metrics.mcq.passed}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Failed</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger)' }}>{metrics.mcq.rejected}</span>
                </div>
                {metrics.mcq.pending > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--warning)' }}>{metrics.mcq.pending}</span>
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>&lt;/&gt; Coding Round</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Passed</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>{metrics.coding.passed}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Failed</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger)' }}>{metrics.coding.rejected}</span>
                </div>
                {metrics.coding.pending > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>In Progress</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--warning)' }}>{metrics.coding.pending}</span>
                  </div>
                )}
              </div>


            </div>

            <div style={{ marginTop: 8 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                onClick={() => {
                  window.location.href = `/admin/candidates?jobId=${job._id}`;
                }}
              >
                View Detailed Applicant List →
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>No metrics available</div>
        )}
      </div>
    </div>
  );
};

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
    mcq_failed: '#ef4444', coding_pending: '#3b82f6', coding_passed: '#10b981', coding_failed: '#ef4444',
    hired: '#10b981', rejected: '#ef4444',
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
              {jobs.filter(j => j.isActive).map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
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
              <option value="coding_failed">Coding Failed</option>
              <option value="coding_passed">Coding Passed (Ready)</option>
              <option value="hired">Hired</option>
              <option value="rejected">Rejected</option>
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
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent-primary)' }}>{app.scores?.finalScore || 0}</td>
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
  const [report, setReport] = useState(null);
  const [fetchingReport, setFetchingReport] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const fileInputRef = React.useRef(null);

  const [proctoringLogs, setProctoringLogs] = useState([]);
  const [screenshotModal, setScreenshotModal] = useState(null);

  useEffect(() => {
    api.get(`/applications/${appId}`)
      .then(r => setApp(r.data.data))
      .finally(() => setLoading(false));

    setFetchingReport(true);
    api.get(`/reports/application/${appId}`)
      .then(r => setReport(r.data.data))
      .catch(() => setReport(null))
      .finally(() => setFetchingReport(false));
  }, [appId]);

  useEffect(() => {
    if (appId) {
      api.get(`/proctoring/application/${appId}`)
        .then(r => setProctoringLogs(r.data.data || []))
        .catch(() => { });
    }
  }, [appId]);

  const getViolationsFor = (round) => proctoringLogs.filter(l => l.sessionId === `${round}-${appId}`);

  const renderViolations = (logs, round) => {
    const tabCount = (logs || []).filter(l => l.eventType === 'tab_switch' || l.eventType === 'window_blur').length;
    const faceCount = (logs || []).filter(l => ['no_face_detected', 'multiple_faces', 'face_look_away', 'camera_blocked'].includes(l.eventType)).length;
    const hasViolations = tabCount > 0 || faceCount > 0;

    const refPhotos = (logs || []).filter(l => l.eventType === 'face_reference_captured' && l.screenshot).map(l => ({ src: l.screenshot, time: l.timestamp, label: 'Reference Photo (Round Start)' }));
    const violationPhotos = (logs || []).filter(l => l.eventType !== 'face_reference_captured' && l.screenshot).map(l => ({ src: l.screenshot, time: l.timestamp, label: l.eventType.replace(/_/g, ' ') }));
    const hasPhotos = refPhotos.length > 0 || violationPhotos.length > 0;

    return (
      <div style={{ marginTop: 12, width: '100%', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
        {hasViolations ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 700, background: '#fef3c7', border: '1px solid #fbbf24', padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
              ⚠️ {tabCount} Tab Switch
            </div>
            <div style={{ fontSize: '0.68rem', color: '#b91c1c', fontWeight: 700, background: '#fee2e2', border: '1px solid #fca5a5', padding: '3px 9px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
              📸 {faceCount} Face
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            ✅ No violations
          </div>
        )}
        <button
          className="btn btn-sm"
          style={{
            fontSize: '0.68rem', padding: '4px 12px', marginTop: 4,
            background: hasPhotos ? '#eff6ff' : 'var(--bg-tertiary)',
            color: hasPhotos ? '#1d4ed8' : 'var(--text-muted)',
            border: hasPhotos ? '1px solid #bfdbfe' : '1px solid var(--border)',
            borderRadius: 8, fontWeight: 600, cursor: hasPhotos ? 'pointer' : 'default',
            opacity: hasPhotos ? 1 : 0.55,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (hasPhotos) setScreenshotModal({ round, refPhotos, violationPhotos });
          }}
        >
          🖼️ {hasPhotos ? `View Screenshots (${refPhotos.length + violationPhotos.length})` : 'No Screenshots'}
        </button>
      </div>
    );
  };


  const handleOverride = async (action) => {
    if (!window.confirm('Are you sure you want to perform this override action?')) return;
    setGenerating(true); setGenError('');
    try {
      if (action === 'delete') {
        await api.delete(`/applications/${appId}`);
        onBack();
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

  const handleGenerateReport = async () => {
    const file = fileInputRef.current?.files[0];
    if (!file) return alert('Please select a transcript file (.pdf, .docx, or .txt)');

    setUploading(true);
    setGenError('');

    const formData = new FormData();
    formData.append('transcript', file);
    if (interviewDate) formData.append('interview_date', interviewDate);

    try {
      const { data } = await api.post(`/reports/generate/${appId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 200000, // 200s for HF Space cold-start
      });
      setReport(data.data);
      alert('Report generated successfully!');
    } catch (err) {
      setGenError(err.response?.data?.message || 'Failed to generate report. The AI service may be starting up — please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!report?._id) return;
    try {
      const response = await api.get(`/reports/download/${report._id}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Report_${app.candidateId.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download report');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>;
  if (!app) return <div>Application not found</div>;

  const scoreBox = (label, score, threshold, extra) => (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 20, textAlign: 'center', minHeight: 180, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: '2.2rem', fontWeight: 800, color: score >= (threshold || 0) ? '#10b981' : score === 0 ? 'var(--text-muted)' : '#ef4444', lineHeight: 1 }}>{score}%</div>
      {threshold && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>Min: {threshold}%</div>}
      <div style={{ marginTop: 'auto', width: '100%' }}>{extra}</div>
    </div>
  );

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 20 }}>← Back to Candidates</button>

      {/* Screenshot Lightbox Modal */}
      {screenshotModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setScreenshotModal(null)}
        >
          <div
            style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, maxWidth: 920, width: '100%', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>📷 {screenshotModal.round?.toUpperCase()} Round — Captured Photos</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {screenshotModal.refPhotos.length} reference photo{screenshotModal.refPhotos.length !== 1 ? 's' : ''} • {screenshotModal.violationPhotos.length} violation screenshot{screenshotModal.violationPhotos.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setScreenshotModal(null)}>✕ Close</button>
            </div>

            {screenshotModal.refPhotos.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 6, padding: '2px 8px' }}>👤 Reference Photo — Captured at Round Start</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {screenshotModal.refPhotos.map((photo, i) => (
                    <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid #6ee7b7', background: 'var(--bg-secondary)', boxShadow: '0 4px 12px rgba(16,185,129,0.15)' }}>
                      <img
                        src={photo.src}
                        alt={`Reference ${i + 1}`}
                        style={{ width: '100%', display: 'block', cursor: 'zoom-in' }}
                        onClick={() => window.open(photo.src, '_blank')}
                      />
                      <div style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>⏱️ Round Start Photo #{i + 1}</span>
                        <span style={{ color: '#10b981' }}>{photo.time ? new Date(photo.time).toLocaleTimeString() : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {screenshotModal.violationPhotos.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '2px 8px' }}>🚨 Violation Screenshots ({screenshotModal.violationPhotos.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {screenshotModal.violationPhotos.map((photo, i) => (
                    <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '2px solid #fca5a5', background: 'var(--bg-secondary)', boxShadow: '0 4px 12px rgba(239,68,68,0.12)' }}>
                      <img
                        src={photo.src}
                        alt={`Violation ${i + 1}`}
                        style={{ width: '100%', display: 'block', cursor: 'zoom-in' }}
                        onClick={() => window.open(photo.src, '_blank')}
                      />
                      <div style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ textTransform: 'capitalize', color: '#ef4444' }}>⚠️ {photo.label} #{i + 1}</span>
                        <span>{photo.time ? new Date(photo.time).toLocaleTimeString() : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {screenshotModal.refPhotos.length === 0 && screenshotModal.violationPhotos.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                No screenshots were captured during this round.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.4rem', flexShrink: 0 }}>
          {app.candidateId?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{app.candidateId?.name}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{app.candidateId?.email}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Applied for: <strong>{app.jobId?.title}</strong> ({app.jobId?.domain})</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {app.scores?.resume?.resumeUrl && (
            <a
              href={app.scores.resume.resumeUrl.startsWith('http') ? app.scores.resume.resumeUrl : `${api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000'}${app.scores.resume.resumeUrl}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: 'none', background: 'var(--bg-secondary)' }}
            >
              📄 View Resume
            </a>
          )}
          <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--accent-glow)', color: 'var(--accent-primary)', padding: '4px 14px', borderRadius: 20, textTransform: 'capitalize' }}>
            {app.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Admin Overrides */}
      {['resume_rejected', 'mcq_pending', 'mcq_failed', 'coding_pending', 'coding_failed'].includes(app.status) && (
        <div className="card" style={{ marginBottom: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 10 }}>Admin Controls &amp; Overrides</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
            Manually intervene to progress the candidate or reset scores.
          </p>
          {genError && <div className="alert alert-danger" style={{ marginBottom: 14 }}>{genError}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => handleOverride('delete')} disabled={generating}>
              🗑 Delete Application
            </button>

            {app.status === 'resume_rejected' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleOverride('force_mcq')} disabled={generating}>
                📝 Ignore Resume &amp; Allow MCQ
              </button>
            )}

            {app.status === 'mcq_failed' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleOverride('retry_mcq')} disabled={generating}>
                🔄 Allow MCQ Retry
              </button>
            )}

            {(app.status === 'mcq_pending' || app.status === 'mcq_failed') && (
              <button className="btn btn-secondary btn-sm" onClick={() => handleOverride('skip_mcq')} disabled={generating}>
                ⏩ Skip MCQ Round
              </button>
            )}

            {app.status === 'coding_failed' && (
              <button className="btn btn-primary btn-sm" onClick={() => handleOverride('retry_coding')} disabled={generating}>
                🔄 Allow Coding Retry
              </button>
            )}
          </div>
        </div>
      )}


      {/* Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {scoreBox('Resume', app.scores?.resume?.score || 0, app.jobId?.resumeThreshold)}
        {scoreBox('MCQ', app.scores?.mcq?.score || 0, app.jobId?.mcqThreshold, renderViolations(getViolationsFor('mcq'), 'mcq'))}
        {scoreBox('Coding', app.scores?.coding?.score || 0, app.jobId?.codingThreshold, renderViolations(getViolationsFor('coding'), 'coding'))}
      </div>

      {/* Evaluation Report Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>📋 Interview Evaluation Report</h3>
          {report && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { if (window.confirm('Are you sure you want to re-upload a different transcript? This will override the current report.')) { setReport(null); setInterviewDate(''); } }} style={{ background: 'var(--bg-tertiary)' }}>
                🔄 Replace Transcript
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleDownloadPDF}>
                📥 Download PDF Report
              </button>
            </div>
          )}
        </div>

        {!report ? (
          <div style={{ background: 'var(--bg-secondary)', padding: '24px', borderRadius: 12, border: '2px dashed var(--border)' }}>
            <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
              No evaluation report generated yet. Fill in the details below and upload the interview transcript.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Interview Date */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Interview Date
                </label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={e => setInterviewDate(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: '0.875rem',
                    boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>
              {/* Transcript Upload */}
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Interview Transcript *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.docx,.txt"
                  style={{
                    width: '100%', padding: '8px 0', fontSize: '0.8rem',
                    color: 'var(--text-muted)', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16, border: '1px solid var(--border)' }}>
              ℹ️ Scores (resume, MCQ, coding) and job description are pulled automatically from the candidate's application.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-primary"
                onClick={handleGenerateReport}
                disabled={uploading}
                style={{ padding: '10px 32px', fontSize: '0.95rem' }}
              >
                {uploading ? '⏳ Generating Report (may take ~1 min)...' : '✨ Generate Evaluation Report'}
              </button>
              {uploading && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                  The AI service may take up to a minute on first request. Please wait.
                </p>
              )}
              {genError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>{genError}</p>}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Report meta info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Interview Date</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {report.interview_date || '—'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Experience</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {report.experience || 'Not specified'}
                </div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Final Score</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {report.scores?.final_score ?? 0}%
                </div>
              </div>
            </div>

            {/* Score breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Resume Score', key: 'resume_score', color: '#10b981' },
                { label: 'MCQ Score', key: 'mcq_score', color: '#3b82f6' },
                { label: 'Coding Score', key: 'coding_score', color: '#8b5cf6' },
              ].map(({ label, key, color }) => (
                <div key={key} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{report.scores?.[key] ?? 0}%</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(37,99,235,0.05)', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(37,99,235,0.12)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              ✅ PDF report generated successfully. Click <strong>Download PDF Report</strong> above to view the full AI-generated evaluation.
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

// ─── Tab: Coding Questions ────────────────────────────────────────────────────

const ALL_LANGUAGES = [
  { id: 'cpp',        label: 'C++',        monacoLang: 'cpp',        icon: '⚙️' },
  { id: 'c',          label: 'C',          monacoLang: 'c',          icon: '🔩' },
  { id: 'java',       label: 'Java',       monacoLang: 'java',       icon: '☕' },
  { id: 'javascript', label: 'JavaScript', monacoLang: 'javascript', icon: '🟨' },
  { id: 'python',     label: 'Python',     monacoLang: 'python',     icon: '🐍' },
  { id: 'php',        label: 'PHP',        monacoLang: 'php',        icon: '🐘' },
];

const BLANK_CODES = { cpp: '', c: '', java: '', javascript: '', python: '', php: '' };

const CodingQuestionsTab = () => {
  const [questions, setQuestions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = React.useState({
    title: '', description: '', difficulty: 'medium', constraints: '',
    signature: '',
    mode: 'auto',          // 'auto' | 'manual'
    manualReason: '',      // reason shown when auto falls back to manual
    starterCode: { ...BLANK_CODES },
    driverCode:  { ...BLANK_CODES },
    supportedLanguages: ALL_LANGUAGES.map(l => l.id),
    testCases: [{ input: '', expectedOutput: '', isHidden: false }],
  });

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeLang,    setActiveLang]    = React.useState('cpp');
  const [previewTab,    setPreviewTab]    = React.useState('starter'); // 'starter' | 'driver'
  const [generating,    setGenerating]    = React.useState(false);
  const [overrideMode,  setOverrideMode]  = React.useState(false);    // allow manual edit in auto mode

  const emptyForm = () => ({
    title: '', description: '', difficulty: 'medium', constraints: '',
    signature: '', mode: 'auto', manualReason: '',
    starterCode: { ...BLANK_CODES }, driverCode: { ...BLANK_CODES },
    supportedLanguages: ALL_LANGUAGES.map(l => l.id),
    testCases: [{ input: '', expectedOutput: '', isHidden: false }],
  });

  const fetchQuestions = () => {
    setLoading(true);
    api.get('/coding-questions').then(r => setQuestions(r.data.data)).finally(() => setLoading(false));
  };
  React.useEffect(() => { fetchQuestions(); }, []);

  // ── Generate code from signature ──────────────────────────────────────────
  const handleGenerateCode = async () => {
    if (!form.signature.trim()) return;
    setGenerating(true);
    try {
      const { data } = await api.post('/coding-questions/preview-signature', { signature: form.signature });
      const result = data.data;
      setForm(f => ({
        ...f,
        mode: result.mode,
        manualReason: result.reason || '',
        starterCode: result.mode === 'auto' ? result.starterCode : f.starterCode,
        driverCode:  result.mode === 'auto' ? result.driverCode  : f.driverCode,
      }));
      setOverrideMode(false);
    } catch (err) {
      setForm(f => ({ ...f, mode: 'manual', manualReason: 'Failed to parse signature.' }));
    } finally {
      setGenerating(false);
    }
  };

  // ── Test case helpers ─────────────────────────────────────────────────────
  const addTestCase    = () => setForm(f => ({ ...f, testCases: [...f.testCases, { input: '', expectedOutput: '', isHidden: false }] }));
  const removeTestCase = (i) => setForm(f => ({ ...f, testCases: f.testCases.filter((_, idx) => idx !== i) }));
  const updateTestCase = (i, key, val) => setForm(f => {
    const tcs = [...f.testCases]; tcs[i] = { ...tcs[i], [key]: val }; return { ...f, testCases: tcs };
  });

  const toggleLang = (langId) => {
    setForm(f => {
      const exists = f.supportedLanguages.includes(langId);
      if (exists && f.supportedLanguages.length === 1) return f; // keep at least one
      return { ...f, supportedLanguages: exists ? f.supportedLanguages.filter(l => l !== langId) : [...f.supportedLanguages, langId] };
    });
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const isEffectivelyManual = form.mode === 'manual' || overrideMode;
      const payload = {
        title: form.title,
        description: form.description,
        difficulty: form.difficulty,
        constraints: form.constraints,
        signature: form.signature,
        mode: isEffectivelyManual ? 'manual' : 'auto',
        starterCode: form.starterCode,
        driverCode:  form.driverCode,
        supportedLanguages: form.supportedLanguages,
        testCases: form.testCases,
      };

      if (editing) {
        await api.put(`/coding-questions/${editing}`, payload);
      } else {
        await api.post('/coding-questions', payload);
      }
      setShowForm(false); setEditing(null); setForm(emptyForm()); setOverrideMode(false);
      fetchQuestions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save question');
    } finally { setSaving(false); }
  };

  const handleEdit = (q) => {
    setForm({
      title: q.title,
      description: q.description,
      difficulty: q.difficulty,
      constraints: (q.constraints || []).join('\n'),
      signature: q.signature || '',
      mode: q.mode || 'manual',
      manualReason: !q.signature ? 'Legacy question — no signature available.' : '',
      starterCode: q.starterCode && Object.keys(q.starterCode).length ? { ...BLANK_CODES, ...q.starterCode } : rebuildFromTemplates(q.templates, 'starterCode'),
      driverCode:  q.driverCode  && Object.keys(q.driverCode).length  ? { ...BLANK_CODES, ...q.driverCode  } : rebuildFromTemplates(q.templates, 'driverCode'),
      supportedLanguages: q.supportedLanguages?.length ? q.supportedLanguages : ALL_LANGUAGES.map(l => l.id),
      testCases: q.testCases?.length ? q.testCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput, isHidden: tc.isHidden })) : [{ input: '', expectedOutput: '', isHidden: false }],
    });
    setEditing(q._id); setShowForm(true); setOverrideMode(q.mode === 'manual' || !q.signature);
  };

  const rebuildFromTemplates = (templates, field) => {
    const map = { ...BLANK_CODES };
    (templates || []).forEach(t => { if (t.language) map[t.language] = t[field] || ''; });
    return map;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    await api.delete(`/coding-questions/${id}`);
    fetchQuestions();
  };

  const isManualMode = form.mode === 'manual' || overrideMode;

  // ── Styles ────────────────────────────────────────────────────────────────
  const labelStyle = { fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4, color: 'var(--text-secondary)' };
  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' };
  const diffColor  = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Coding Questions</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Global question bank — 3 random questions are given per coding round</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm()); setEditing(null); setOverrideMode(false); setShowForm(v => !v); }}>
          {showForm ? 'Cancel' : '+ Add Question'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24, padding: 24 }}>
          <h3 style={{ marginBottom: 20, fontSize: '1rem' }}>{editing ? 'Edit Question' : 'New Coding Question'}</h3>
          {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

          <form onSubmit={handleSubmit}>

            {/* ── Section 1: Basic Info ──────────────────────────────────── */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>📋 Question Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Question Title *</label>
                  <input style={inputStyle} placeholder="e.g. Two Sum" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div>
                  <label style={labelStyle}>Difficulty</label>
                  <select style={inputStyle} value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Problem Description *</label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                  placeholder="Describe the problem clearly — include what input is given and what output is expected..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div>
                <label style={labelStyle}>Constraints (one per line, optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }}
                  placeholder="1 ≤ n ≤ 10^4&#10;-10^9 ≤ nums[i] ≤ 10^9"
                  value={form.constraints} onChange={e => setForm(f => ({ ...f, constraints: e.target.value }))} />
              </div>
            </div>

            {/* ── Section 2: Function Signature & Auto Generation ────────── */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>⚡ Auto Driver Code Generation</div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Function Signature</label>
                  <input
                    style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.85rem' }}
                    placeholder="e.g.  int solve(vector<int> nums, int k)"
                    value={form.signature}
                    onChange={e => setForm(f => ({ ...f, signature: e.target.value, mode: 'auto', manualReason: '' }))}
                  />
                  <p style={{ margin: '5px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Supported types: <code>int, long, double, float, bool, string, vector&lt;int&gt;, vector&lt;string&gt;</code>
                  </p>
                </div>
                <div style={{ alignSelf: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '9px 18px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    onClick={handleGenerateCode}
                    disabled={generating || !form.signature.trim()}
                  >
                    {generating ? '⏳ Generating…' : '✨ Generate Code'}
                  </button>
                </div>
              </div>

              {/* Mode badge */}
              {form.mode === 'auto' && !overrideMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ background: '#d1fae5', color: '#065f46', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid #6ee7b7' }}>
                    ✅ Auto Mode — Starter &amp; Driver code generated
                  </span>
                  <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setOverrideMode(true)}>
                    Edit manually
                  </button>
                </div>
              )}
              {(form.mode === 'manual' && form.manualReason) && (
                <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', color: '#92400e', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚠️ <strong>Switched to Manual Mode:</strong> {form.manualReason}
                </div>
              )}
              {overrideMode && form.mode === 'auto' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ✏️ <strong>Manual Override Active</strong> — Editing auto-generated code.
                  <button type="button" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#1e40af', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setOverrideMode(false)}>Discard edits</button>
                </div>
              )}
              {!form.signature && !editing && (
                <div style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  💡 Leave signature empty to write starter and driver code manually (Manual Mode).
                </div>
              )}
              {editing && !form.signature && (
                <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', color: '#92400e', borderRadius: 8, padding: '8px 14px', fontSize: '0.8rem', marginBottom: 10 }}>
                  📂 <strong>Manual Mode (Legacy Question)</strong> — No function signature. Edit starter and driver code below.
                </div>
              )}
            </div>

            {/* ── Section 3: Supported Languages ────────────────────────── */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>🌐 Supported Languages</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ALL_LANGUAGES.map(lang => {
                  const enabled = form.supportedLanguages.includes(lang.id);
                  return (
                    <label key={lang.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: enabled ? 'rgba(37,99,235,0.08)' : 'var(--bg-tertiary)', border: `1px solid ${enabled ? 'var(--accent-primary)' : 'var(--border)'}`, borderRadius: 20, padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600, color: enabled ? 'var(--accent-primary)' : 'var(--text-muted)', transition: 'all 0.15s', userSelect: 'none' }}>
                      <input type="checkbox" checked={enabled} onChange={() => toggleLang(lang.id)} style={{ display: 'none' }} />
                      {lang.icon} {lang.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* ── Section 4: Code Preview / Editor ──────────────────────── */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>💻 Code Templates</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['starter', 'driver'].map(tab => (
                    <button key={tab} type="button" onClick={() => setPreviewTab(tab)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: previewTab === tab ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: previewTab === tab ? '#fff' : 'var(--text-muted)' }}>
                      {tab === 'starter' ? '📝 Starter Code' : '⚙️ Driver Code'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
                {ALL_LANGUAGES.filter(l => form.supportedLanguages.includes(l.id)).map(lang => (
                  <button type="button" key={lang.id} onClick={() => setActiveLang(lang.id)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: activeLang === lang.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: activeLang === lang.id ? '#fff' : 'var(--text-muted)' }}>
                    {lang.icon} {lang.label}
                  </button>
                ))}
              </div>

              {/* Code textarea */}
              {(() => {
                const codeKey = previewTab === 'starter' ? 'starterCode' : 'driverCode';
                const currentCode = form[codeKey][activeLang] || '';
                const canEdit = isManualMode;
                const driverInfo = previewTab === 'driver' ? '// The marker // [[CANDIDATE_CODE]] will be replaced with the candidate\'s code at runtime.' : null;
                return (
                  <div>
                    {driverInfo && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontFamily: 'monospace' }}>{driverInfo}</div>
                    )}
                    <textarea
                      style={{ ...inputStyle, minHeight: 200, fontFamily: 'monospace', fontSize: '0.8rem', background: canEdit ? 'var(--bg-tertiary)' : 'rgba(0,0,0,0.04)', color: canEdit ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: canEdit ? 'text' : 'default', resize: 'vertical' }}
                      value={currentCode}
                      readOnly={!canEdit}
                      placeholder={canEdit ? `Write ${previewTab} code for ${ALL_LANGUAGES.find(l => l.id === activeLang)?.label}...` : 'Generate code from signature above, or switch to manual override.'}
                      onChange={e => {
                        if (!canEdit) return;
                        setForm(f => ({ ...f, [codeKey]: { ...f[codeKey], [activeLang]: e.target.value } }));
                      }}
                    />
                    {!canEdit && currentCode && (
                      <div style={{ textAlign: 'right', marginTop: 4 }}>
                        <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setOverrideMode(true)}>Override &amp; edit manually</button>
                      </div>
                    )}
                    {!currentCode && !canEdit && (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {form.signature ? 'Click "✨ Generate Code" above to auto-fill.' : 'Enter a function signature then click Generate Code, or switch to Manual Mode.'}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ── Section 5: Test Cases ──────────────────────────────────── */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>🧪 Test Cases ({form.testCases.length})</div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addTestCase}>+ Add Test Case</button>
              </div>

              {/* stdin format reminder */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: '0.75rem', color: '#1e40af', lineHeight: 1.6 }}>
                ℹ️ <strong>Input must be raw stdin</strong> — not variable names.<br />
                For <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 4 }}>vector&lt;int&gt; nums, int k</code>: first line = array size, second = space-separated elements, third = <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 4 }}>k</code>.<br />
                Example: <code style={{ background: '#dbeafe', padding: '1px 5px', borderRadius: 4 }}>3↵1 1 1↵2</code> for nums=[1,1,1], k=2
              </div>

              {form.testCases.map((tc, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, marginBottom: 10, alignItems: 'center', background: 'var(--bg-tertiary)', padding: '10px 12px', borderRadius: 8, border: `1px solid ${tc.isHidden ? '#fbbf2440' : 'var(--border)'}` }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Input (stdin) — raw lines only</label>
                    <textarea style={{ ...inputStyle, minHeight: 56, fontFamily: 'monospace', fontSize: '0.8rem' }}
                      placeholder={`e.g. for (vector<int> nums, int k):\n3\n1 1 1\n2`} value={tc.input} onChange={e => updateTestCase(i, 'input', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '0.7rem' }}>Expected Output (stdout)</label>
                    <textarea style={{ ...inputStyle, minHeight: 56, fontFamily: 'monospace', fontSize: '0.8rem' }}
                      placeholder="e.g. 0 1" value={tc.expectedOutput} onChange={e => updateTestCase(i, 'expectedOutput', e.target.value)} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <label style={{ ...labelStyle, fontSize: '0.68rem' }}>Hidden?</label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={tc.isHidden} onChange={e => updateTestCase(i, 'isHidden', e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                    </label>
                    {tc.isHidden && <div style={{ fontSize: '0.6rem', color: '#f59e0b', marginTop: 2 }}>🔒 Hidden</div>}
                  </div>
                  <button type="button" onClick={() => removeTestCase(i)} disabled={form.testCases.length <= 1}
                    style={{ background: form.testCases.length <= 1 ? '#e5e7eb' : '#ef444420', color: form.testCases.length <= 1 ? '#9ca3af' : '#ef4444', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: form.testCases.length <= 1 ? 'default' : 'pointer', fontSize: '0.78rem', alignSelf: 'flex-end' }}>✕</button>
                </div>
              ))}
            </div>

            {/* ── Footer buttons ─────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Mode: <strong style={{ color: isManualMode ? '#f59e0b' : '#10b981' }}>{isManualMode ? '🔴 Manual' : '🟢 Auto'}</strong>
              </span>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(null); setOverrideMode(false); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Update Question' : 'Create Question'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Questions list ───────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
      ) : questions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💻</div>
          <p>No coding questions yet. Click "+ Add Question" to create the first one.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {questions.map(q => {
            const isAuto = q.mode === 'auto';
            const isLegacy = !q.mode && !q.signature;
            const langs = q.supportedLanguages || [];
            return (
              <div key={q._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{q.title}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: diffColor[q.difficulty], background: `${diffColor[q.difficulty]}20`, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{q.difficulty}</span>
                    {isAuto && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', background: '#d1fae5', border: '1px solid #6ee7b7', padding: '2px 8px', borderRadius: 20 }}>🟢 Auto</span>}
                    {!isAuto && !isLegacy && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', background: '#fef3c7', border: '1px solid #fbbf24', padding: '2px 8px', borderRadius: 20 }}>🔴 Manual</span>}
                    {isLegacy && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6b7280', background: '#f3f4f6', border: '1px solid #d1d5db', padding: '2px 8px', borderRadius: 20 }}>📂 Legacy</span>}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{q.testCases?.length || 0} test case{q.testCases?.length !== 1 ? 's' : ''} ({(q.testCases || []).filter(t => t.isHidden).length} hidden)</span>
                  </div>
                  {q.signature && <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '3px 10px', borderRadius: 6, display: 'inline-block', marginBottom: 6 }}>{q.signature}</div>}
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.description}</p>
                  {langs.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                      {langs.map(lang => {
                        const info = ALL_LANGUAGES.find(l => l.id === lang);
                        return info ? (
                          <span key={lang} style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 12 }}>
                            {info.icon} {info.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(q)}>Edit</button>
                  <button className="btn btn-sm" style={{ background: '#ef444420', color: '#ef4444', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }} onClick={() => handleDelete(q._id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Admin Dashboard Shell ─────────────────────────────────────────────────────
const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getTabFromPath = () => {
    const path = location.pathname;
    if (path.includes('mcq')) return 'mcq';
    if (path.includes('candidates')) return 'candidates';
    if (path.includes('coding')) return 'coding';
    return 'jobs';
  };

  const [tab, setTab] = useState(getTabFromPath());
  const [selectedAppId, setSelectedAppId] = useState(null);

  useEffect(() => {
    const routeTab = getTabFromPath();
    if (tab !== routeTab) {
      setTab(routeTab);
      setSelectedAppId(null);
    }
  }, [location.pathname]);

  const nav = [
    { id: 'jobs', label: '💼 Jobs' },
    { id: 'mcq', label: '📝 MCQ' },
    { id: 'coding', label: '💻 Coding Questions' },
    { id: 'candidates', label: '👥 Candidates' },
  ];

  const handleSelectCandidate = (appId) => {
    setSelectedAppId(appId);
    setTab('detail');
  };

  const handleNavTab = (tabId) => {
    setSelectedAppId(null);
    setTab(tabId);
    navigate(`/admin/${tabId}`);
  };

  const handleBack = () => {
    setTab('candidates');
    setSelectedAppId(null);
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, marginBottom: 4 }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage jobs, questions, and the hiring pipeline</p>
        </div>

        {/* Top nav tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 28, gap: 10 }}>
          {nav.map(n => {
            const isActive = tab === n.id;
            return (
              <button key={n.id} onClick={() => handleNavTab(n.id)} style={{
                padding: '8px 16px',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                borderRadius: 8,
                background: isActive ? 'rgba(37,99,235,0.08)' : 'var(--bg-secondary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}>{n.label}</button>
            )
          })}
          {selectedAppId && (
            <button onClick={() => setTab('detail')} style={{
              padding: '8px 16px',
              border: tab === 'detail' ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
              borderRadius: 8,
              background: tab === 'detail' ? 'rgba(37,99,235,0.08)' : 'var(--bg-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: tab === 'detail' ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}>🔍 Candidate Detail</button>
          )}
        </div>

        {tab === 'jobs' && <JobsTab />}
        {tab === 'mcq' && <MCQTab />}
        {tab === 'coding' && <CodingQuestionsTab />}
        {tab === 'candidates' && <CandidatesTab onSelectCandidate={handleSelectCandidate} />}
        {tab === 'detail' && selectedAppId && (
          <CandidateDetail appId={selectedAppId} onBack={handleBack} />
        )}
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
