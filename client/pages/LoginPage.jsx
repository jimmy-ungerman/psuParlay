import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      // AuthProvider state change triggers redirect in App.jsx
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <p className="eyebrow mb-2">College football · against the spread</p>
          <h1 className="font-display font-extrabold text-4xl tracking-tight text-chalk">
            psu<span className="text-chalk-dim">Parlay</span>
          </h1>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="eyebrow block mb-1.5" htmlFor="login-username">Username</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="your_username"
                required
                autoComplete="username"
                className="field font-mono"
              />
            </div>
            <div>
              <label className="eyebrow block mb-1.5" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="field font-mono"
              />
            </div>

            {error && <p className="banner banner-error">{error}</p>}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-chalk-faint text-xs mt-4">
          Need an account? Ask the admin for an invite link.
        </p>
      </div>
    </div>
  );
}
