import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import HeadToHead from './HeadToHead.jsx';

const CURRENT_YEAR = new Date().getFullYear();

function StreakChip({ streak }) {
  if (!streak) return null;
  if (streak.type === 'win') return <span className="streak-chip up" title={`${streak.count}-week win streak`}>W{streak.count}</span>;
  if (streak.type === 'loss') return <span className="streak-chip down" title={`${streak.count}-week loss streak`}>L{streak.count}</span>;
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
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">{season === 'all' ? 'Every season' : `${season} season`}</p>
          <h2 className="dateline text-[2rem]">Standings</h2>
        </div>
        <select
          value={season}
          onChange={e => setSeason(e.target.value)}
          className="field !w-auto !py-1.5 !px-3 text-sm font-mono"
        >
          <option value={String(CURRENT_YEAR)}>{CURRENT_YEAR}</option>
          {seasons.filter(s => s !== CURRENT_YEAR).map(s => (
            <option key={s} value={String(s)}>{s}</option>
          ))}
          <option value="all">All time</option>
        </select>
      </div>

      {loading ? (
        <div className="p-6 text-center text-chalk-faint">Loading standings…</div>
      ) : error ? (
        <div className="p-6 text-center text-bust">{error}</div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-chalk-faint">No picks recorded yet</div>
      ) : (
        <div className="flex flex-col">
          {data.map((entry, idx) => {
            const isMe = entry.id && entry.id === currentUser?.id;
            const total = parseInt(entry.wins) + parseInt(entry.losses);
            const pct = total > 0 ? Math.round((parseInt(entry.wins) / total) * 100) : 0;
            const spreadStr = entry.spread_total !== null && entry.spread_total !== undefined
              ? formatSpread(entry.spread_total)
              : null;
            const spreadUp = parseFloat(entry.spread_total) >= 0;
            const tappable = !isMe && !isHistorical && entry.id;

            return (
              <button
                key={entry.display_name}
                onClick={() => tappable && setH2hUserId(entry.id)}
                disabled={!tappable}
                className={`w-full text-left grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 border-t border-line-soft first:border-t-0 py-3 transition-colors ${
                  isMe
                    ? 'bg-stripe text-ink -mx-4 px-4 rounded-md border-t-0'
                    : tappable ? 'hover:bg-navy-raised cursor-pointer' : 'cursor-default'
                }`}
              >
                <span
                  className={`font-display font-extrabold text-base text-center tabular-nums ${
                    isMe ? 'text-ink' : idx === 0 ? 'text-favor' : 'text-chalk-faint'
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold truncate ${isMe ? 'text-ink' : 'text-chalk'}`}>
                      {entry.display_name}
                    </span>
                    {isMe && <span className="text-xs text-ink-dim flex-shrink-0">you</span>}
                    {entry.streak && <StreakChip streak={entry.streak} />}
                  </div>
                  {total > 0 && (
                    <div className={`cover-track mt-1.5 ${isMe ? '!bg-paper-shade' : ''}`}>
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-bold text-sm tabular-nums">
                    <span className={isMe ? 'text-cash-ink' : 'text-cash'}>{entry.wins}</span>
                    <span className="text-chalk-faint">–</span>
                    <span className="text-bust">{entry.losses}</span>
                    {parseInt(entry.pushes) > 0 && (
                      <><span className="text-chalk-faint">–</span><span className="text-favor">{entry.pushes}</span></>
                    )}
                  </div>
                  <div className={`font-mono text-[0.62rem] mt-0.5 ${isMe ? 'text-ink-dim' : 'text-chalk-faint'}`}>
                    {total > 0 ? `${pct}%` : '—'}
                    {parseInt(entry.pending) > 0 && ` · ${entry.pending} live`}
                  </div>
                  {spreadStr && (
                    <div className={`font-mono text-[0.62rem] mt-0.5 ${
                      isMe ? (spreadUp ? 'text-cash-ink' : 'text-bust-ink') : spreadUp ? 'text-cash' : 'text-bust'
                    }`}>
                      {spreadStr}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!isHistorical && data.length > 0 && (
        <p className="text-center text-chalk-faint text-xs">Tap anyone to see your head-to-head</p>
      )}

      {h2hUserId && (
        <HeadToHead userId={h2hUserId} onClose={() => setH2hUserId(null)} />
      )}
    </div>
  );
}
