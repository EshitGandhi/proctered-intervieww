import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { jobSkipsCodingRound } from '../../utils/constants';
import useTabProctor from '../../hooks/useTabProctor';
import useFaceProctor from '../../hooks/useFaceProctor';
import FaceCheckModal from '../../components/FaceCheckModal';

// ─── Question status helpers ───────────────────────────────────────────────────
const getQStatus = (idx, qId, answers, visited, markedForReview) => {
  if (markedForReview.has(idx)) return 'review';   // purple  (takes priority)
  if (answers[qId])             return 'answered';  // green
  if (visited.has(idx))         return 'visited';   // red
  return 'none';                                    // grey
};

const STATUS = {
  answered : { bg: '#10b981', color: '#fff', border: '#10b981', label: 'Answered'          },
  review   : { bg: '#7c3aed', color: '#fff', border: '#7c3aed', label: 'Marked for Review' },
  visited  : { bg: '#ef4444', color: '#fff', border: '#ef4444', label: 'Not Answered'      },
  none     : { bg: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'var(--border)', label: 'Not Visited' },
};

// ─── Proctor Warning Toast ─────────────────────────────────────────────────────
const ProctoringBanner = ({ msg, isFinal }) => (
  <div style={{
    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
    background: isFinal ? '#1c0a0a' : '#1e1b4b',
    color: '#fff', borderRadius: 12, padding: '14px 28px',
    border: `2px solid ${isFinal ? '#ef4444' : '#7c3aed'}`,
    zIndex: 9999, fontSize: '0.9rem', fontWeight: 600,
    boxShadow: `0 8px 32px ${isFinal ? 'rgba(239,68,68,0.3)' : 'rgba(124,58,237,0.3)'}`,
    maxWidth: 520, textAlign: 'center', pointerEvents: 'none',
  }}>
    {msg}
  </div>
);

