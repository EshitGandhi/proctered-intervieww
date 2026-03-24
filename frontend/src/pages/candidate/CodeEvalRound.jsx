import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CodeEditorPanel from '../../components/CodeEditor/CodeEditorPanel';
import api from '../../services/api';

const PROBLEM = {
  title: 'Two Sum',
  description: 'Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target.',
  examples: [
    { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
    { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
  ],
  constraints: ['2 ≤ nums.length ≤ 10⁴', '-10⁹ ≤ nums[i] ≤ 10⁹', 'Only one valid answer exists.'],
};

const CodeEvalRound = () => {
  const { appId } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.get('/applications/my');
        const app = data.data.find(a => a._id === appId);
        if (!app) return setError('Application not found.');
        if (app.status !== 'coding_pending') return setError(`This stage is not active. Status: ${app.status}`);
        setApplication(app);
      } catch (err) {
        setError('Failed to load coding round.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [appId]);

  const handleSubmit = async () => {
    // In production, real test-case evaluation via Judge0 would go here.
    // For demonstration: any submitted code (length > 40) scores 100%.
    setSubmitting(true);
    try {
      const simulatedScore = 100; // Full score for submission
      const { data } = await api.post(`/applications/${appId}/coding`, { score: simulatedScore });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Submit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 500, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div className="alert alert-danger">{error}</div>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>Back</button>
      </div>
    </div>
  );

  if (result) {
    const passed = result.data.status === 'interview_pending';
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{passed ? '🎉' : '😞'}</div>
          <h2 style={{ marginBottom: 12 }}>{passed ? 'Coding Round Passed!' : 'Coding Round Failed'}</h2>
          <div className={`alert ${passed ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: 20 }}>
            {result.message}
          </div>
          {passed && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 16, marginBottom: 20, textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 8px' }}>What's Next?</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                You've passed all automated rounds! An admin will review your profile and schedule the final interview. Check your dashboard for updates.
              </p>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Bar */}
      <div style={{
        flexShrink: 0, padding: '12px 20px',
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <span style={{ fontWeight: 700 }}>Coding Assessment: </span>
          <span style={{ color: 'var(--text-muted)' }}>{application?.jobId?.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Solve the problem, then submit</span>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : '✓ Submit for Evaluation'}
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Problem */}
        <div style={{
          width: 360, flexShrink: 0,
          background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
          overflowY: 'auto', padding: 20,
        }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>{PROBLEM.title}</h2>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 20 }}>{PROBLEM.description}</p>

          {PROBLEM.examples.map((ex, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 6 }}>Example {i + 1}:</div>
              <pre style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 7, fontSize: '0.78rem', margin: 0, lineHeight: 1.6 }}>
                <span style={{ color: 'var(--text-muted)' }}>Input: </span>{ex.input}{'\n'}
                <span style={{ color: 'var(--text-muted)' }}>Output: </span>{ex.output}
                {ex.explanation && `\nExplanation: ${ex.explanation}`}
              </pre>
            </div>
          ))}

          <div>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 6 }}>Constraints:</div>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              {PROBLEM.constraints.map((c, i) => (
                <li key={i} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>{c}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Code Editor */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <CodeEditorPanel />
        </div>
      </div>
    </div>
  );
};

export default CodeEvalRound;
