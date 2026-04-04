import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Determine role context based on path on load and continuously
  const getRolePrefix = () => window.location.pathname.startsWith('/admin') ? 'admin' : 'candidate';

  const [user, setUser] = useState(() => {
    try {
      const activeRole = getRolePrefix();
      const saved = localStorage.getItem(`user_${activeRole}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      const activeRole = getRolePrefix();
      const tKey = `token_${activeRole}`;
      const uKey = `user_${activeRole}`;
      const token = localStorage.getItem(tKey);
      
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        localStorage.setItem(uKey, JSON.stringify(data.user));
      } catch {
        localStorage.removeItem(tKey);
        localStorage.removeItem(uKey);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const userRole = data.user.role === 'admin' ? 'admin' : 'candidate';
    localStorage.setItem(`token_${userRole}`, data.token);
    localStorage.setItem(`user_${userRole}`, JSON.stringify(data.user));
    
    // Only update active user state if the layout matches the login profile
    if (getRolePrefix() === userRole) {
      setUser(data.user);
    }
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password, role, adminKey) => {
    const { data } = await api.post('/auth/register', { name, email, password, role, adminKey });
    const userRole = data.user.role === 'admin' ? 'admin' : 'candidate';
    localStorage.setItem(`token_${userRole}`, data.token);
    localStorage.setItem(`user_${userRole}`, JSON.stringify(data.user));
    
    if (getRolePrefix() === userRole) {
      setUser(data.user);
    }
    return data.user;
  }, []);

  const logout = useCallback(() => {
    const activeRole = getRolePrefix();
    localStorage.removeItem(`token_${activeRole}`);
    localStorage.removeItem(`user_${activeRole}`);
    setUser(null);
    window.location.href = activeRole === 'admin' ? '/admin/login' : '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export default AuthContext;
