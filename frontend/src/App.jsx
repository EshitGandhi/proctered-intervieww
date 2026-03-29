import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import CandidateLogin from './pages/CandidateLogin';
import AdminLogin from './pages/AdminLogin';
import CandidateRegister from './pages/CandidateRegister';
import CandidateDashboard from './pages/candidate/CandidateDashboard';
import MCQTest from './pages/candidate/MCQTest';
import CodeEvalRound from './pages/candidate/CodeEvalRound';
import CandidateRoom from './pages/CandidateRoom';
import AdminDashboard from './pages/admin/AdminDashboard';
import InterviewerDashboard from './pages/InterviewerDashboard';
import InterviewerRoom from './pages/InterviewerRoom';
import SessionPlayback from './pages/SessionPlayback';
import ReportsPage from './pages/ReportsPage';

import './index.css';

// ─── Protected Route ──────────────────────────────────────────────────────────
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

  if (!user) {
    if (roles && roles.includes('admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'candidate' ? '/dashboard' : '/admin'} replace />;
  }
  return children;
};

// ─── App Router ───────────────────────────────────────────────────────────────
const AppRouter = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={<CandidateLogin />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/register" element={<CandidateRegister />} />
      {/* Legacy links bridging to candidate router */}
      <Route path="/register/candidate" element={<Navigate to="/register" replace />} />
      <Route path="/join" element={<Navigate to="/login" replace />} />

      {/* ── Candidate Routes ── */}
      <Route path="/dashboard" element={
        <ProtectedRoute roles={['candidate']}>
          <CandidateDashboard />
        </ProtectedRoute>
      } />
      <Route path="/mcq/:appId" element={
        <ProtectedRoute roles={['candidate']}>
          <MCQTest />
        </ProtectedRoute>
      } />
      <Route path="/coding/:appId" element={
        <ProtectedRoute roles={['candidate']}>
          <CodeEvalRound />
        </ProtectedRoute>
      } />
      <Route path="/room/:roomId" element={
        <ProtectedRoute roles={['candidate']}>
          <CandidateRoom />
        </ProtectedRoute>
      } />

      {/* ── Admin Routes ── */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/:tab" element={
        <ProtectedRoute roles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute roles={['admin']}>
          <ReportsPage />
        </ProtectedRoute>
      } />
      <Route path="/monitor/:roomId" element={
        <ProtectedRoute roles={['admin']}>
          <InterviewerRoom />
        </ProtectedRoute>
      } />
      <Route path="/playback/:interviewId" element={
        <ProtectedRoute roles={['admin']}>
          <SessionPlayback />
        </ProtectedRoute>
      } />

      {/* Root redirect by role */}
      <Route path="/" element={
        user
          ? <Navigate to={user.role === 'candidate' ? '/dashboard' : '/admin'} replace />
          : <Navigate to="/login" replace />
      } />

      {/* 404 */}
      <Route path="*" element={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 64 }}>🔍</div>
          <h2>Page Not Found</h2>
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