// ─── MCQTest Component ────────────────────────────────────────────────────────
const MCQTest = () => {
  const { appId }  = useParams();
  const navigate   = useNavigate();

  // ── Face verification gate ───────────────────────────────────────────────────
  const [faceReady,    setFaceReady]    = useState(false);
  const webcamVideoRef = useRef(null);  // set by FaceCheckModal when candidate starts
  const camStreamRef   = useRef(null);

  useEffect(() => {
    if (faceReady && webcamVideoRef.current && camStreamRef.current) {
      webcamVideoRef.current.srcObject = camStreamRef.current;
      webcamVideoRef.current.play().catch(() => {});
    }
  }, [faceReady]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (camStreamRef.current) {
        camStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // ── Core state ───────────────────────────────────────────────────────────────
  const [application, setApplication] = useState(null);
  const [questions,   setQuestions]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [currentQ,    setCurrentQ]    = useState(0);
  const [answers,     setAnswers]     = useState({});
  const [timeLeft,    setTimeLeft]    = useState(null);
  const [timerReady,  setTimerReady]  = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [result,      setResult]      = useState(null);

  // Turn off camera as soon as we have a result
  useEffect(() => {
    if (result && camStreamRef.current) {
      camStreamRef.current.getTracks().forEach(t => t.stop());
    }
  }, [result]);

  // ── Question tracking state ──────────────────────────────────────────────────
  const [visited,         setVisited]         = useState(new Set()); // indices seen
  const [markedForReview, setMarkedForReview] = useState(new Set()); // indices flagged

  // ── Proctoring UI state ──────────────────────────────────────────────────────
  const [proctorMsg,   setProctorMsg]   = useState(null);
  const [proctorFinal, setProctorFinal] = useState(false);
  const msgTimerRef = useRef(null);

  // ── Stable submit ref (avoid stale closures in timer / proctor hook) ─────────
  const submitRef = useRef(null);

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data: appData } = await api.get('/applications/my');
        const app = appData.data.find(a => a._id === appId);

        if (!app)                            return setError('Application not found.');
        if (app.status !== 'mcq_pending')    return setError(`This stage is not active. Status: ${app.status}`);
        if (app.jobId?.isActive === false)   return setError('This job posting has been deactivated by the admin.');

        setApplication(app);
        setTimeLeft((app.jobId?.mcqDuration || 30) * 60);

        const { data: mcqData } = await api.get(`/mcq/test/${app.jobId._id}?limit=20`);
        if (!mcqData.data.length) return setError('No MCQ questions uploaded for this job yet. Contact Admin.');

        setQuestions(mcqData.data);
        setTimerReady(true); // start timer only after everything is loaded
      } catch {
        setError('Failed to load test. Try again.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [appId]);

  // ── Submit logic (stable via ref) ─────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitting || result) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.keys(answers).map(qId => ({ questionId: qId, selectedOption: answers[qId] }))
      };
      const { data } = await api.post(`/applications/${appId}/mcq`, payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Submit failed. Try again.');
      setSubmitting(false);
    }
  }, [submitting, result, answers, appId]);

  // Keep the stable ref in sync on every render
  useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);

  // ── Timer ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerReady) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); submitRef.current?.(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerReady]); // fires exactly once when questions + duration are ready

  // ── Mark question visited when navigating to it ───────────────────────────────
  useEffect(() => {
    setVisited(v => {
      if (v.has(currentQ)) return v;
      return new Set([...v, currentQ]);
    });
  }, [currentQ]);

  // ── Tab Proctoring ─────────────────────────────────────────────────────────────
  const proctoringActive = timerReady && !result && !error && !submitting && faceReady;

  const { violationCount } = useTabProctor({
    enabled: proctoringActive,
    maxViolations: 3,
    sessionId: `mcq-${appId}`,
    videoRef: webcamVideoRef,
    onViolation: (count, max) => {
      const isFinal = count >= max;
      setProctorFinal(isFinal);
      const msg = isFinal
        ? `🚨 Tab Violation ${count}/${max}: Auto-submitting your test now…`
        : `⚠️ Warning ${count}/${max}: Tab switching detected! ${max - count} more violation${max - count > 1 ? 's' : ''} will auto-submit your test.`;
      setProctorMsg(msg);
      if (!isFinal) {
        if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
        msgTimerRef.current = setTimeout(() => setProctorMsg(null), 4000);
      }
    },
    onAutoSubmit: () => submitRef.current?.(),
  });

  // ── Face Proctoring ─────────────────────────────────────────────────────────
  const { faceViolationCount } = useFaceProctor({
    videoRef: webcamVideoRef,
    enabled: proctoringActive,
    maxViolations: 3,
    sessionId: `mcq-${appId}`,
    onViolation: (count, max, type, description) => {
      const isFinal = count >= max;
      setProctorFinal(isFinal);
      const label = {
        no_face_detected: '🚫 No Face Detected',
        multiple_faces:   '👥 Multiple Faces Detected',
        face_look_away:   '👀 Looking Away',
        camera_blocked:   '📵 Camera Blocked',
      }[type] || '⚠️ Face Violation';
      const msg = isFinal
        ? `🚨 ${label}: Auto-submitting (${count}/${max} face violations)…`
        : `${label} — Warning ${count}/${max}: ${description}`;
      setProctorMsg(msg);
      if (!isFinal) {
        if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
        msgTimerRef.current = setTimeout(() => setProctorMsg(null), 5000);
      }
    },
    onAutoSubmit: () => submitRef.current?.(),
  });


  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSelect = (qId, option) => setAnswers(prev => ({ ...prev, [qId]: option }));

  const toggleReview = () => {
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(currentQ)) next.delete(currentQ);
      else next.add(currentQ);
      return next;
    });
  };

  const handleManualSubmit = () => {
    const unanswered = questions.length - Object.keys(answers).length;
    if (unanswered > 0 && !window.confirm(
      `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}.\nAre you sure you want to submit?`
    )) return;
    handleSubmit();
  };

  const fmt = s => s === null
    ? '--:--'
    : `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const answered      = Object.keys(answers).length;
  const notAnswered   = [...visited].filter(i => !answers[questions[i]?._id] && !markedForReview.has(i)).length;
  const notVisited    = questions.length - visited.size;
  const isReviewed    = markedForReview.has(currentQ);

  // ── Guards ────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  if (error) {
    const isDeleted = error.toLowerCase().includes('not found') || error.toLowerCase().includes('not active');
    if (isDeleted) {
      // Auto-redirect after 3s
      setTimeout(() => navigate('/dashboard'), 3000);
    }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 500, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{isDeleted ? '🗑️' : '⚠️'}</div>
          <h3 style={{ marginBottom: 8 }}>{isDeleted ? 'Application Removed' : 'Cannot Access Test'}</h3>
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>
          {isDeleted && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 16 }}>
              This application was removed by the admin. You will be redirected to the Job Board to re-apply in a moment...
            </p>
          )}
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            {isDeleted ? 'Go to Job Board' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  // ── Face verification gate ─────────────────────────────────────────────────
  if (!faceReady) {
    return (
      <FaceCheckModal
        roundName="MCQ Test"
        sessionId={`mcq-${appId}`}
        onReady={(stream) => {
          camStreamRef.current = stream;
          setFaceReady(true);
        }}
      />
    );
  }

  if (result) {
    const passed = result.data.status !== 'mcq_failed';
    const noCodingRound = jobSkipsCodingRound(application?.jobId?.domain);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{passed ? '🎉' : '😞'}</div>
          <h2 style={{ marginBottom: 12 }}>{passed ? 'MCQ Passed!' : 'MCQ Failed'}</h2>
          <div className={`alert ${passed ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: 20 }}>
            {result.message}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {passed && !noCodingRound && (
              <button className="btn btn-primary" onClick={() => navigate(`/coding/${appId}`)}>Go to Coding Round →</button>
            )}
            {passed && noCodingRound && (
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
            )}
            {!passed && (
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentQ];

  // ─── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Proctoring Toast ─────────────────────────────────────────────────── */}
      {proctorMsg && <ProctoringBanner msg={proctorMsg} isFinal={proctorFinal} />}

      {/* ── Webcam PiP (always visible while test is active) ─────────────────── */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 9000,
        width: 160, height: 120, borderRadius: 12, overflow: 'hidden',
        border: `2px solid ${faceViolationCount > 0 ? '#ef4444' : '#10b981'}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        background: '#000',
      }}>
        <video
          ref={webcamVideoRef}
          autoPlay muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        {/* Monitoring indicator */}
        <div style={{
          position: 'absolute', top: 6, left: 6,
          background: faceViolationCount > 0 ? '#ef4444' : '#10b981',
          borderRadius: 20, padding: '2px 8px',
          fontSize: '0.6rem', fontWeight: 700, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse-dot 1.5s infinite' }} />
          LIVE
        </div>
      </div>
      <div style={{ maxWidth: 1160, width: '100%', margin: '24px auto 0', padding: '0 20px' }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>
              MCQ Assessment: {application?.jobId?.title}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>Q {currentQ + 1} of {questions.length}</span>
              <span>·</span>
              <span>{answered} answered</span>
              {violationCount > 0 && (
                <span style={{ color: violationCount >= 3 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                  ⚠ Tab: {violationCount}/3
                </span>
              )}
              {faceViolationCount > 0 && (
                <span style={{ color: faceViolationCount >= 3 ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                  📷 Face: {faceViolationCount}/3
                </span>
              )}
            </div>
          </div>
          <div style={{
            fontWeight: 800, fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums',
            color: timeLeft < 60 ? '#ef4444' : timeLeft < 180 ? '#f59e0b' : 'var(--accent-primary)',
          }}>
            ⏱ {fmt(timeLeft)}
          </div>
        </div>
      </div>

      {/* ── Main 2-column layout ─────────────────────────────────────────────── */}
      <div style={{
        maxWidth: 1160, width: '100%', margin: '20px auto',
        padding: '0 20px', display: 'grid',
        gridTemplateColumns: '1fr 280px', gap: 20, flex: 1,
      }}>

        {/* ── Left: Question + Options + Nav Buttons ──────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Question card */}
          <div className="card">
            <p style={{ fontSize: '1.05rem', fontWeight: 600, lineHeight: 1.7, marginBottom: 24 }}>
              {currentQ + 1}. {q.question}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {q.options.map((opt, i) => {
                const selected = answers[q._id] === opt;
                return (
                  <label key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${selected ? 'var(--accent-primary)' : 'var(--border)'}`,
                    background: selected ? 'rgba(37,99,235,0.08)' : 'var(--bg-secondary)',
                    transition: 'all 0.15s',
                  }}>
                    {/* Custom radio */}
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${selected ? 'var(--accent-primary)' : 'var(--border)'}`,
                      background: selected ? 'var(--accent-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                    </div>
                    <input
                      type="radio" name={`q-${q._id}`} value={opt}
                      checked={selected} onChange={() => handleSelect(q._id, opt)}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontSize: '0.925rem' }}>{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Navigation row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
              disabled={currentQ === 0}
            >
              ← Previous
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              {/* Mark for Review toggle */}
              <button
                onClick={toggleReview}
                style={{
                  padding: '8px 18px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', border: '2px solid #7c3aed',
                  background: isReviewed ? '#7c3aed' : 'transparent',
                  color: isReviewed ? 'white' : '#7c3aed',
                  transition: 'all 0.15s',
                }}
              >
                {isReviewed ? '🟣 Marked for Review' : '🔖 Mark for Review'}
              </button>

              {currentQ < questions.length - 1 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))}
                >
                  Next →
                </button>
              ) : (
                <button
                  className="btn btn-success"
                  onClick={handleManualSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting…' : '✓ Submit Test'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Navigator Sidebar ────────────────────────────────────── */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 20 }}>

            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              Question Navigator
            </div>

            {/* Dot grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
              {questions.map((qs, i) => {
                const status  = getQStatus(i, qs._id, answers, visited, markedForReview);
                const s       = STATUS[status];
                const isActive = i === currentQ;
                return (
                  <div
                    key={i}
                    onClick={() => setCurrentQ(i)}
                    title={`Q${i + 1}: ${s.label}`}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700,
                      background: s.bg, color: s.color,
                      border: isActive ? '3px solid #2563eb' : `2px solid ${s.border}`,
                      boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.2)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: '0.75rem', marginBottom: 16 }}>
              {Object.entries(STATUS).map(([key, s]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                    background: s.bg, border: key === 'none' ? `1px solid ${s.border}` : 'none',
                  }} />
                  <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div>✅ Answered:       <strong style={{ color: '#10b981' }}>{answered}</strong></div>
              <div>🟣 For Review:     <strong style={{ color: '#7c3aed' }}>{markedForReview.size}</strong></div>
              <div>❌ Not Answered:   <strong style={{ color: '#ef4444' }}>{notAnswered}</strong></div>
              <div>⬜ Not Visited:    <strong style={{ color: 'var(--text-muted)' }}>{notVisited}</strong></div>
            </div>

            {/* Sidebar submit */}
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 16 }}
              onClick={handleManualSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : `Submit (${answered}/${questions.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCQTest;
