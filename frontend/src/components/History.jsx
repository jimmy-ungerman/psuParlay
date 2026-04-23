import { useState, useEffect } from 'react';
import { api } from '../api/index.js';

function formatSpread(spread) {
  const n = parseFloat(spread);
  return n > 0 ? `+${n}` : `${n}`;
}

function resultPill(result) {
  switch (result) {
    case 'win': return 'bg-green-500/20 text-green-400';
    case 'loss': return 'bg-red-500/20 text-red-400';
    case 'push': return 'bg-yellow-500/20 text-yellow-400';
    default: return 'bg-gray-700 text-gray-400';
  }
}

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.getHistory();
        setHistory(res.history || []);
        if (res.history?.length > 0) setExpanded(res.history[0].week_number);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-center text-gray-500">Loading history...</div>;
  if (error) return <div className="p-6 text-center text-red-400">{error}</div>;

  if (history.length === 0) {
    return (
      <div className="p-6 text-center py-12 text-gray-600">
        <p className="text-4xl mb-3">📋</p>
        <p>No completed weeks yet</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Past Weeks</h2>

      {history.map(week => {
        const isOpen = expanded === week.week_number;
        const wins = week.picks.filter(p => p.result === 'win').length;
        const total = week.picks.filter(p => p.result !== 'pending').length;
        const parlayColor = {
          win: 'text-green-400',
          loss: 'text-red-400',
          push: 'text-yellow-400',
          pending: 'text-gray-500',
        }[week.parlay_result];

        return (
          <div key={week.week_number} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {/* Week header */}
            <button
              onClick={() => setExpanded(isOpen ? null : week.week_number)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-white">Week {week.week_number}</span>
                <span className={`text-xs font-bold ${parlayColor}`}>
                  {week.parlay_result === 'win' ? 'PARLAY HIT' :
                   week.parlay_result === 'loss' ? 'PARLAY MISS' :
                   week.parlay_result === 'push' ? 'PUSH' : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{wins}/{total} W</span>
                <span className="text-gray-600">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Picks breakdown */}
            {isOpen && (
              <div className="border-t border-gray-800 divide-y divide-gray-800">
                {week.picks.map(pick => {
                  const pickedTeam = pick.picked_team === 'home' ? pick.home_team : pick.away_team;
                  const opponent = pick.picked_team === 'home' ? pick.away_team : pick.home_team;
                  const spread = pick.picked_team === 'home'
                    ? parseFloat(pick.home_spread)
                    : -parseFloat(pick.home_spread);

                  return (
                    <div key={pick.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-white">{pick.display_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {pickedTeam} {formatSpread(spread)} vs {opponent}
                        </p>
                        {pick.home_score !== null && (
                          <p className="text-xs text-gray-600 mt-0.5">
                            Final: {pick.home_team} {pick.home_score}–{pick.away_score} {pick.away_team}
                          </p>
                        )}
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${resultPill(pick.result)}`}>
                        {pick.result === 'pending' ? '—' : pick.result.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
