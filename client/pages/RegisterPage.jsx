import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { token } = useParams();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [inviteLabel, setInviteLabel] = useState('');
  const [tokenValid, setTokenValid] = useState(null); // null=loading, true, false
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(true);
      return;
    }
    api.validateInvite(token)
      .then(res => {
        setTokenValid(true);
        setInviteLabel(res.label || '');
      })
      .catch(() => setTokenValid(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username.trim(), password, token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (tokenValid === null) {
    return <div className="min-h-screen flex items-center justify-center text-chalk-faint">Checking invite…</div>;
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center">
        <p className="eyebrow mb-3">Invite link</p>
        <h2 className="font-display font-bold text-2xl text-chalk mb-2">This link won't work</h2>
        <p className="text-chalk-dim text-sm">It's already been used, or it doesn't exist.</p>
        <p className="text-chalk-dim text-sm mt-1">Ask the admin for a new one.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <p className="eyebrow mb-2">
            {inviteLabel ? `Invited as ${inviteLabel}` : 'Create your account'}
          </p>
          <h1 className="font-display font-extrabold text-4xl tracking-tight text-chalk">
            psu<span className="text-chalk-dim">Parlay</span>
          </h1>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="eyebrow block mb-1.5" htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="choose a username"
                maxLength={50}
                required
                autoComplete="username"
                className="field font-mono"
              />
            </div>
            <div>
              <label className="eyebrow block mb-1.5" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="at least 6 characters"
                minLength={6}
                required
                autoComplete="new-password"
                className="field font-mono"
              />
            </div>

            {error && <p className="banner banner-error">{error}</p>}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
