import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'in' | 'out'

  useEffect(() => {
    const token = localStorage.getItem('clinic_token');
    if (!token) { setStatus('out'); return; }
    fetch('/auth/verify', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setStatus(d.valid ? 'in' : 'out'))
      .catch(() => setStatus('out'));
  }, []);

  function login(token) {
    localStorage.setItem('clinic_token', token);
    setStatus('in');
  }

  function logout() {
    localStorage.removeItem('clinic_token');
    setStatus('out');
  }

  return (
    <AuthContext.Provider value={{ status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
