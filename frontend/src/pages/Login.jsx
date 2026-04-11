import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Incorrect password'); return; }
    login(data.token);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--page-bg)', fontFamily: 'sans-serif',
    }}>
      <div style={{
        background: '#fdfaf6', borderRadius: 12, padding: '40px 36px',
        boxShadow: '0 2px 20px rgba(62,47,37,0.08)', width: '100%', maxWidth: 360,
        border: '1px solid #e8dfd6',
      }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 22, color: '#3e2f25' }}>Clinic Manager</h2>
        <p style={{ margin: '0 0 28px', color: '#7a6a5f', fontSize: 14 }}>Enter your password to continue</p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: '#7a6a5f', display: 'block', marginBottom: 4 }}>Password</span>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', fontSize: 15,
                border: '1px solid #e8dfd6', borderRadius: 8, boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </label>
          {error && <p style={{ color: '#c97b7b', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%', padding: '10px', fontSize: 15, fontWeight: '600',
              background: 'var(--primary)', color: '#3e2f25', border: 'none', borderRadius: 8,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              opacity: loading || !password ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
