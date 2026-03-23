import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthPage = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'candidate' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      navigate(user.role === 'candidate' ? '/join' : '/dashboard');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let u;
      if (mode === 'login') {
        u = await login(form.email, form.password);
      } else {
        u = await register(form.name, form.email, form.password, form.role);
      }
      navigate(u.role === 'candidate' ? '/join' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
          }}>🎯</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>InterviewPro</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
          </p>
        </div>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 10,
          padding: 4, marginBottom: 28, border: '1px solid var(--border)',
        }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                background: mode === m ? 'var(--accent-primary)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="label">Full Name</label>
              <input
                className="input"
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="label">Email Address</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="label">Role</label>
              <select
                className="input select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="candidate">Candidate</option>
                <option value="interviewer">Interviewer</option>
              </select>
            </div>
          )}

          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}
            style={{ marginTop: 8 }}>
            {loading ? '⟳ Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {mode === 'login' && (
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <button onClick={() => setMode('register')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>
              Register
            </button>
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
