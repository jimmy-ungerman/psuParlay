import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import PickDetail from './PickDetail.jsx';

const CURRENT_YEAR = new Date().getFullYear();

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
    <div className="p-4 flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">{season} season</p>
          <h2 className="dateline text-[2rem]">Past weeks</h2>
        </div>
        <select
          value={season}
          onChange={e => setSeason(e.target.value)}
          className="field !w-auto !py-1.5 !px-3 text-sm font-mono"
        >
          {seasons.map(s => (
            <option key={s} value={String(s)}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-6 text-center text-chalk-faint">Loading history…</div>
      ) : error ? (
        <div className="p-6 text-center text-bust">{error}</div>
      ) : history.length === 0 ? (
        <div className="py-12 text-center text-chalk-faint">No completed weeks yet</div>
      ) : history.map(week => {
        const isOpen = expanded === week.week_number;
        const wins = week.picks.filter(p => p.result === 'win').length;
        const total = week.picks.filter(p => p.result !== 'pending').length;
        const parlayColor = {
          win: 'text-cash',
          loss: 'text-bust',
          push: 'text-favor',
          pending: 'text-chalk-faint',
        }[week.parlay_result];

        return (
          <div key={week.week_number} className="card overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : week.week_number)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-navy-sink transition-colors"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-chalk">Week {week.week_number}</span>
                <span className={`font-mono text-[0.66rem] tracking-wide font-semibold ${parlayColor}`}>
                  {week.parlay_result === 'win' ? 'PARLAY CASHED' :
                   week.parlay_result === 'loss' ? 'PARLAY BUSTED' :
                   week.parlay_result === 'push' ? 'PUSH' : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs text-chalk-faint">
                <span>{wins}/{total} W</span>
                <span>{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-line-soft divide-y divide-line-soft">
                {week.picks.map(pick => (
                  <PickDetail key={pick.id ?? pick.display_name} pick={pick} isHistorical={week.is_historical} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
