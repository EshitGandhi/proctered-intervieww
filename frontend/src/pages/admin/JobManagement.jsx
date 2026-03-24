// Create JobManagement.jsx component inside admin folder
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const INITIAL_JOB_FORM = {
  title: '',
  domain: '',
  description: '',
  requiredSkills: '', // comma separated input
  resumeThreshold: 60,
  mcqThreshold: 70,
  codingThreshold: 50,
  resumeWeight: 20,
  mcqWeight: 20,
  codingWeight: 30,
  interviewWeight: 30,
  isActive: true,
};

const JobManagement = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_JOB_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // MCQ Upload state
  const [uploadJobId, setUploadJobId] = useState(null);
  const [mcqFile, setMcqFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const fetchJobs = async () => {
    try {
      const { data } = await api.get('/jobs');
      setJobs(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleSaveJob = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Sum weights validation
    const totalWeight = Number(form.resumeWeight) + Number(form.mcqWeight) + Number(form.codingWeight) + Number(form.interviewWeight);
    if (totalWeight !== 100) {
      setError(`Weights must sum up to 100. Current sum: ${totalWeight}`);
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...form,
        requiredSkills: form.requiredSkills.split(',').map(s => s.trim()).filter(s => s),
      };

      if (form._id) {
        await api.put(`/jobs/${form._id}`, payload);
      } else {
        await api.post('/jobs', payload);
      }

      setShowModal(false);
      setForm(INITIAL_JOB_FORM);
      fetchJobs();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (job) => {
    setForm({
      ...job,
      requiredSkills: job.requiredSkills.join(', '),
    });
    setShowModal(true);
  };

  const handleUploadMCQ = async (e) => {
    e.preventDefault();
    if (!mcqFile || !uploadJobId) return;

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', mcqFile);

    try {
      const res = await api.post(`/mcq/upload/${uploadJobId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult({ success: true, msg: res.data.message });
      setMcqFile(null);
      setTimeout(() => { setUploadJobId(null); setUploadResult(null); }, 3000);
    } catch (err) {
      setUploadResult({ success: false, msg: err.response?.data?.error || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 style={{ fontSize: '1.2rem' }}>Job Postings & ATS Settings</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setForm(INITIAL_JOB_FORM); setShowModal(true); }}>
          + Create New Job
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>
      ) : jobs.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
          <p>No jobs created yet. Create one to start accepting applications.</p>
        </div>
      ) : (
        <div className="grid-list" style={{ display: 'grid', gap: 16 }}>
          {jobs.map(job => (
            <div key={job._id} style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{job.title} <span className={`badge ${job.isActive ? 'badge-success' : 'badge-neutral'}`}>{job.isActive ? 'Active' : 'Draft'}</span></h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Domain: {job.domain}</div>
                  <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
                    <strong>Skills:</strong> {job.requiredSkills.join(', ')}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: '0.8rem' }}>
                    <span title="Resume Threshold">📄 &gt;{job.resumeThreshold}%</span>
                    <span title="MCQ Threshold">📝 &gt;{job.mcqThreshold}%</span>
                    <span title="Code Threshold">💻 &gt;{job.codingThreshold}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(job)}>Edit Job</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setUploadJobId(job._id)}>Upload MCQs (Excel)</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2>{form._id ? 'Edit Job' : 'Create Job'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

            <form onSubmit={handleSaveJob} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Job Title</label>
                  <input className="input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Software Engineer" />
                </div>
                <div className="form-group">
                  <label>Domain</label>
                  <input className="input" required value={form.domain} onChange={e => setForm({...form, domain: e.target.value})} placeholder="e.g. Engineering" />
                </div>
              </div>

              <div className="form-group">
                <label>Job Description</label>
                <textarea className="input" required rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>

              <div className="form-group">
                <label>Required Skills (comma separated)</label>
                <input className="input" required value={form.requiredSkills} onChange={e => setForm({...form, requiredSkills: e.target.value})} placeholder="React, Node.js, MongoDB" />
              </div>

              <h3 style={{ fontSize: '1rem', marginTop: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>ATS Thresholds (Minimum % to pass round)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Resume Fit (%)</label>
                  <input className="input" type="number" min="0" max="100" value={form.resumeThreshold} onChange={e => setForm({...form, resumeThreshold: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>MCQ Score (%)</label>
                  <input className="input" type="number" min="0" max="100" value={form.mcqThreshold} onChange={e => setForm({...form, mcqThreshold: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Coding Score (%)</label>
                  <input className="input" type="number" min="0" max="100" value={form.codingThreshold} onChange={e => setForm({...form, codingThreshold: e.target.value})} />
                </div>
              </div>

              <h3 style={{ fontSize: '1rem', marginTop: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>Final Score Weights (must sum to 100)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Resume Wt</label>
                  <input className="input" type="number" min="0" max="100" value={form.resumeWeight} onChange={e => setForm({...form, resumeWeight: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>MCQ Wt</label>
                  <input className="input" type="number" min="0" max="100" value={form.mcqWeight} onChange={e => setForm({...form, mcqWeight: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Coding Wt</label>
                  <input className="input" type="number" min="0" max="100" value={form.codingWeight} onChange={e => setForm({...form, codingWeight: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Interview Wt</label>
                  <input className="input" type="number" min="0" max="100" value={form.interviewWeight} onChange={e => setForm({...form, interviewWeight: e.target.value})} />
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({...form, isActive: e.target.checked})} />
                <label style={{ margin: 0 }}>Job is Active and public</label>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary w-full" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MCQ Upload Modal */}
      {uploadJobId && (
        <div className="modal-backdrop" onClick={() => setUploadJobId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2>Upload MCQs for Job</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setUploadJobId(null)}>✕</button>
            </div>

            {uploadResult && (
              <div className={`alert ${uploadResult.success ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: 16 }}>
                {uploadResult.msg}
              </div>
            )}

            <div style={{ marginBottom: 20, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <p>Upload an Excel file (.xlsx) with the following headers:</p>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                <li>Question</li>
                <li>Option A</li>
                <li>Option B</li>
                <li>Option C (optional)</li>
                <li>Option D (optional)</li>
                <li>Correct Answer (Must match the exact text of one option)</li>
                <li>Difficulty (easy, medium, hard)</li>
              </ul>
            </div>

            <form onSubmit={handleUploadMCQ} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                onChange={e => setMcqFile(e.target.files[0])} 
                className="input"
                style={{ padding: '8px' }}
              />
              <button type="submit" className="btn btn-primary" disabled={!mcqFile || uploading}>
                {uploading ? 'Uploading...' : 'Upload & Parse Excel'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobManagement;
