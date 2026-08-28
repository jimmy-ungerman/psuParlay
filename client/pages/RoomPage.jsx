import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import WeekPicker from '../components/WeekPicker.jsx';
import ParlayCard from '../components/ParlayCard.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import History from '../components/History.jsx';

const TABS = [
  { key: 'Pick', label: 'Pick' },
  { key: 'Parlay', label: 'Slip' },
  { key: 'Standings', label: 'Standings' },
  { key: 'History', label: 'History' },
];

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
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="wordmark leading-tight">{auth.room.name}</h1>
          <button
            onClick={copyCode}
            className="text-xs text-chalk-dim hover:text-cash transition-colors font-mono"
          >
            {copied ? 'Copied!' : `Room ${code.toUpperCase()}`}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-chalk-dim">{auth.user.display_name}</span>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="text-xs text-chalk-faint hover:text-chalk-dim transition-colors"
          >
            Leave
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === 'Pick' && <WeekPicker roomCode={code} />}
        {tab === 'Parlay' && <ParlayCard roomCode={code} />}
        {tab === 'Standings' && <Leaderboard roomCode={code} />}
        {tab === 'History' && <History roomCode={code} />}
      </main>

      <nav className="tabbar">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? 'is-active' : ''}
            aria-current={tab === t.key ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
