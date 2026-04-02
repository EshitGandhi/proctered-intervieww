import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * FaceCheckModal
 * ──────────────
 * Full-screen gate shown before an MCQ or Coding round begins.
 * Steps:
 *  1. Request webcam permission
 *  2. Show live preview with a face-detection overlay message
 *  3. Candidate clicks "Capture Reference Photo" — snapshot is taken
 *  4. "Start Test" becomes available
 *
 * Props:
 *  onReady(videoRef, stream) – called when candidate confirms; passes the
 *                              live <video> ref so useFaceProctor can use it.
 *  roundName  – "MCQ Test" | "Coding Round" etc.
 */
const FaceCheckModal = ({ onReady, roundName = 'Test' }) => {
  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const canvasRef   = useRef(null);

  const [step, setStep]           = useState('requesting'); // requesting | preview | captured | error
  const [capturedImg, setCapturedImg] = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');
  const [countdown, setCountdown] = useState(null); // 3-2-1 before capture

  // ── Start webcam ────────────────────────────────────────────────────────────
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
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
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Countdown and capture ───────────────────────────────────────────────────
  const startCapture = useCallback(() => {
    setCountdown(3);
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      // Take snapshot
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        setCapturedImg(canvas.toDataURL('image/jpeg', 0.85));
        setStep('captured');
      }
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Retake ──────────────────────────────────────────────────────────────────
  const handleRetake = () => {
    setCapturedImg(null);
    setStep('preview');
  };

  // ── Confirm and hand off ────────────────────────────────────────────────────
  const handleStart = () => {
    // Keep stream running — pass ref to parent so face proctoring can continue
    onReady(videoRef, streamRef.current);
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const overlay = {
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(0,0,0,0.95)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: 0,
    fontFamily: "'Inter', 'Outfit', sans-serif",
  };

  const card = {
    background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
    border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: 20,
    padding: '36px 40px',
    maxWidth: 560, width: '100%',
    boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1)',
    position: 'relative',
    overflow: 'hidden',
  };

  const glowBar = {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)',
  };

  const videoBox = {
    position: 'relative', borderRadius: 14, overflow: 'hidden',
    border: step === 'captured' ? '3px solid #10b981' : '3px solid rgba(99,102,241,0.5)',
    marginBottom: 20, background: '#000',
    aspectRatio: '4/3',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={overlay}>
      <div style={card}>
        <div style={glowBar} />

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

        {/* Requesting state */}
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

        {/* Video preview */}
        {(step === 'preview' || step === 'captured') && (
          <div style={videoBox}>
            {/* Live feed (always rendered; hidden after capture) */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                display: step === 'captured' ? 'none' : 'block',
                transform: 'scaleX(-1)', // mirror for selfie feel
              }}
            />

            {/* Captured freeze-frame */}
            {step === 'captured' && capturedImg && (
              <img
                src={capturedImg}
                alt="Reference"
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            )}

            {/* Countdown overlay */}
            {countdown !== null && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.5)',
              }}>
                <div style={{
                  fontSize: 96, fontWeight: 900, color: '#fff',
                  textShadow: '0 0 40px rgba(99,102,241,0.8)',
                  animation: 'pulse 0.5s ease',
                }}>
                  {countdown}
                </div>
              </div>
            )}

            {/* Success overlay */}
            {step === 'captured' && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(16,185,129,0.85))',
                padding: '24px 16px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 20 }}>✅</span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                  Reference photo captured!
                </span>
              </div>
            )}

            {/* Face guide overlay (only preview) */}
            {step === 'preview' && countdown === null && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Oval guide */}
                <div style={{
                  width: '45%', height: '65%',
                  border: '2px dashed rgba(99,102,241,0.7)',
                  borderRadius: '50%',
                }} />
              </div>
            )}
          </div>
        )}

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
            <button
              onClick={startCapture}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                transition: 'all 0.2s',
              }}
            >
              📸 Capture Reference Photo
            </button>
          )}

          {step === 'capturing' || countdown !== null ? (
            <button disabled style={{
              flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
              background: 'rgba(99,102,241,0.3)', color: '#a5b4fc',
              fontWeight: 700, fontSize: '0.95rem', cursor: 'not-allowed',
            }}>
              Capturing in {countdown}…
            </button>
          ) : null}

          {step === 'captured' && (
            <>
              <button
                onClick={handleRetake}
                style={{
                  padding: '13px 20px', borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'transparent', color: '#94a3b8',
                  fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                }}
              >
                🔄 Retake
              </button>
              <button
                onClick={handleStart}
                style={{
                  flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(16,185,129,0.4)',
                }}
              >
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

      {/* Keyframe animations via style tag */}
      <style>{`
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes pulse  { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      `}</style>
    </div>
  );
};

export default FaceCheckModal;
