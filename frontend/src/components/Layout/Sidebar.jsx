import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const candidateNav = [
  { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
];

const adminNav = [
  { path: '/admin', label: 'Overview', icon: '📊' },
  { path: '/admin/jobs', label: 'Jobs', icon: '💼' },
  { path: '/admin/mcq', label: 'MCQ Management', icon: '📝' },
  { path: '/admin/candidates', label: 'Candidates', icon: '👥' },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin' || user?.role === 'interviewer';
  const navLinks = isAdmin ? adminNav : candidateNav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside style={{
      width: 220,
      minHeight: '100vh',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>🎯</div>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>HireFlow</span>
      </div>

      {/* User info */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
        }}>
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {navLinks.map(link => (
          <Link
            key={link.path}
            to={link.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 4,
              fontWeight: 500,
              fontSize: '0.875rem',
              textDecoration: 'none',
              color: location.pathname === link.path ? 'var(--primary)' : 'var(--text-secondary)',
              background: location.pathname === link.path ? 'var(--primary-light)' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 16 }}>{link.icon}</span>
            {link.label}
          </Link>
        ))}

        {/* Admin also has access to Interviews via old dashboard */}
        {isAdmin && (
          <Link
            to="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 4,
              fontWeight: 500,
              fontSize: '0.875rem',
              textDecoration: 'none',
              color: location.pathname === '/dashboard' ? 'var(--primary)' : 'var(--text-secondary)',
              background: location.pathname === '/dashboard' ? 'var(--primary-light)' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 16 }}>🎥</span>
            Interviews
          </Link>
        )}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--danger)',
            fontWeight: 500,
            fontSize: '0.875rem',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-light)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: 16 }}>🚪</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
