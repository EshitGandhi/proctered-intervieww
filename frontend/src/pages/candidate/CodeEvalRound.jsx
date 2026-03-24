import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CodeEditor from '../../components/CodeEditor/CodeEditor';
import CodeRunnerPanel from '../../components/CodeEditor/CodeRunnerPanel';
import api from '../../services/api';

const CodeEvalRound = () => {
  const { appId } = useParams();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [code, setCode] = useState('// Write your solution here\n\nfunction solve() {\n  \n}\n');
  const [language, setLanguage] = useState('javascript');
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const initPhase = async () => {
      try {
        const { data: appData } = await api.get('/applications/my');
        const app = appData.data.find(a => a._id === appId);
        
        if (!app) return setError('Application not found');
        if (app.status !== 'coding_pending') return setError(`Phase not active. Current status: ${app.status}`);

        setApplication(app);
      } catch (err) {
        setError('Failed to initialize coding round.');
      } finally {
        setLoading(false);
      }
    };
    initPhase();
  }, [appId]);

  const handleSubmitScore = async () => {
    // In a real sophisticated platform, you would run the code against 
    // hidden test cases here using Judge0, calculate percentage passed, etc.
    // For this demonstration, we'll simulate a score based on a simple validation.
    
    setEvaluating(true);
    try {
      // Dummy check: code length > 50 gives a 100%, else 40% (fail)
      // Real app: await api.post('/code/execute', { source_code, testCases... })
      const simulatedScore = code.length > 50 ? 100 : 40;
      
      const { data } = await api.post(`/applications/${appId}/coding`, { score: simulatedScore });
      
      setResult({
        success: data.success,
        message: data.message,
        appData: data.data,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit code');
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;
  if (error) return <div className="card" style={{ maxWidth: 600, margin: '40px auto' }}><div className="alert alert-danger">{error}</div><button className="btn btn-secondary mt-2" onClick={() => navigate('/dashboard')}>Go Back</button></div>;

  if (result) {
    const passed = result.appData.scores.coding.score >= application.jobId.codingThreshold;
    return (
      <div className="card" style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{passed ? '🎉' : '❌'}</div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Coding Round Evaluated</h2>
        <div className={`alert ${passed ? 'alert-success' : 'alert-danger'}`}>
          <strong>Score: {result.appData.scores.coding.score}%</strong> (Required: {application.jobId.codingThreshold}%)<br/>
          {result.message}
        </div>
        <div style={{ marginTop: 24 }}>
          {passed ? (
            <div style={{ textAlign: 'left', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
              <h3 style={{ marginBottom: 12 }}>Next Step: Interview</h3>
              <p style={{ color: 'var(--text-muted)' }}>You have passed all pre-screening rounds! An admin will review your profile and generate an interview link soon. You can check your application pipeline for updates.</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Return Home</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, background: 'var(--bg-surface)', padding: '16px 24px', borderRadius: 8, border: '1px solid var(--border)' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Coding Assessment: {application.jobId.title}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Write an algorithm to solve the provided problem. Your code will be evaluated.</div>
        </div>
        <div>
          <button 
            className="btn btn-success" 
            onClick={handleSubmitScore} 
            disabled={evaluating}
          >
            {evaluating ? 'Evaluating...' : 'Submit Code for Evaluation'}
          </button>
        </div>
      </div>

      {/* Editor Layout */}
      <div style={{ flex: 1, display: 'flex', gap: 20, minHeight: 0 }}>
        {/* Left Side: Problem Statement (Mocked for now) */}
        <div className="card" style={{ flex: '1', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <h3 style={{ marginBottom: 16 }}>Programming Challenge</h3>
          <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to <code>target</code>.</p>
          <p>You may assume that each input would have exactly one solution, and you may not use the same element twice.</p>
          <p>You can return the answer in any order.</p>

          <h4 style={{ marginTop: 24, marginBottom: 8 }}>Example 1:</h4>
          <pre style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6 }}>
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
          </pre>
        </div>

        {/* Right Side: Code Editor */}
        <div style={{ flex: '2', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>Code Editor</span>
            <select 
              className="input" 
              style={{ width: 'auto', padding: '4px 8px' }}
              value={language}
              onChange={e => setLanguage(e.target.value)}
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>
          </div>
          <div style={{ flex: 1, minHeight: 400 }}>
            <CodeEditor
              code={code}
              language={language}
              onChange={setCode}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEvalRound;
