import React, { useEffect, useRef, useState, useCallback } from 'react';
import api from '../services/api';

const FaceCheckModal = ({ onReady, roundName = 'Test', sessionId = '' }) => {
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const canvasRef    = useRef(null);
  const handedOffRef = useRef(false); // true once user confirms — prevents cleanup from killing stream

  const [step, setStep]             = useState('requesting');
  const [capturedImg, setCapturedImg] = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');
  const [countdown, setCountdown]   = useState(null);

  // ── Start webcam ─────────────────────────────────────────────────────────────
  // The <video> element is always in the DOM so videoRef is available immediately.
  // We assign srcObject here, then flip step to 'preview' once playing.
  useEffect(() => {
    let active = true;

    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        // videoRef.current is always mounted now — assign directly
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(() => {});
          };
        }
        setStep('preview');
      } catch (err) {
        if (!active) return;
        setErrorMsg(
          err.name === 'NotAllowedError'
            ? 'Camera access was denied. Please allow camera in your browser settings and refresh.'
            : `Camera error: ${err.message}`
        );
        setStep('error');
      }
    };

    startCam();

    return () => {
      active = false;
      // Only stop the stream if we never handed it off to the parent.
      // If the user clicked "Start Test", the parent owns the stream now.
      if (!handedOffRef.current) {
        streamRef.current?.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // ── Also assign stream when the video element first mounts (safety net) ──────
  useEffect(() => {
    if (streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  });

  // ── Countdown and capture ─────────────────────────────────────────────────────
  const startCapture = useCallback(() => setCountdown(3), []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        canvas.getContext('2d').drawImage(video, 0, 0);
        setCapturedImg(canvas.toDataURL('image/jpeg', 0.85));
        setStep('captured');
      }
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Confirm and hand off ─────────────────────────────────────────────────────
  const handleRetake = () => { setCapturedImg(null); setStep('preview'); };
  const handleStart  = () => {
    handedOffRef.current = true;           // mark as handed off — don't kill stream on unmount
    // Upload reference photo to backend before starting
    if (capturedImg && sessionId) {
      api.post('/proctoring/log', {
        sessionId,
        eventType: 'face_reference_captured',
        description: `Reference photo captured at the start of ${roundName}.`,
        severity: 'low',
        screenshot: capturedImg,
        metadata: { roundName, capturedAt: new Date().toISOString() },
      }).catch(() => {});
    }
    onReady(streamRef.current);            // pass the live MediaStream to the parent
  };

  // ── Styles ────────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(0,0,0,0.95)',
    overflowY: 'auto',                    // ← fix: allow scroll
    display: 'flex',
    alignItems: 'flex-start',            // ← fix: don't clip tall cards
    justifyContent: 'center',
    padding: '24px 16px',               // ← breathing room top/bottom
    fontFamily: "'Inter', 'Outfit', sans-serif",
  };

  const card = {
    background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
    border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: 20,
    padding: '36px 40px',
    maxWidth: 540, width: '100%',
    boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    marginTop: 'auto',
    marginBottom: 'auto',
  };

  const videoBox = {
    position: 'relative', borderRadius: 14, overflow: 'hidden',
    border: step === 'captured' ? '3px solid #10b981' : '3px solid rgba(99,102,241,0.5)',
    marginBottom: 20, background: '#111',
    aspectRatio: '4/3',
  };

  return (
    <div style={overlay}>
      <div style={card}>
        {/* Glow bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)' }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎯</div>
          <h2 style={{ color: '#f1f5f9', margin: '0 0 6px', fontSize: '1.35rem', fontWeight: 700 }}>
            Face Verification Required
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.875rem' }}>
            Take a reference photo to begin your <strong style={{ color: '#a5b4fc' }}>{roundName}</strong>.
            Your face will be monitored throughout the session.
          </p>
        </div>

        {/* Error state */}
        {step === 'error' && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ color: '#f87171', fontWeight: 600, marginBottom: 6 }}>⚠️ Camera Unavailable</div>
            <div style={{ color: '#fca5a5', fontSize: '0.83rem' }}>{errorMsg}</div>
          </div>
        )}

        {/* Spinner shown while requesting (video box hidden underneath) */}
        {step === 'requesting' && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <div style={{
              width: 48, height: 48, border: '3px solid rgba(99,102,241,0.3)',
              borderTopColor: '#6366f1', borderRadius: '50%',
              animation: 'spin 1s linear infinite', margin: '0 auto 16px',
            }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Requesting camera access…</p>
          </div>
        )}

        {/* ── Video box — always in DOM so ref & srcObject never race ────────── */}
        <div style={{ ...videoBox, display: (step === 'preview' || step === 'captured') ? 'block' : 'none' }}>

          {/* Live video — always rendered; hidden when showing freeze-frame */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              display: 'block',
              opacity: step === 'captured' ? 0 : 1,   // hide visually, keep active
              transform: 'scaleX(-1)',
            }}
          />

          {/* Freeze-frame on top when captured */}
          {step === 'captured' && capturedImg && (
            <img
              src={capturedImg}
              alt="Reference"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover',
                transform: 'scaleX(-1)',
              }}
            />
          )}

          {/* Countdown overlay */}
          {countdown !== null && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: 96, fontWeight: 900, color: '#fff', textShadow: '0 0 40px rgba(99,102,241,0.8)' }}>
                {countdown}
              </div>
            </div>
          )}

          {/* Success banner */}
          {step === 'captured' && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent, rgba(16,185,129,0.85))',
              padding: '24px 16px 12px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Reference photo captured!</span>
            </div>
          )}

          {/* Oval face guide */}
          {step === 'preview' && countdown === null && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '45%', height: '65%', border: '2px dashed rgba(99,102,241,0.7)', borderRadius: '50%' }} />
            </div>
          )}
        </div>

        {/* Hidden canvas for snapshot */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Instructions */}
        {step === 'preview' && (
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#c7d2fe', fontSize: '0.82rem', lineHeight: 1.8 }}>
              <li>Position your face inside the oval guide</li>
              <li>Ensure your face is well-lit and clearly visible</li>
              <li>Remove sunglasses or anything covering your face</li>
              <li>Only <strong>you</strong> should be in the frame</li>
            </ul>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          {step === 'preview' && countdown === null && (
            <button onClick={startCapture} style={{
              flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            }}>
              📸 Capture Reference Photo
            </button>
          )}

          {countdown !== null && (
            <button disabled style={{
              flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
              background: 'rgba(99,102,241,0.3)', color: '#a5b4fc',
              fontWeight: 700, fontSize: '0.95rem', cursor: 'not-allowed',
            }}>
              Capturing in {countdown}…
            </button>
          )}

          {step === 'captured' && (
            <>
              <button onClick={handleRetake} style={{
                padding: '13px 20px', borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.3)',
                background: 'transparent', color: '#94a3b8',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
              }}>
                🔄 Retake
              </button>
              <button onClick={handleStart} style={{
                flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
              }}>
                🚀 Start {roundName}
              </button>
            </>
          )}
        </div>

        {/* Security note */}
        <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.72rem', marginTop: 16, marginBottom: 0 }}>
          🔒 Your camera feed is monitored locally. No video is recorded or transmitted.
        </p>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      `}</style>
    </div>
  );
};

export default FaceCheckModal;
