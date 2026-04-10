import { useState } from 'react';
import { signIn } from '../lib/db.js';

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      onLogin();
    } catch (err) {
      setError(err.message || 'Sign in failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Subtle crosshair reticle decoration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.025]">
        <svg width="420" height="420" viewBox="0 0 420 420" fill="none">
          <circle cx="210" cy="210" r="200" stroke="#FFDF00" strokeWidth="1"/>
          <circle cx="210" cy="210" r="100" stroke="#FFDF00" strokeWidth="0.75"/>
          <line x1="10" y1="210" x2="410" y2="210" stroke="#FFDF00" strokeWidth="0.75"/>
          <line x1="210" y1="10" x2="210" y2="410" stroke="#FFDF00" strokeWidth="0.75"/>
          <circle cx="210" cy="210" r="6" stroke="#FFDF00" strokeWidth="1.5"/>
        </svg>
      </div>

      <div className="w-full max-w-[340px] relative">
        {/* Wordmark */}
        <div className="flex items-center gap-2 mb-10">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-primary shrink-0">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.25"/>
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.25"/>
            <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.25"/>
            <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1.25"/>
          </svg>
          <span className="text-[12px] font-bold tracking-[0.18em] uppercase text-foreground">Axon Ballistic</span>
        </div>

        <h1 className="text-[28px] font-bold tracking-tight text-foreground mb-1.5 leading-tight">Sign in</h1>
        <p className="text-[13px] text-muted-foreground mb-8">Access restricted to authorized personnel.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/60 focus:outline-none transition-colors"
            />
          </div>
          {error && (
            <p className="text-[13px] text-destructive">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-2.5 rounded-md bg-primary text-black font-bold text-[13px] tracking-wide disabled:opacity-50 cursor-pointer hover:bg-primary/90 transition-colors">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
