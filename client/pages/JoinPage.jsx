import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function JoinPage() {
  const [mode, setMode] = useState('join'); // 'join' | 'create'
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (mode === 'join') {
        result = await api.joinRoom(roomCode.toUpperCase(), displayName);
      } else {
        result = await api.createRoom(roomName, displayName);
      }
      login(result.token, result.user, result.room);
      navigate(`/room/${result.room.code}`);
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
          <div className="flex rounded-lg bg-navy-sink p-1 mb-6">
            {[
              { k: 'join', label: 'Join a room' },
              { k: 'create', label: 'Create one' },
            ].map(({ k, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-colors ${
                  mode === k ? 'bg-cash text-navy' : 'text-chalk-dim hover:text-chalk'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'join' && (
              <div>
                <label className="eyebrow block mb-1.5" htmlFor="room-code">Room code</label>
                <input
                  id="room-code"
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  required
                  className="field font-mono text-lg tracking-[0.35em]"
                />
              </div>
            )}

            {mode === 'create' && (
              <div>
                <label className="eyebrow block mb-1.5" htmlFor="room-name">Room name</label>
                <input
                  id="room-name"
                  type="text"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="Saturday Crew"
                  maxLength={100}
                  required
                  className="field"
                />
              </div>
            )}

            <div>
              <label className="eyebrow block mb-1.5" htmlFor="display-name">Your name</label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                maxLength={50}
                required
                className="field"
              />
            </div>

            {error && <p className="banner banner-error">{error}</p>}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Loading…' : mode === 'join' ? 'Join room' : 'Create room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
