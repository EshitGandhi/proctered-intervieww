import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const MCQTest = () => {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [application, setApplication] = useState(null);
  const [jobId, setJobId] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: selectedOption }
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes (600 seconds)
  
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const initTest = async () => {
      try {
        // App id is in url. First fetch application to get the jobId.
        // We will fetch all applications for User, find the one matching appId
        const { data: appData } = await api.get('/applications/my');
        const app = appData.data.find(a => a._id === appId);
        
        if (!app) return setError('Application not found');
        if (app.status !== 'mcq_pending') return setError(`Phase not active. Current status: ${app.status}`);

        setApplication(app);
        setJobId(app.jobId._id);

        const { data: mcqData } = await api.get(`/mcq/test/${app.jobId._id}?limit=20`);
        setQuestions(mcqData.data);
      } catch (err) {
        setError('Failed to fetch test. Contact admin.');
      } finally {
        setLoading(false);
      }
    };
    initTest();
  }, [appId]);

  // Timer
  useEffect(() => {
    if (loading || result || error) return;
    if (timeLeft <= 0) {
      handleSubmit(); // auto submit
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, loading, result, error]);

  const handleSelect = (qId, option) => {
    setAnswers(prev => ({ ...prev, [qId]: option }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSubmitting(true);

    const payload = {
      answers: Object.keys(answers).map(qId => ({
        questionId: qId,
        selectedOption: answers[qId],
      }))
    };

    try {
      const { data } = await api.post(`/applications/${appId}/mcq`, payload);
      setResult({
        success: data.success,
        message: data.message,
        appData: data.data,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Submit failed');
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;
  if (error) return <div className="card" style={{ maxWidth: 600, margin: '40px auto' }}><div className="alert alert-danger">{error}</div><button className="btn btn-secondary mt-2" onClick={() => navigate('/dashboard')}>Go Back</button></div>;

  if (result) {
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{result.appData.scores.mcq.score >= application.jobId.mcqThreshold ? '🎉' : '❌'}</div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Test Submited</h2>
        <div className={`alert ${result.appData.scores.mcq.score >= application.jobId.mcqThreshold ? 'alert-success' : 'alert-danger'}`}>
          <strong>Score: {result.appData.scores.mcq.score}%</strong> (Required: {application.jobId.mcqThreshold}%)<br/>
          {result.message}
        </div>
        <div style={{ marginTop: 24 }}>
          {result.appData.status === 'coding_pending' ? (
            <button className="btn btn-primary" onClick={() => navigate(`/coding/${appId}`)}>Proceed to Coding Round</button>
          ) : (
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Return Home</button>
          )}
        </div>
      </div>
    );
  }

  if (questions.length === 0) return <div className="card" style={{ maxWidth: 600, margin: '40px auto' }}><h2>No questions found for this test. Contact admin.</h2></div>;

  const q = questions[currentQ];

  return (
    <div className="card" style={{ maxWidth: 800, margin: '40px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>MCQ Assessment: {application.jobId.title}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Question {currentQ + 1} of {questions.length}</div>
        </div>
        <div className={`badge ${timeLeft < 60 ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: '1.1rem', padding: '8px 16px' }}>
          ⏱ {formatTime(timeLeft)}
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: '1.1rem', lineHeight: 1.5, marginBottom: 20 }}>{currentQ + 1}. {q.question}</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {q.options.map((opt, i) => (
            <label 
              key={i} 
              style={{ 
                display: 'block', 
                padding: '16px 20px', 
                border: `2px solid ${answers[q._id] === opt ? 'var(--primary)' : 'var(--border)'}`, 
                borderRadius: 8, 
                cursor: 'pointer',
                background: answers[q._id] === opt ? 'var(--primary-light)' : 'var(--bg-secondary)',
                transition: 'all 0.2s',
              }}
            >
              <input 
                type="radio" 
                name={`q-${q._id}`} 
                value={opt} 
                checked={answers[q._id] === opt} 
                onChange={() => handleSelect(q._id, opt)} 
                style={{ marginRight: 16, transform: 'scale(1.2)' }}
              />
              <span style={{ fontSize: '1rem' }}>{opt}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => setCurrentQ(q => Math.max(0, q - 1))} 
          disabled={currentQ === 0 || submitting}
        >
          Previous
        </button>

        {currentQ < questions.length - 1 ? (
          <button 
            className="btn btn-primary" 
            onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))}
            disabled={submitting}
          >
            Next Question
          </button>
        ) : (
          <button 
            className="btn btn-success" 
            onClick={handleSubmit}
            disabled={submitting || Object.keys(answers).length !== questions.length}
          >
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        )}
      </div>
      
      {currentQ === questions.length - 1 && Object.keys(answers).length !== questions.length && (
        <div style={{ textAlign: 'right', marginTop: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Answer all questions to submit.
        </div>
      )}
    </div>
  );
};

export default MCQTest;
