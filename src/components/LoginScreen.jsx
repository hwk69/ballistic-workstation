import { useState } from 'react';
import { signIn } from '../lib/db.js';

export function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(import.meta.env.VITE_TEAM_EMAIL, password);
      onLogin();
    } catch (err) {
      setError(err.message || 'Sign in failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#111118', flexShrink: 0 }}>
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.22em', textTransform: 'uppercase', background: '#FFDF00', color: '#000', padding: '2px 6px' }}>AXON</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#111118' }}>BALLISTIC</span>
          </div>
        </div>

        {/* Heading */}
        <div style={{ borderLeft: '3px solid #FFDF00', paddingLeft: 16, marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111118', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Sign in</h1>
          <p style={{ fontSize: 13, color: '#6b6b7e', margin: '6px 0 0', fontWeight: 500 }}>Restricted to authorized personnel.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#6b6b7e' }}>Username</label>
            <input
              type="text"
              defaultValue="axon"
              autoFocus
              style={{
                width: '100%', border: '1px solid #e2e2e8', background: '#f0f0f4',
                padding: '10px 12px', fontSize: 14, color: '#111118',
                fontFamily: 'inherit', borderRadius: 0, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#6b6b7e' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', border: '1px solid #e2e2e8', background: '#f0f0f4',
                padding: '10px 12px', fontSize: 14, color: '#111118',
                fontFamily: 'inherit', borderRadius: 0, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {error && (
            <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: '12px', background: loading ? '#ccc' : '#FFDF00',
              color: '#000', fontWeight: 800, fontSize: 12, letterSpacing: '0.14em',
              textTransform: 'uppercase', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', borderRadius: 0, transition: 'background 0.15s',
            }}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

      </div>
    </div>
  );
}
