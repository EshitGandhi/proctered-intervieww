import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const CandidatePipeline = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch jobs for the dropdown
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data } = await api.get('/jobs');
        setJobs(data.data);
        if (data.data.length > 0) {
          setSelectedJob(data.data[0]._id);
        }
      } catch (err) {
        console.error('Failed to load jobs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  // Fetch applications when a job is selected
  useEffect(() => {
    if (!selectedJob) return;
    const fetchPipeline = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/applications/job/${selectedJob}`);
        setApplications(data.data);
      } catch (err) {
        console.error('Failed to fetch pipeline', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPipeline();
  }, [selectedJob]);

  const stages = [
    { key: 'applied', label: 'Applied', color: 'var(--bg-secondary)' },
    { key: 'resume_rejected', label: 'ATS Rejected', color: 'var(--danger-light)' },
    { key: 'mcq', label: 'MCQ Stage', color: '#fef08a' }, // yellow-200
    { key: 'coding', label: 'Coding Stage', color: '#bfdbfe' }, // blue-200
    { key: 'interview', label: 'Final Interview', color: '#d9f99d' }, // lime-200
  ];

  const getStageGroup = (status) => {
    if (status === 'applied') return 'applied';
    if (status === 'resume_rejected') return 'resume_rejected';
    if (status.includes('mcq')) return 'mcq';
    if (status.includes('coding')) return 'coding';
    if (status.includes('interview') || status === 'hired' || status === 'rejected') return 'interview';
    return 'applied';
  };

  const getStatusBadge = (status) => {
    if (status.includes('fail') || status === 'resume_rejected' || status === 'rejected') return <span className="badge badge-danger" style={{ fontSize: 10 }}>Failed</span>;
    if (status.includes('pass') || status === 'interview_completed' || status === 'hired') return <span className="badge badge-success" style={{ fontSize: 10 }}>Passed</span>;
    return <span className="badge badge-neutral" style={{ fontSize: 10 }}>Pending</span>;
  };

  if (loading && jobs.length === 0) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;

  return (
    <div className="card" style={{ minHeight: 600 }}>
      {/* Header & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Candidate ATS Pipeline</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ margin: 0, fontWeight: 600 }}>Select Job:</label>
          <select 
            className="input" 
            style={{ width: 250, padding: '6px 12px' }}
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
          >
            {jobs.map(job => (
              <option key={job._id} value={job._id}>{job.title} ({job.domain})</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedJob ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No jobs available. Create a job first.</div>
      ) : loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
      ) : applications.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <p>No candidates have applied for this job yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, 1fr)`, gap: 16, alignItems: 'start' }}>
          {/* Kanban Board Style Pipeline */}
          {stages.map(stage => {
            const applicantsInStage = applications.filter(app => getStageGroup(app.status) === stage.key);
            
            return (
              <div key={stage.key} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, minHeight: 400, border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.9rem', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{stage.label}</span>
                  <span className="badge badge-neutral">{applicantsInStage.length}</span>
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {applicantsInStage.map(app => (
                    <div key={app._id} style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 6, border: `1px solid ${app.status.includes('fail') || app.status.includes('reject') ? 'var(--danger)' : 'var(--border)'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>{app.candidateId?.name || 'Unknown User'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, wordBreak: 'break-all' }}>{app.candidateId?.email}</div>
                      
                      {/* Scores Mini-View */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: '0.75rem', marginBottom: 8 }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: 4 }}>Resume: <strong>{app.scores.resume?.score || 0}%</strong></div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: 4 }}>MCQ: <strong>{app.scores.mcq?.score || 0}%</strong></div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '2px 4px', borderRadius: 4 }}>Code: <strong>{app.scores.coding?.score || 0}%</strong></div>
                        <div style={{ background: 'var(--primary-light)', padding: '2px 4px', borderRadius: 4}}>Total: <strong>{app.scores.finalScore || 0}</strong></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        {getStatusBadge(app.status)}
                        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => alert('Detailed view coming next!')}>View Details</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CandidatePipeline;
