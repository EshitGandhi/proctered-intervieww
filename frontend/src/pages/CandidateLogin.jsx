import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CandidateLogin = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in as a candidate
  React.useEffect(() => {
    if (user && user.role === 'candidate') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(form.email, form.password);
      if (u.role !== 'candidate') {
        // Admin credentials used on candidate portal — clear session and show error
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setError('Access denied. These credentials belong to an Admin account. Please use the Employee Portal to sign in.');
        return;
      }
      navigate('/dashboard');
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
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>Candidate Portal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Sign in to track your applications and interviews.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? '⟳ Please wait…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register/candidate" style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Register as Candidate
          </Link>
        </p>

      </div>
    </div>
  );
};

export default CandidateLogin;
