import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import WeekPicker from '../components/WeekPicker.jsx';
import ParlayCard from '../components/ParlayCard.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import History from '../components/History.jsx';
import AdminPanel from '../components/AdminPanel.jsx';
export default function HomePage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('Pick');

  const tabs = ['Pick', 'Parlay', 'Standings', 'History', ...(user?.isAdmin ? ['Admin'] : [])];

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-bold text-white text-lg">🏈 PSU Parlay</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user?.username}</span>
          <button
            onClick={logout}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="bg-gray-900 border-b border-gray-800 px-2">
        <div className="flex overflow-x-auto scrollbar-none">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-shrink-0 flex-1 py-3 text-sm font-medium transition-colors border-b-2 min-w-[70px] ${
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
        {tab === 'Pick'      && <WeekPicker />}
        {tab === 'Parlay'    && <ParlayCard />}
        {tab === 'Standings' && <Leaderboard />}
        {tab === 'History'   && <History />}
        {tab === 'Admin'     && <AdminPanel />}
      </main>
    </div>
  );
}
