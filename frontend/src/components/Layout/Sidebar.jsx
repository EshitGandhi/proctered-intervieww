import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const candidateNav = [
  { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
];

const adminNav = [
  { path: '/admin', label: 'Overview', icon: '🎛' },
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
      width: 260,
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      flexShrink: 0,
    }}>
      {/* Unified Brand + User Info block */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0,
        }}>
          KL
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>KL Prarambh</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Admin | Interviewer</div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ padding: '24px 0', flex: 1 }}>
        {navLinks.map(link => {
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 24px',
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                borderLeft: isActive ? '4px solid var(--accent-primary)' : '4px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 18, filter: isActive ? 'none' : 'grayscale(100%) opacity(0.7)' }}>{link.icon}</span>
              {link.label}
              {isActive && <div style={{ marginLeft: 'auto', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 20, fontSize: '0.65rem' }}>ACTIVE</div>}
            </Link>
          );
        })}

        {/* Admin also has access to Interviews via old dashboard */}
        {isAdmin && (
          <Link
            to="/reports"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 24px',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
              color: location.pathname === '/reports' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: location.pathname === '/reports' ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
              borderLeft: location.pathname === '/reports' ? '4px solid var(--accent-primary)' : '4px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 18, filter: location.pathname === '/reports' ? 'none' : 'grayscale(100%) opacity(0.7)' }}>📈</span>
            Reports
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
