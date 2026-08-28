import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import WeekPicker from '../components/WeekPicker.jsx';
import ParlayCard from '../components/ParlayCard.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import History from '../components/History.jsx';
import AdminPanel from '../components/AdminPanel.jsx';
import ConsensusVote from '../components/ConsensusVote.jsx';

const TABS = [
  { key: 'Pick', label: 'Pick' },
  { key: 'Parlay', label: 'Slip' },
  { key: 'Consensus', label: 'PSU' },
  { key: 'Standings', label: 'Standings' },
  { key: 'History', label: 'History' },
];

export default function HomePage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('Pick');

  const tabs = user?.isAdmin ? [...TABS, { key: 'Admin', label: 'Admin' }] : TABS;

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="wordmark">psu<b>Parlay</b></span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-chalk-dim">{user?.username}</span>
          <button
            onClick={logout}
            className="text-xs text-chalk-faint hover:text-chalk-dim transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === 'Pick'      && <WeekPicker />}
        {tab === 'Parlay'    && <ParlayCard />}
        {tab === 'Consensus' && <ConsensusVote />}
        {tab === 'Standings' && <Leaderboard />}
        {tab === 'History'   && <History />}
        {tab === 'Admin'     && <AdminPanel />}
      </main>

      <nav className="tabbar">
        {tabs.map(t => (
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
