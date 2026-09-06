import { useState } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ChangePasswordPage() {
  const { user, setUser, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(password);
      setUser({ ...user, mustChangePassword: false });
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
          <p className="eyebrow mb-2">Set your password</p>
          <h1 className="font-display font-extrabold text-4xl tracking-tight text-chalk">
            psu<span className="text-chalk-dim">Parlay</span>
          </h1>
        </div>

        <div className="card p-6">
          <p className="text-chalk-dim text-sm mb-4">
            You're signed in with a temporary password. Choose your own to continue.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="eyebrow block mb-1.5" htmlFor="cp-password">New password</label>
              <input
                id="cp-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="at least 6 characters"
                minLength={6}
                required
                autoFocus
                autoComplete="new-password"
                className="field font-mono"
              />
            </div>
            <div>
              <label className="eyebrow block mb-1.5" htmlFor="cp-confirm">Confirm password</label>
              <input
                id="cp-confirm"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="type it again"
                minLength={6}
                required
                autoComplete="new-password"
                className="field font-mono"
              />
            </div>

            {error && <p className="banner banner-error">{error}</p>}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Saving…' : 'Save password'}
            </button>
          </form>
        </div>

        <p className="text-center text-chalk-faint text-xs mt-4">
          <button onClick={logout} className="hover:text-chalk-dim transition-colors">Sign out</button>
        </p>
      </div>
    </div>
  );
}
