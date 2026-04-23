import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import WeekPicker from '../components/WeekPicker.jsx';
import ParlayCard from '../components/ParlayCard.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import History from '../components/History.jsx';

const TABS = ['Pick', 'Parlay', 'Standings', 'History'];

export default function RoomPage() {
  const { code } = useParams();
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Pick');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!auth || auth.room.code !== code.toUpperCase()) {
      navigate('/');
    }
  }, [auth, code, navigate]);

  if (!auth) return null;

  function copyCode() {
    navigator.clipboard.writeText(code.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-white text-lg leading-tight">{auth.room.name}</h1>
          <button
            onClick={copyCode}
            className="text-xs text-gray-400 hover:text-blue-400 transition-colors font-mono"
          >
            {copied ? 'Copied!' : `Room: ${code.toUpperCase()}`}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{auth.user.display_name}</span>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-2">
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                tab === t
                  ? 'text-blue-400 border-blue-400'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {tab === 'Pick' && <WeekPicker roomCode={code} />}
        {tab === 'Parlay' && <ParlayCard roomCode={code} />}
        {tab === 'Standings' && <Leaderboard roomCode={code} />}
        {tab === 'History' && <History roomCode={code} />}
      </main>
    </div>
  );
}
