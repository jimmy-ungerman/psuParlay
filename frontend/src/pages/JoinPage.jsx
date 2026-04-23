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
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏈</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">PSU Parlay</h1>
          <p className="text-gray-400 mt-1 text-sm">College football spread parlay with your crew</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
          {/* Mode Toggle */}
          <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('join')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'join' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Join Room
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'create' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Create Room
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'join' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Room Code</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-lg font-mono tracking-widest placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {mode === 'create' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Room Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="Saturday Crew"
                  maxLength={100}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide">Your Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                maxLength={50}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : mode === 'join' ? 'Join Room' : 'Create Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
