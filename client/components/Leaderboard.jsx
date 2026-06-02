import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import HeadToHead from './HeadToHead.jsx';

const CURRENT_YEAR = new Date().getFullYear();

function StreakBadge({ streak }) {
  if (!streak) return null;
  if (streak.type === 'win')  return <span title={`${streak.count}-week win streak`}>🔥 {streak.count}</span>;
  if (streak.type === 'loss') return <span title={`${streak.count}-week loss streak`}>🥶 {streak.count}</span>;
  return null;
}

function formatSpread(val) {
  if (val === null || val === undefined) return null;
  const n = parseFloat(val);
  return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

export default function Leaderboard() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState([]);
  const [season, setSeason] = useState(String(CURRENT_YEAR));
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [h2hUserId, setH2hUserId] = useState(null);

  useEffect(() => {
    api.getSeasons().then(res => {
      const list = res.seasons || [];
      // Ensure current year is in the list even before any picks exist
      if (!list.includes(CURRENT_YEAR)) list.unshift(CURRENT_YEAR);
      setSeasons(list);
    }).catch(() => setSeasons([CURRENT_YEAR]));
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setH2hUserId(null);
      try {
        const res = await api.getLeaderboard(season);
        setData(res.leaderboard || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [season]);

  const isHistorical = season !== String(CURRENT_YEAR) && season !== 'all';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          {season === 'all' ? 'All-Time Standings' : `${season} Standings`}
        </h2>
        <select
          value={season}
          onChange={e => setSeason(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none"
        >
          <option value={String(CURRENT_YEAR)}>{CURRENT_YEAR}</option>
          {seasons.filter(s => s !== CURRENT_YEAR).map(s => (
            <option key={s} value={String(s)}>{s}</option>
          ))}
          <option value="all">All Time</option>
        </select>
      </div>

      {loading ? (
        <div className="p-6 text-center text-gray-500">Loading standings...</div>
      ) : error ? (
        <div className="p-6 text-center text-red-400">{error}</div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-600">No picks recorded yet</div>
      ) : (
        <div className="space-y-2">
          {data.map((entry, idx) => {
            const isMe = entry.id && entry.id === currentUser?.id;
            const total = parseInt(entry.wins) + parseInt(entry.losses);
            const pct = total > 0 ? Math.round((parseInt(entry.wins) / total) * 100) : 0;
            const spreadStr = entry.spread_total !== null && entry.spread_total !== undefined
              ? formatSpread(entry.spread_total)
              : null;

            return (
              <button
                key={entry.display_name}
                onClick={() => !isMe && !isHistorical && entry.id && setH2hUserId(entry.id)}
                disabled={isMe || isHistorical || !entry.id}
                className={`w-full text-left rounded-xl border p-4 transition-colors ${
                  isMe
                    ? 'bg-blue-600/10 border-blue-600/30 cursor-default'
                    : isHistorical || !entry.id
                    ? 'bg-gray-900 border-gray-800 cursor-default'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-600 active:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <span className={`text-xl font-bold w-8 text-center flex-shrink-0 ${idx === 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </span>

                  {/* Name + streak + win bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate">{entry.display_name}</span>
                      {isMe && <span className="text-xs text-blue-400 flex-shrink-0">you</span>}
                      {entry.streak && (
                        <span className="text-sm flex-shrink-0">
                          <StreakBadge streak={entry.streak} />
                        </span>
                      )}
                    </div>
                    {total > 0 && (
                      <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden w-full">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Record + spread */}
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold tabular-nums">
                      <span className="text-green-400">{entry.wins}</span>
                      <span className="text-gray-600">-</span>
                      <span className="text-red-400">{entry.losses}</span>
                      {parseInt(entry.pushes) > 0 && (
                        <><span className="text-gray-600">-</span><span className="text-yellow-400">{entry.pushes}</span></>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {total > 0 ? `${pct}%` : '—'}
                      {parseInt(entry.pending) > 0 && ` · ${entry.pending} pending`}
                    </div>
                    {spreadStr && (
                      <div className={`text-xs font-mono mt-0.5 ${parseFloat(entry.spread_total) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {spreadStr}
                      </div>
                    )}
                    {!isMe && !isHistorical && entry.id && (
                      <div className="text-xs text-gray-700 mt-0.5">tap for H2H</div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {h2hUserId && (
        <HeadToHead userId={h2hUserId} onClose={() => setH2hUserId(null)} />
      )}
    </div>
  );
}
