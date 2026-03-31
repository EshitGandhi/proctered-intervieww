import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../../services/api';

import { DEFAULT_CODE } from '../../hooks/useCodeExecution';

const LANGUAGES = [
  { id: 'python', label: 'Python', monacoLang: 'python' },
  { id: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
  { id: 'java', label: 'Java', monacoLang: 'java' },
  { id: 'c', label: 'C', monacoLang: 'c' },
  { id: 'cpp', label: 'C++', monacoLang: 'cpp' },
];

const DIFF_COLORS = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };

const CodeEvalRound = () => {
  const { appId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]); // [{ _id, title, description, difficulty, constraints, testCases }]
  const [activeQ, setActiveQ] = useState(0);

  // Per-question state: { [qIndex]: { language, code, running, runResult } }
  const [qState, setQState] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null); // in seconds
  const timerRef = useRef(null);

  // Load questions on mount
  useEffect(() => {
    const init = async () => {
      try {
        // First check if this application is actually in coding_pending
        const { data: appData } = await api.get('/applications/my');
        const app = (appData.data || []).find(a => a._id === appId);
        if (!app) { setError('Application not found.'); setLoading(false); return; }
        if (app.status !== 'coding_pending') {
          setError(`Coding round not active. Current status: ${app.status}`);
          setLoading(false);
          return;
        }
        // Load 3 random questions
        const { data: qData } = await api.get('/coding-questions/round');
        const qs = qData.data || [];
        if (qs.length === 0) {
          setError('No coding questions have been set up yet. Please ask your admin to add questions.');
          setLoading(false);
          return;
        }
        setQuestions(qs);
        // Set timer based on job.codingDuration
        if (app.jobId?.codingDuration) {
          setTimeLeft(app.jobId.codingDuration * 60);
        } else {
          setTimeLeft(60 * 60); // Default 60 mins if not set
        }

        // Initialize per-question state: { language, code, running, submitted, submitResult }
        const init = {};
        qs.forEach((q, i) => { 
          const lang = 'python';
          const tpl = q.templates?.find(t => t.language === lang);
          const initialCode = tpl?.starterCode || DEFAULT_CODE[lang] || '';
          init[i] = { language: lang, code: initialCode, running: false, runResult: null, submitted: false, submitResult: null }; 
        });
        setQState(init);
      } catch (e) {
        setError('Failed to load coding round.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [appId]);

  // Timer Effect
  useEffect(() => {
    if (loading || result || timeLeft === null) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinishTest(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [loading, result, timeLeft === null]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updateQ = (idx, patch) => setQState(s => ({ ...s, [idx]: { ...s[idx], ...patch } }));

  const handleRunCode = async (idx) => {
    const q = qState[idx];
    if (q.submitted) return;
    const question = questions[idx];
    updateQ(idx, { running: true, runResult: null });
    try {
      const { data } = await api.post('/code/run-with-tests', {
        questionId: question._id,
        language: q.language,
        sourceCode: q.code,
      });

      const { results, firstError } = data.data;

      if (firstError && !results.some(r => r.passed)) {
        updateQ(idx, {
          running: false,
          runResult: {
            type: 'error_with_results',
            results,
            errorType: firstError.errorType,
            errorMsg: firstError.errorMsg,
          }
        });
      } else {
        updateQ(idx, { running: false, runResult: { type: 'testcases', results } });
      }
    } catch (e) {
      const errMsg = e.response?.data?.message || e.message || 'Execution failed';
      updateQ(idx, { running: false, runResult: { type: 'error', message: errMsg } });
    }
  };


  const handleSubmitQuestion = async (idx) => {
    const q = qState[idx];
    const question = questions[idx];
    if (!window.confirm('Submit this code for evaluation? You will not be able to edit it anymore.')) return;
    updateQ(idx, { running: true, runResult: null });
    try {
      const { data } = await api.post(`/applications/${appId}/coding/evaluate`, { 
        questionId: question._id, 
        language: q.language, 
        sourceCode: q.code 
      });
      updateQ(idx, { 
        submitted: true, 
        running: false, 
        runResult: { type: 'testcases', results: data.results },
        submitResult: { testsPassed: data.testsPassed, testsTotal: data.testsTotal }
      });
    } catch (e) {
      updateQ(idx, { running: false, runResult: { type: 'error', message: 'Evaluation failed. Please try again.' } });
    }
  };

  const handleFinishTest = async (auto = false) => {
    const submittedCount = Object.values(qState).filter(q => q.submitted).length;
    if (!auto) {
      if (submittedCount < questions.length) {
        if (!window.confirm(`You have only submitted ${submittedCount}/${questions.length} questions. Are you sure you want to finish the test? Unsubmitted questions will count as 0%.`)) return;
      } else {
        if (!window.confirm('Are you sure you want to finalize your test and submit all results?')) return;
      }
    }

    setSubmitting(true);
    try {
      const submissions = questions.map((q, i) => ({
        questionId: q._id,
        language: qState[i]?.language || 'python',
        sourceCode: qState[i]?.code || '',
      }));
      const { data } = await api.post(`/applications/${appId}/coding`, { submissions });
      setResult(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Final submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: 'var(--bg-primary)' }}>
      <div className="spinner" />
      <h2 style={{ color: 'var(--accent-primary)', fontWeight: 600, fontSize: '1.2rem', margin: 0 }}>Loading your coding round...</h2>
    </div>
  );

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
      <div className="card" style={{ maxWidth: 500, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <div className="alert alert-danger">{error}</div>
        <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
      </div>
    </div>
  );

  // ─── Result Screen ─────────────────────────────────────────────────────────
  if (result) {
    const passed = result.data?.status === 'interview_pending';
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: 24 }}>
        <div className="card" style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{passed ? '🎉' : '😞'}</div>
          <h2 style={{ marginBottom: 8 }}>{passed ? 'Coding Round Passed!' : 'Coding Round Failed'}</h2>
          <div className={`alert ${passed ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: 20, fontSize: '1.05rem', fontWeight: 600 }}>
            Score: {result.score}%
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>{result.message}</p>

          {/* Per question breakdown */}
          {result.results && result.results.length > 0 && (
            <div style={{ textAlign: 'left', marginBottom: 20 }}>
              {result.results.map((qr, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Q{i + 1}: {qr.title}</div>
                  <div style={{ fontSize: '0.82rem', color: qr.testsPassed === qr.testsTotal ? '#10b981' : '#ef4444' }}>
                    {qr.testsPassed}/{qr.testsTotal} test cases passed
                  </div>
                </div>
              ))}
            </div>
          )}

          {passed && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, marginBottom: 20, textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 6px' }}>🎯 What's Next?</h4>
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

  const currentQ = questions[activeQ];
  const currentQState = qState[activeQ] || { language: 'python', code: '', running: false, runResult: null };
  const allAttempted = questions.every((_, i) => (qState[i]?.code || '').trim().length > 10);

  // ─── Main IDE Layout ──────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ flexShrink: 0, padding: '10px 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>💻 Coding Round</span>
          <div style={{ background: timeLeft < 300 ? '#fee2e2' : 'var(--bg-secondary)', color: timeLeft < 300 ? '#ef4444' : 'var(--text-primary)', padding: '4px 12px', borderRadius: 6, fontWeight: 700, fontSize: '0.9rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>⏱</span> {formatTime(timeLeft)}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{questions.length} Question{questions.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Question tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {questions.map((q, i) => {
            const state = qState[i] || {};
            const attempted = (state.code || '').trim().length > 10;
            const submitted = state.submitted;
            return (
              <button key={i} onClick={() => setActiveQ(i)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: '0.82rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: activeQ === i ? '#2563eb' : submitted ? '#10b98120' : 'var(--bg-secondary)',
                color: activeQ === i ? '#ffffff' : submitted ? '#10b981' : 'var(--text-primary)',
                outline: activeQ === i ? 'none' : submitted ? '1px solid #10b981' : 'none',
                boxShadow: activeQ === i ? '0 4px 6px -1px rgba(37, 99, 235, 0.4)' : 'none',
                transition: 'all 0.2s'
              }}>
                Q{i + 1} {submitted ? '✓' : attempted ? '…' : ''}
              </button>
            );
          })}
        </div>

        {/* Finish button */}
        <button
          className="btn btn-primary"
          style={{ minWidth: 140, background: '#10b981', border: 'none' }}
          onClick={handleFinishTest}
          disabled={submitting}
        >
          {submitting ? '⏳ Finalizing…' : '🏁 Finish Test'}
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.2fr', overflow: 'hidden' }}>

        {/* Left: Problem Statement */}
        <div style={{ overflow: 'auto', padding: 20, borderRight: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Q{activeQ + 1}. {currentQ.title}</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: DIFF_COLORS[currentQ.difficulty], background: `${DIFF_COLORS[currentQ.difficulty]}20`, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
              {currentQ.difficulty}
            </span>
          </div>

          <p style={{ fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', marginBottom: 20 }}>
            {currentQ.description}
          </p>

          {currentQ.constraints?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Constraints</div>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                {currentQ.constraints.map((c, i) => <li key={i} style={{ fontSize: '0.85rem', marginBottom: 4 }}>{c}</li>)}
              </ul>
            </div>
          )}

          {currentQ.testCases?.filter(tc => !tc.isHidden).length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Examples</div>
              {currentQ.testCases.filter(tc => !tc.isHidden).map((tc, i) => (
                <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: '0.85rem' }}>
                  <div style={{ marginBottom: 6 }}><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Input:</span>
                    <pre style={{ margin: '4px 0 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{tc.input}</pre>
                  </div>
                  <div><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Expected Output:</span>
                    <pre style={{ margin: '4px 0 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#10b981' }}>{tc.expectedOutput}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Editor + Output */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Editor toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <select
              className="input select"
              style={{ width: 130, padding: '5px 10px' }}
              value={currentQState.language}
              onChange={e => {
                const newLang = e.target.value;
                const qq = questions[activeQ];
                const tpl = qq?.templates?.find(t => t.language === newLang);
                updateQ(activeQ, { language: newLang, code: tpl?.starterCode || DEFAULT_CODE[newLang] || '' });
              }}
              disabled={currentQState.submitted}
            >
              {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <div style={{ flex: 1 }}>
              {currentQState.submitted && (
                <span style={{ color: '#10b981', fontSize: '0.82rem', fontWeight: 700 }}>
                  ✅ Submitted ({currentQState.submitResult?.testsPassed}/{currentQState.submitResult?.testsTotal} test cases passed)
                </span>
              )}
            </div>
            {!currentQState.submitted ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleRunCode(activeQ)} disabled={currentQState.running}>
                  {currentQState.running ? '⏳ Running…' : '▶ Run Code'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => handleSubmitQuestion(activeQ)} disabled={currentQState.running}>
                  🚀 Submit Question
                </button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" disabled>Locked</button>
            )}
          </div>

          {/* Monaco Editor — key=activeQ forces full re-mount on question switch */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              key={`editor-${activeQ}-${currentQState.language}`}
              height="100%"
              theme="light"
              language={LANGUAGES.find(l => l.id === currentQState.language)?.monacoLang || 'python'}
              value={currentQState.code}
              onChange={val => !currentQState.submitted && updateQ(activeQ, { code: val || '' })}
              options={{ 
                fontSize: 14, 
                minimap: { enabled: false }, 
                automaticLayout: true,
                readOnly: currentQState.submitted
              }}
            />
          </div>

          {/* Run Results */}
          {currentQState.runResult && (
            <div style={{ maxHeight: 240, overflow: 'auto', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg-primary)' }}>

              {/* ── Compiler / Runtime Error Banner ─────────────────────────── */}
              {(currentQState.runResult.type === 'error' || currentQState.runResult.type === 'error_with_results') && (
                <div style={{ margin: 10, padding: '10px 14px', borderRadius: 8, background: '#1c0202', border: '1px solid #ef4444' }}>
                  <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.78rem', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    ⚠ {currentQState.runResult.errorType || 'Execution Error'}
                  </div>
                  <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.78rem', whiteSpace: 'pre-wrap', color: '#fca5a5', lineHeight: 1.6 }}>
                    {currentQState.runResult.message || currentQState.runResult.errorMsg || 'Unknown error occurred.'}
                  </pre>
                </div>
              )}

              {/* ── Test Case Results ───────────────────────────────────────── */}
              {(currentQState.runResult.type === 'testcases' || currentQState.runResult.type === 'error_with_results') && (
                <div style={{ padding: '8px 12px' }}>
                  {currentQState.runResult.results.map((r, i) => (
                    r.hidden ? (
                      // Hidden TC — show ONLY pass/fail, no input/output
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, fontSize: '0.8rem', padding: '6px 10px', background: r.passed ? '#10b98110' : '#ef444410', borderRadius: 6, border: `1px solid ${r.passed ? '#10b98130' : '#ef444430'}` }}>
                        <span style={{ fontWeight: 700, color: r.passed ? '#10b981' : '#ef4444' }}>{r.passed ? '✅' : '❌'}</span>
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Hidden Test Case {i + 1}</span>
                        {r.errorType && !r.passed && <span style={{ fontSize: '0.72rem', color: '#f59e0b', marginLeft: 'auto' }}>{r.errorType}</span>}
                      </div>
                    ) : (
                      // Visible TC — show full detail
                      <div key={i} style={{ marginBottom: 8, fontSize: '0.8rem', padding: '8px 12px', background: r.passed ? '#10b98110' : '#ef444410', borderRadius: 6, border: `1px solid ${r.passed ? '#10b98130' : '#ef444430'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, color: r.passed ? '#10b981' : '#ef4444' }}>{r.passed ? '✅' : '❌'} Test Case {i + 1}</span>
                          {r.errorType && <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4 }}>{r.errorType}</span>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>INPUT</span><pre style={{ margin: '2px 0 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontSize: '0.78rem' }}>{r.input || '(none)'}</pre></div>
                          <div><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>EXPECTED</span><pre style={{ margin: '2px 0 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#10b981', fontSize: '0.78rem' }}>{r.expected}</pre></div>
                        </div>
                        {!r.passed && r.actual !== undefined && (
                          <div style={{ marginTop: 6 }}><span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>YOUR OUTPUT</span><pre style={{ margin: '2px 0 0', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#ef4444', fontSize: '0.78rem' }}>{r.actual || '(no output)'}</pre></div>
                        )}
                        {r.stderr && !r.errorType && (
                          <div style={{ marginTop: 6, color: '#f59e0b', fontSize: '0.72rem' }}>stderr: {r.stderr.slice(0, 120)}</div>
                        )}
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* ── Single run (no test cases) ──────────────────────────────── */}
              {currentQState.runResult.type === 'single' && (
                <div style={{ padding: 12 }}>
                  <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                    {currentQState.runResult.result.stdout || currentQState.runResult.result.stderr || currentQState.runResult.result.compile_output || '(no output)'}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEvalRound;
