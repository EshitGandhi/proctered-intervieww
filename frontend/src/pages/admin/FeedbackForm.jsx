import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import TopBar from '../../components/Layout/TopBar';

const RATING_OPTIONS = ['Poor', 'Good', 'Best', 'Excellent'];

const FeedbackForm = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [context, setContext] = useState(null);

  // Form State
  const [communication, setCommunication] = useState({ verbal: '', confidence: '' });
  const [techRatings, setTechRatings] = useState({});
  const [improvementFeedback, setImprovementFeedback] = useState('');

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const { data } = await api.get(`/interviews/${interviewId}/feedback-context`);
        setContext(data.data);
        
        // If feedback already exists, pre-fill it
        if (data.data.existingFeedback) {
          const ef = data.data.existingFeedback;
          setCommunication(ef.communication);
          const tr = {};
          ef.technicalSkills.forEach(s => { tr[s.skill] = s.rating; });
          setTechRatings(tr);
          setImprovementFeedback(ef.improvementFeedback);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load interview context');
      } finally {
        setLoading(false);
      }
    };
    fetchContext();
  }, [interviewId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!context) return;

    // Validation
    if (!communication.verbal || !communication.confidence) {
      return alert('Please rate all communication skills');
    }
    
    const requiredSkills = context.job?.requiredSkills || [];
    const missingSkills = requiredSkills.filter(s => !techRatings[s]);
    if (missingSkills.length > 0) {
      return alert(`Please rate all technical skills: ${missingSkills.join(', ')}`);
    }

    if (!improvementFeedback.trim()) {
      return alert('Please provide detailed feedback for candidate improvement');
    }

    setSubmitting(true);
    try {
      const payload = {
        candidateId: context.candidate._id,
        jobId: context.job._id,
        communication,
        technicalSkills: requiredSkills.map(skill => ({
          skill,
          rating: techRatings[skill]
        })),
        improvementFeedback
      };

      await api.post(`/interviews/${interviewId}/feedback`, payload);
      setSuccess(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRatingPills = (value, onChange) => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {RATING_OPTIONS.map(opt => (
        <label 
          key={opt} 
          style={{ 
            padding: '8px 18px', 
            borderRadius: '20px', 
            border: `1px solid ${value === opt ? '#2563eb' : 'var(--border)'}`,
            background: value === opt ? '#2563eb' : 'transparent',
            color: value === opt ? '#ffffff' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: value === opt ? 600 : 400,
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <input 
            type="radio" 
            name={Math.random().toString()} 
            value={opt} 
            checked={value === opt}
            onChange={() => onChange(opt)}
            style={{ display: 'none' }}
          />
          {opt}
        </label>
      ))}
    </div>
  );

  if (loading) return <div className="page-layout"><div className="spinner" style={{ margin: 'auto' }} /></div>;
  if (error) return <div className="page-layout"><div className="glass" style={{ padding: 24, margin: '24px auto', maxWidth: 600 }}><h3>Error</h3><p>{error}</p></div></div>;

  return (
    <div className="page-layout">
      <TopBar title="Candidate Evaluation Feedback" />
      
      <div className="page-content" style={{ maxWidth: 800, margin: '0 auto' }}>
        {success ? (
          <div className="glass fade-in" style={{ padding: 48, textAlign: 'center', borderRadius: 16 }}>
            <div style={{ fontSize: '48px', marginBottom: 16 }}>🎉</div>
            <h2 style={{ marginBottom: 8 }}>Feedback Submitted Successfully</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>The candidate's formal evaluation report is being generated.</p>
            <button className="btn btn-primary" onClick={() => navigate('/admin')}>Return to Dashboard</button>
          </div>
        ) : (
          <form className="glass fade-in" style={{ padding: 32, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 24 }} onSubmit={handleSubmit}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', marginBottom: 4 }}>{context?.candidate?.name}</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{context?.job?.title}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Interview Session Complete</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>Awaiting structured evaluation</div>
              </div>
            </div>

            {/* A. Communication Skills */}
            <section>
              <h3 style={{ fontSize: '1.05rem', marginBottom: 16, color: 'var(--text-secondary)' }}>A. Communication Skills</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>Verbal Communication</div>
                  {renderRatingPills(communication.verbal, (val) => setCommunication({ ...communication, verbal: val }))}
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', marginBottom: 8 }}>Confidence</div>
                  {renderRatingPills(communication.confidence, (val) => setCommunication({ ...communication, confidence: val }))}
                </div>
              </div>
            </section>

            {/* B. Technical Skills */}
            <section>
              <h3 style={{ fontSize: '1.05rem', marginBottom: 16, color: 'var(--text-secondary)' }}>B. Technical Skills</h3>
              {context?.job?.requiredSkills && context.job.requiredSkills.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
                  {context.job.requiredSkills.map(skill => (
                    <div key={skill} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: 12 }}>
                      <div style={{ fontSize: '0.9rem', marginBottom: 8, fontWeight: 500 }}>{skill}</div>
                      {renderRatingPills(techRatings[skill], (val) => setTechRatings(prev => ({ ...prev, [skill]: val })))}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No required skills defined for this job posting.</p>
              )}
            </section>

            {/* C. Candidate Improvement Feedback */}
            <section>
               <h3 style={{ fontSize: '1.05rem', marginBottom: 16, color: 'var(--text-secondary)' }}>C. Summary Feedback</h3>
               
               <div style={{ marginBottom: 16 }}>
                 <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: 8 }}>Candidate Improvement Feedback</label>
                 <textarea
                    className="input"
                    style={{ width: '100%', minHeight: 120, resize: 'vertical' }}
                    placeholder="Provide detailed feedback for candidate improvement..."
                    value={improvementFeedback}
                    onChange={(e) => setImprovementFeedback(e.target.value)}
                    required
                 />
               </div>
            </section>

            <div style={{ marginTop: 16, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button type="button" className="btn btn-outline" onClick={() => navigate('/admin')} disabled={submitting}>Skip for now</button>
               <button type="submit" className="btn btn-primary" disabled={submitting}>
                 {submitting ? 'Generating Report...' : 'Submit Feedback & Generate Report'}
               </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackForm;
