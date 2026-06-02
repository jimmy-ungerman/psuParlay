import { useState, useEffect } from 'react';
import { api } from '../api/index.js';

const CURRENT_YEAR = new Date().getFullYear();

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
  const [season, setSeason] = useState(String(CURRENT_YEAR));
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    api.getSeasons().then(res => {
      const list = res.seasons || [];
      if (!list.includes(CURRENT_YEAR)) list.unshift(CURRENT_YEAR);
      setSeasons(list);
    }).catch(() => setSeasons([CURRENT_YEAR]));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setExpanded(null);
      try {
        const res = await api.getHistory(season);
        setHistory(res.history || []);
        if (res.history?.length > 0) setExpanded(res.history[0].week_number);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [season]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Past Weeks</h2>
        <select
          value={season}
          onChange={e => setSeason(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none"
        >
          {seasons.map(s => (
            <option key={s} value={String(s)}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-6 text-center text-gray-500">Loading history...</div>
      ) : error ? (
        <div className="p-6 text-center text-red-400">{error}</div>
      ) : history.length === 0 ? (
        <div className="p-6 text-center py-12 text-gray-600">
          <p className="text-4xl mb-3">📋</p>
          <p>No completed weeks yet</p>
        </div>
      ) : history.map(week => {
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

            {isOpen && (
              <div className="border-t border-gray-800 divide-y divide-gray-800">
                {week.is_historical ? (
                  // Historical picks: simplified view
                  week.picks.map(pick => (
                    <div key={pick.display_name} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm text-white">{pick.display_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {pick.picked_team || '—'}
                        </p>
                        <p className={`text-xs mt-0.5 font-mono ${parseFloat(pick.spread_value) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatSpread(pick.spread_value)}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${resultPill(pick.result)}`}>
                        {pick.result.toUpperCase()}
                      </span>
                    </div>
                  ))
                ) : (
                  // Live picks: full game detail
                  week.picks.map(pick => {
                    const isTotalPick = pick.picked_team === 'over' || pick.picked_team === 'under';
                    const pickedTeam = isTotalPick ? null : (pick.picked_team === 'home' ? pick.home_team : pick.away_team);
                    const opponent = isTotalPick ? null : (pick.picked_team === 'home' ? pick.away_team : pick.home_team);
                    const spread = isTotalPick
                      ? parseFloat(pick.spread_at_pick)
                      : pick.picked_team === 'home' ? parseFloat(pick.home_spread) : -parseFloat(pick.home_spread);

                    return (
                      <div key={pick.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm text-white">{pick.display_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {isTotalPick
                              ? `${pick.picked_team === 'over' ? 'Over' : 'Under'} ${spread} · ${pick.home_team} vs ${pick.away_team}`
                              : `${pickedTeam} ${formatSpread(spread)} vs ${opponent}`}
                          </p>
                          {pick.home_score !== null && (
                            <p className="text-xs text-gray-600 mt-0.5">
                              Final: {pick.home_team} {pick.home_score}–{pick.away_score} {pick.away_team}
                              {isTotalPick && ` (${pick.home_score + pick.away_score} pts)`}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${resultPill(pick.result)}`}>
                          {pick.result === 'pending' ? '—' : pick.result.toUpperCase()}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
