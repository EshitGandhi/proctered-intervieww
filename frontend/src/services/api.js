import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request based on current portal path
api.interceptors.request.use((config) => {
  const isAdminPath = window.location.pathname.startsWith('/admin');
  const tokenKey = isAdminPath ? 'token_admin' : 'token_candidate';
  const token = localStorage.getItem(tokenKey);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only redirect if not already on auth-related pages or if not an explicit login request
    const isAuthPage = window.location.pathname.includes('/login') || window.location.pathname.includes('/register');
    const isLoginEndpoint = err.config?.url?.includes('/auth/login');

    if (err.response?.status === 401 && !isAuthPage && !isLoginEndpoint) {
      const isAdminPath = window.location.pathname.startsWith('/admin');
      const tokenKey = isAdminPath ? 'token_admin' : 'token_candidate';
      const userKey = isAdminPath ? 'user_admin' : 'user_candidate';
      
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(userKey);
      window.location.href = isAdminPath ? '/admin/login' : '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
