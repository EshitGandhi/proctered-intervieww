import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminLogin = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(form.email, form.password);
      if (u.role !== 'admin') {
        // Candidate credentials used on admin portal — clear session and show error
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setError('Access denied. These credentials belong to a Candidate account. Please use the Candidate Portal to sign in.');
        return;
      }
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px', color: 'white',
          }}>🛡️</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>Employee Portal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Sign in to access your administrative tools.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label style={labelStyle}>Work Email</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label style={labelStyle}>Password</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              autoComplete="current-password"
            />
          </div>

          <button
            className="btn btn-primary btn-lg w-full"
            type="submit"
            disabled={loading}
            style={{ marginTop: 8, background: '#059669', border: 'none' }}
          >
            {loading ? '⟳ Signing in…' : 'Sign In as Employee'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          New employee?{' '}
          <Link to="/admin/register" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>
            Register here
          </Link>
        </p>

      </div>
    </div>
  );
};

export default AdminLogin;
