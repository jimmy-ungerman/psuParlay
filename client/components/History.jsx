import { useState, useEffect } from 'react';
import { api } from '../api/index.js';

const CURRENT_YEAR = new Date().getFullYear();

function formatSpread(spread) {
  const n = parseFloat(spread);
  return n > 0 ? `+${n}` : `${n}`;
}

function ResultChip({ result }) {
  const map = {
    win: 'up',
    loss: 'down',
    push: 'up',
  };
  const label = result === 'pending' ? '—' : result.toUpperCase();
  return <span className={`streak-chip ${map[result] || ''}`}>{label}</span>;
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
                {week.is_historical ? (
                  week.picks.map(pick => {
                    const hasGame = pick.home_team != null;
                    const isTeamPick = pick.canonical_team != null;

                    let pickedFullTeam = null, opponent = null;
                    if (isTeamPick && hasGame) {
                      const canon = pick.canonical_team.toLowerCase();
                      const homeMatch = pick.home_team.toLowerCase().includes(canon);
                      pickedFullTeam = homeMatch ? pick.home_team : pick.away_team;
                      opponent = homeMatch ? pick.away_team : pick.home_team;
                    }

                    const spreadMatch = pick.picked_team?.match(/([+-]?\d+\.?\d*)$/);
                    const spreadText = spreadMatch ? formatSpread(parseFloat(spreadMatch[1])) : '';

                    return (
                      <div key={pick.display_name} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-chalk">{pick.display_name}</p>
                          <p className="text-xs text-chalk-dim mt-0.5 font-mono">
                            {isTeamPick && pickedFullTeam
                              ? `${pickedFullTeam} ${spreadText}${opponent ? ` vs ${opponent}` : ''}`
                              : hasGame
                                ? `${pick.picked_team} · ${pick.home_team} vs ${pick.away_team}`
                                : pick.picked_team || '—'}
                          </p>
                          {hasGame && pick.game_status === 'complete' && pick.home_score !== null && (
                            <p className="text-xs text-chalk-faint mt-0.5 font-mono">
                              Final: {pick.home_team} {pick.home_score}–{pick.away_score} {pick.away_team}
                            </p>
                          )}
                        </div>
                        <ResultChip result={pick.result} />
                      </div>
                    );
                  })
                ) : (
                  week.picks.map(pick => {
                    const isTotalPick = pick.picked_team === 'over' || pick.picked_team === 'under';
                    const pickedTeam = isTotalPick ? null : (pick.picked_team === 'home' ? pick.home_team : pick.away_team);
                    const opponent = isTotalPick ? null : (pick.picked_team === 'home' ? pick.away_team : pick.home_team);
                    const spread = isTotalPick
                      ? parseFloat(pick.spread_at_pick)
                      : pick.picked_team === 'home' ? parseFloat(pick.home_spread) : -parseFloat(pick.home_spread);

                    return (
                      <div key={pick.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-chalk">{pick.display_name}</p>
                          <p className="text-xs text-chalk-dim mt-0.5 font-mono">
                            {isTotalPick
                              ? `${pick.picked_team === 'over' ? 'Over' : 'Under'} ${spread} · ${pick.home_team} vs ${pick.away_team}`
                              : `${pickedTeam} ${formatSpread(spread)} vs ${opponent}`}
                          </p>
                          {pick.game_status === 'complete' && pick.home_score !== null && (
                            <p className="text-xs text-chalk-faint mt-0.5 font-mono">
                              Final: {pick.home_team} {pick.home_score}–{pick.away_score} {pick.away_team}
                              {isTotalPick && ` (${pick.home_score + pick.away_score} pts)`}
                            </p>
                          )}
                        </div>
                        <ResultChip result={pick.result} />
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
