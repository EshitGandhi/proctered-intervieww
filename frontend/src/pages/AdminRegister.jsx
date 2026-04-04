import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AdminRegister = () => {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = verify key, 2 = fill details, 3 = success
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin',
    adminKey: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin' : '/dashboard');
  }, [user, navigate]);

  const inputStyle = {
    width: '100%', padding: '11px 14px', borderRadius: 9,
    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
    color: 'var(--text-primary)', fontSize: '0.9rem',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = {
    fontWeight: 600, fontSize: '0.8rem', display: 'block',
    marginBottom: 6, color: 'var(--text-secondary)',
  };

  const handleVerifyKey = async (e) => {
    e.preventDefault();
    if (!form.adminKey) return setError('Please enter the security key');
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/verify-key', { adminKey: form.adminKey });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid security key');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (form.name.trim().length < 2) return setError('Full Name must be at least 2 characters.');
    if (!/^[a-zA-Z ]+$/.test(form.name.trim())) return setError('Full Name must contain only English alphabets.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');

    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.role, form.adminKey);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Success Screen ────────────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 20px',
          }}>🎉</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 8 }}>Account Created!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
            Welcome, <strong>{form.name.split(' ')[0]}</strong>! Your employee account is ready.
          </p>
          <button
            className="btn btn-primary"
            style={{ padding: '12px 32px', fontSize: '0.95rem', background: '#059669', border: 'none' }}
            onClick={() => navigate('/admin')}
          >
            Go to Admin Dashboard →
          </button>
          <div style={{ marginTop: 12 }}>
            <Link to="/admin/login" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'none' }}>
              Sign in with a different account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: step === 1
              ? 'linear-gradient(135deg, #f59e0b, #d97706)'
              : 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px', color: 'white',
            transition: 'background 0.3s',
          }}>
            {step === 1 ? '🔐' : '📝'}
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>
            {step === 1 ? 'Employee Registration' : 'Create Your Account'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {step === 1
              ? 'Enter your security key to unlock registration.'
              : 'Fill in your details to complete registration.'}
          </p>
          {/* Step indicator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: s === step ? 24 : 8, height: 8, borderRadius: 4,
                background: s <= step ? '#2563eb' : 'var(--border)',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* Step 1: Secret Key Verification */}
        {step === 1 && (
          <form onSubmit={handleVerifyKey} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label style={labelStyle}>🔑 Secret Admin Key</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="Enter the pre-shared security key"
                value={form.adminKey}
                onChange={(e) => setForm({ ...form, adminKey: e.target.value })}
                required
                autoFocus
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                Only authorized personnel with a valid key can register as employees.
              </p>
            </div>

            <button
              className="btn btn-primary btn-lg w-full"
              type="submit"
              disabled={loading}
              style={{ marginTop: 8, background: '#d97706', border: 'none' }}
            >
              {loading ? '⟳ Verifying…' : 'Verify Key & Continue →'}
            </button>
          </form>
        )}

        {/* Step 2: Account Details */}
        {step === 2 && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label style={labelStyle}>Full Name</label>
              <input
                style={inputStyle}
                type="text"
                placeholder="e.g. Ravi Kumar"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z ]/g, '') })}
                required
                autoFocus
                title="Only English alphabets are allowed"
              />
            </div>

            <div className="form-group">
              <label style={labelStyle}>Work Email</label>
              <input
                style={inputStyle}
                type="email"
                placeholder="you@kadellabs.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label style={labelStyle}>Password</label>
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label style={labelStyle}>Confirm Password</label>
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Re-enter"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setStep(1); setError(''); }}
              >
                ← Back
              </button>
              <button
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={loading}
                style={{ flex: 2, background: '#2563eb', border: 'none' }}
              >
                {loading ? '⟳ Creating…' : 'Create Employee Account'}
              </button>
            </div>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/admin/login" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            Sign in here
          </Link>
        </p>

      </div>
    </div>
  );
};

export default AdminRegister;
