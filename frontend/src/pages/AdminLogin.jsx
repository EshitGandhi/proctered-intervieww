import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AdminLogin = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'admin',
    adminKey: '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRegFields, setShowRegFields] = useState(false);
  
  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
         navigate('/admin');
      } else {
         navigate('/dashboard');
      }
    }
  }, [user, navigate]);

  const handleVerifyKey = async () => {
    if (!form.adminKey) return setError('Please enter a key');
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/verify-key', { adminKey: form.adminKey });
      setShowRegFields(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid secret key');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const u = await login(form.email, form.password);
        if (u.role === 'admin') {
            navigate('/admin');
        } else {
            navigate('/dashboard');
        }
      } else {
        // Register mode
        const u = await register(form.name, form.email, form.password, form.role, form.adminKey);
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setShowRegFields(false);
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
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: mode === 'login' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
            color: 'white',
          }}>{mode === 'login' ? '🛡️' : '📝'}</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>
            {mode === 'login' ? 'Employee Portal' : 'Employee Registration'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {mode === 'login' ? 'Sign in to access your administrative tools.' : 'Create your administrative account.'}
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <span>⚠</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {mode === 'register' && (
            <>
              <div className="form-group">
                <label className="label" style={labelStyle}>Secret Admin Key</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    type="password"
                    style={{...inputStyle, flex: 1}}
                    placeholder="Enter security key to unlock"
                    value={form.adminKey}
                    onChange={(e) => setForm({ ...form, adminKey: e.target.value })}
                    required
                  />
                  {!showRegFields && (
                     <button 
                       type="button" 
                       className="btn btn-secondary btn-sm"
                       onClick={handleVerifyKey}
                       disabled={loading}
                     >
                       {loading ? '...' : 'Verify'}
                     </button>
                  )}
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Registration requires a pre-shared security key.
                </p>
              </div>

              {showRegFields && (
                <>
                  <div className="form-group">
                    <label className="label" style={labelStyle}>Full Name</label>
                    <input
                      className="input"
                      style={inputStyle}
                      type="text"
                      placeholder="Your name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}
            </>
          )}

          {(mode === 'login' || showRegFields) && (
            <>
              <div className="form-group">
                <label className="label" style={labelStyle}>{mode === 'login' ? 'Work Email' : 'Email Address'}</label>
                <input
                  className="input"
                  style={inputStyle}
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="label" style={labelStyle}>Password</label>
                <input
                  className="input"
                  style={inputStyle}
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            </>
          )}

          <button 
            className="btn btn-primary btn-lg w-full" 
            type="submit" 
            disabled={loading || (mode === 'register' && !showRegFields)} 
            style={{ 
              marginTop: 8, 
              background: mode === 'login' ? '#059669' : '#2563eb',
              border: 'none'
            }}
          >
            {loading ? '⟳ Please wait…' : mode === 'login' ? 'Sign In as Admin' : 'Complete Registration'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {mode === 'login' ? (
            <>
              New employee?{' '}
              <button 
                onClick={toggleMode}
                style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontWeight: 600 }}
              >
                Register here
              </button>
            </>
          ) : (
            <button 
              onClick={toggleMode}
              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}
            >
              ← Back to Login
            </button>
          )}
        </p>

        <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <a href="/login" style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textDecoration: 'none' }}>
            ← Back to Candidate Portal
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
