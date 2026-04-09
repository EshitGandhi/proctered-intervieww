import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { DOMAINS, EXPERIENCE_OPTIONS } from '../utils/constants';

const CandidateRegister = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [step, setStep] = useState(1); // 1 = account info, 2 = success
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    domain: '',
    experience: '',
  });
  const [resume, setResume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Already logged in → redirect
  useEffect(() => {
    if (user) navigate(user.role === 'candidate' ? '/dashboard' : '/admin');
  }, [user]);

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

  const ALLOWED_EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'kadellabs.com'];

  const handleNameChange = (e) => {
    // Allow only English alphabets and spaces
    const value = e.target.value.replace(/[^a-zA-Z ]/g, '');
    setForm(f => ({ ...f, name: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate Full Name
    if (!/^[a-zA-Z ]+$/.test(form.name.trim())) {
      return setError('Full Name must contain only English alphabets.');
    }
    if (form.name.trim().length < 2) {
      return setError('Full Name must be at least 2 characters.');
    }

    // Validate Email Domain
    const emailDomain = form.email.split('@')[1]?.toLowerCase();
    if (!emailDomain || !ALLOWED_EMAIL_DOMAINS.includes(emailDomain)) {
      return setError(`Invalid email domain. Only @gmail.com, @outlook.com, or @kadellabs.com are allowed.`);
    }

    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (!form.domain) {
      return setError('Please select your domain');
    }
    if (!form.experience) {
      return setError('Please select your years of experience');
    }

    setLoading(true);
    try {
      // Step 1: Register the user account
      const { data: regData } = await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: 'candidate',
        domain: form.domain,
        experience: form.experience,
      });

      // Store token with candidate-specific scope
      localStorage.setItem('token_candidate', regData.token);
      localStorage.setItem('user_candidate', JSON.stringify(regData.user));

      setStep(2); // show success screen
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success Screen ────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', padding: 24,
      }}>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '40px 32px', maxWidth: 480, width: '100%', textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: '#d1fae5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 20px',
          }}>🎉</div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: 10 }}>You're all set, {form.name.split(' ')[0]}!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>
            Your candidate account has been created for <strong>{form.domain}</strong>. 
            Go to your dashboard to browse available jobs and start applying.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ padding: '12px 0', fontSize: '0.95rem' }}
              onClick={() => navigate('/dashboard')}
            >
              Go to My Dashboard →
            </button>
            <Link to="/login" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'none' }}>
              Sign in with a different account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration Form ─────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '36px 32px', maxWidth: 500, width: '100%',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, margin: '0 auto 14px',
          }}>🎯</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, marginBottom: 4 }}>Create Candidate Account</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
            Fill in your details to join the hiring platform
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>⚠ {error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Full Name */}
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="e.g. Priya Sharma"
              value={form.name}
              onChange={handleNameChange}
              required
              title="Only English alphabets are allowed"
            />
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>Email Address *</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="you@gmail.com / @outlook.com / @kadellabs.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              autoComplete="email"
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>
              Accepted domains: @gmail.com, @outlook.com, @kadellabs.com
            </p>
          </div>

          {/* Domain */}
          <div>
            <label style={labelStyle}>Your Domain / Specialization *</label>
            <select
              style={inputStyle}
              value={form.domain}
              onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
              required
            >
              <option value="">— Select your field —</option>
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Experience */}
          <div>
            <label style={labelStyle}>Years of Experience *</label>
            <select
              style={inputStyle}
              value={form.experience}
              onChange={e => setForm(f => ({ ...f, experience: e.target.value }))}
              required
            >
              <option value="">— Select experience level —</option>
              {EXPERIENCE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Password *</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label style={labelStyle}>Confirm Password *</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="Re-enter password"
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              required
            />
          </div>

          {/* Resume upload note */}
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px',
            fontSize: '0.78rem', color: 'var(--text-muted)', border: '1px solid var(--border)',
          }}>
            📄 <strong>Resume</strong> — You'll upload your resume when applying for a specific job. No need to upload it now.
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '12px 0', fontSize: '0.95rem', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? '⟳ Creating account...' : 'Create My Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default CandidateRegister;
