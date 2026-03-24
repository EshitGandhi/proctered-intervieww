import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const JobBoard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data } = await api.get('/jobs'); // Assumes backend only returns active jobs for candidates
        setJobs(data.data);
      } catch (err) {
        console.error('Failed to load jobs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  return (
    <div className="card" style={{ maxWidth: 800, margin: '40px auto' }}>
      <div className="card-header">
        <h2 style={{ fontSize: '1.4rem' }}>Open Positions</h2>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>
      ) : jobs.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📫</div>
          <p>No open positions right now. Check back later!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {jobs.map(job => (
            <div key={job._id} style={{ border: '1px solid var(--border)', padding: 20, borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>{job.title}</h3>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{job.domain}</div>
                  <p style={{ marginTop: 12, fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                    {job.description}
                  </p>
                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {job.requiredSkills.map(skill => (
                      <span key={skill} className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>{skill}</span>
                    ))}
                  </div>
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => navigate(`/apply/${job._id}`)}
                >
                  Apply Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JobBoard;
