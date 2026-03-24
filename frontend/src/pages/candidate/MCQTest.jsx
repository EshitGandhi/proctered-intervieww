import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

const MCQTest = () => {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutes
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: appData } = await api.get('/applications/my');
        const app = appData.data.find(a => a._id === appId);
        if (!app) return setError('Application not found.');
        if (app.status !== 'mcq_pending') return setError(`This stage is not active. Status: ${app.status}`);
        setApplication(app);
        const { data: mcqData } = await api.get(`/mcq/test/${app.jobId._id}?limit=20`);
        if (mcqData.data.length === 0) return setError('No MCQ questions uploaded for this job yet. Contact Admin.');
        setQuestions(mcqData.data);
      } catch (err) {
        setError('Failed to load test. Try again.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [appId]);

  // Timer
  useEffect(() => {
    if (loading || result || error || questions.length === 0) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, loading, result, error, questions.length]);

  const handleSelect = (qId, option) => setAnswers(prev => ({ ...prev, [qId]: option }));

  const handleSubmit = async () => {
    setSubmitting(true);
    const payload = {
      answers: Object.keys(answers).map(qId => ({ questionId: qId, selectedOption: answers[qId] }))
    };
    try {
      const { data } = await api.post(`/applications/${appId}/mcq`, payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Submit failed. Try again.');
      setSubmitting(false);
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const answered = Object.keys(answers).length;

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 500, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div className="alert alert-danger">{error}</div>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    </div>
  );

  if (result) {
    const passed = result.data.status === 'coding_pending';
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{passed ? '🎉' : '😞'}</div>
          <h2 style={{ marginBottom: 12 }}>{passed ? 'MCQ Passed!' : 'MCQ Failed'}</h2>
          <div className={`alert ${passed ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: 20 }}>
            {result.message}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {passed ? (
              <button className="btn btn-primary" onClick={() => navigate(`/coding/${appId}`)}>Go to Coding Round →</button>
            ) : (
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: 24 }}>
      {/* Header Bar */}
      <div style={{
        maxWidth: 860, margin: '0 auto 24px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '14px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>MCQ Assessment: {application?.jobId?.title}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Q {currentQ + 1} of {questions.length} · {answered} answered
          </div>
        </div>
        <div style={{
          fontWeight: 800, fontSize: '1.4rem',
          color: timeLeft < 60 ? '#ef4444' : timeLeft < 180 ? '#f59e0b' : 'var(--primary)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          ⏱ {fmt(timeLeft)}
        </div>
      </div>

      {/* Question Card */}
      <div className="card" style={{ maxWidth: 860, margin: '0 auto 20px' }}>
        <p style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.6, marginBottom: 24 }}>
          {currentQ + 1}. {q.question}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map((opt, i) => {
            const selected = answers[q._id] === opt;
            return (
              <label key={i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                background: selected ? 'var(--primary-light)' : 'var(--bg-secondary)',
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                  background: selected ? 'var(--primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                </div>
                <input type="radio" name={`q-${q._id}`} value={opt} checked={selected} onChange={() => handleSelect(q._id, opt)} style={{ display: 'none' }} />
                <span style={{ fontSize: '0.925rem' }}>{opt}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0}>← Previous</button>

        {/* Question dots */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', flex: 1, padding: '0 16px' }}>
          {questions.map((_, i) => (
            <div key={i} onClick={() => setCurrentQ(i)} style={{
              width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem', fontWeight: 600,
              background: answers[questions[i]._id] ? 'var(--primary)' : i === currentQ ? 'var(--bg-surface)' : 'var(--bg-secondary)',
              color: answers[questions[i]._id] ? 'white' : 'var(--text-primary)',
              border: i === currentQ ? '2px solid var(--primary)' : '2px solid var(--border)',
            }}>{i + 1}</div>
          ))}
        </div>

        {currentQ < questions.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))}>Next →</button>
        ) : (
          <button className="btn btn-success" onClick={handleSubmit}
            disabled={submitting || answered < questions.length}
            title={answered < questions.length ? `Answer all ${questions.length} questions first` : ''}>
            {submitting ? 'Submitting...' : '✓ Submit Test'}
          </button>
        )}
      </div>
      {answered < questions.length && currentQ === questions.length - 1 && (
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {questions.length - answered} question(s) unanswered
        </div>
      )}
    </div>
  );
};

export default MCQTest;
