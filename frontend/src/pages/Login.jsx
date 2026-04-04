import { useState } from 'react';

export default function Login({ onLogin }) {
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
    localStorage.setItem('clinic_token', data.token);
    onLogin();
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#f5f5f5', fontFamily: 'sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '40px 36px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.1)', width: '100%', maxWidth: 360,
      }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>Clinic Manager</h2>
        <p style={{ margin: '0 0 28px', color: '#888', fontSize: 14 }}>Enter your password to continue</p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Password</span>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', fontSize: 15,
                border: '1px solid #ccc', borderRadius: 6, boxSizing: 'border-box',
              }}
            />
          </label>
          {error && <p style={{ color: '#cc3333', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%', padding: '10px', fontSize: 15, fontWeight: '600',
              background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6,
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
