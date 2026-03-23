import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import JoinPage from './pages/JoinPage';
import CandidateRoom from './pages/CandidateRoom';
import InterviewerDashboard from './pages/InterviewerDashboard';
import SessionPlayback from './pages/SessionPlayback';
import InterviewerRoom from './pages/InterviewerRoom';
import './index.css';

// ── Protected Route ───────────────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'candidate' ? '/join' : '/dashboard'} replace />;
  }
  return children;
};

// ── App Router ────────────────────────────────────────────────
const AppRouter = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />

      {/* Candidate routes */}
      <Route path="/join" element={
        <ProtectedRoute roles={['candidate']}>
          <JoinPage />
        </ProtectedRoute>
      } />
      <Route path="/room/:roomId" element={
        <ProtectedRoute roles={['candidate']}>
          <CandidateRoom />
        </ProtectedRoute>
      } />

      {/* Interviewer routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute roles={['interviewer', 'admin']}>
          <InterviewerDashboard />
        </ProtectedRoute>
      } />
      <Route path="/monitor/:roomId" element={
        <ProtectedRoute roles={['interviewer', 'admin']}>
          <InterviewerRoom />
        </ProtectedRoute>
      } />
      <Route path="/playback/:interviewId" element={
        <ProtectedRoute roles={['interviewer', 'admin']}>
          <SessionPlayback />
        </ProtectedRoute>
      } />

      {/* Root redirect */}
      <Route path="/" element={
        user
          ? <Navigate to={user.role === 'candidate' ? '/join' : '/dashboard'} replace />
          : <Navigate to="/login" replace />
      } />

      {/* 404 */}
      <Route path="*" element={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 64 }}>🔍</div>
          <h2 style={{ fontSize: '1.5rem' }}>Page Not Found</h2>
          <a href="/" className="btn btn-primary">Go Home</a>
        </div>
      } />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
