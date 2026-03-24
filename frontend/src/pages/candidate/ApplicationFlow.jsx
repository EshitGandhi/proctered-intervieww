import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const ApplicationFlow = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Phase 1 (Resume)
  const [resume, setResume] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user already has an application for this job
    const checkStatus = async () => {
      try {
        const [jobRes, appRes] = await Promise.all([
          api.get(`/jobs/${jobId}`),
          api.get('/applications/my')
        ]);
        setJob(jobRes.data.data);
        const existingApp = appRes.data.data.find(app => app.jobId._id === jobId);
        if (existingApp) setApplication(existingApp);
      } catch (err) {
        setError('Failed to load job details.');
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, [jobId]);

  const handleApply = async (e) => {
    e.preventDefault();
    if (!resume) return setError('Please upload your resume (PDF)');
    setApplying(true);
    setError('');
    
    const formData = new FormData();
    formData.append('resume', resume);

    try {
      const res = await api.post(`/applications/apply/${jobId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setApplication(res.data.data);
      setApplyResult(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Application failed');
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;
  if (!job) return <div className="card" style={{ maxWidth: 600, margin: '40px auto' }}><h2>Job not found</h2></div>;

  return (
    <div className="card" style={{ maxWidth: 600, margin: '40px auto' }}>
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <h2>Apply for: {job.title}</h2>
        <p style={{ color: 'var(--text-muted)' }}>{job.domain}</p>
      </div>

      {/* PHASE 1: Not applied yet */}
      {!application && (
        <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p>Please upload your resume to begin. Our ATS will screen it automatically.</p>
          
          {error && <div className="alert alert-danger">{error}</div>}
          
          <div className="form-group">
            <label>Resume (PDF only)</label>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={e => setResume(e.target.files[0])} 
              className="input" 
              style={{ padding: 8 }}
            />
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={applying || !resume}>
            {applying ? 'Uploading & Processing...' : 'Submit Application'}
          </button>
        </form>
      )}

      {/* RESULT / PIPELINE STATUS */}
      {application && (
        <div>
          {applyResult && <div className="alert alert-success" style={{ marginBottom: 24 }}>{applyResult}</div>}
          
          <h3 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Application Status</h3>
          
          {/* Status mapping */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className={`alert ${application.status === 'resume_rejected' ? 'alert-danger' : 'alert-success'}`}>
              <strong>Resume Screening (ATS):</strong> {application.status === 'resume_rejected' ? `Rejected (Score: ${application.scores?.resume?.score}%)` : `Passed (Score: ${application.scores?.resume?.score}%)`}
            </div>

            {application.status !== 'resume_rejected' && (
              <div className="alert" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <strong>MCQ Round:</strong> 
                {application.status === 'mcq_pending' && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: '0.9rem', marginBottom: 12 }}>Ready for the written test.</p>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/mcq/${application._id}`)}>Start MCQ Test</button>
                  </div>
                )}
                {application.status.includes('mcq_pass') && <span style={{ color: 'var(--success)', marginLeft: 8 }}>Passed ({application.scores?.mcq?.score}%)</span>}
                {application.status.includes('mcq_fail') && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>Failed ({application.scores?.mcq?.score}%)</span>}
              </div>
            )}

            {(application.status === 'coding_pending' || application.status.includes('coding_pass') || application.status.includes('coding_fail')) && (
              <div className="alert" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <strong>Coding Round:</strong>
                {application.status === 'coding_pending' && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: '0.9rem', marginBottom: 12 }}>Solve coding challenges.</p>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate(`/coding/${application._id}`)}>Go to Code Editor</button>
                  </div>
                )}
                {application.status.includes('coding_pass') && <span style={{ color: 'var(--success)', marginLeft: 8 }}>Passed ({application.scores?.coding?.score}%)</span>}
                {application.status.includes('coding_fail') && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>Failed ({application.scores?.coding?.score}%)</span>}
              </div>
            )}

            {(application.status === 'interview_pending' || application.status === 'interview_completed') && (
              <div className="alert alert-success">
                <strong>Final Interview:</strong>
                {application.status === 'interview_pending' ? ' Pending scheduling.' : ' Completed.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationFlow;
