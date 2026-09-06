import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReactionBar from './ReactionBar.jsx';
import TrashTalk from './TrashTalk.jsx';
import WeekRecap from './WeekRecap.jsx';

function formatSpread(spread) {
  if (spread === null || spread === undefined || spread === '') return '';
  const n = parseFloat(spread);
  return n > 0 ? `+${n}` : `${n}`;
}

function getParlayResult(picks) {
  if (picks.length === 0) return null;
  const settled = picks.filter(p => p.result !== 'pending');
  if (settled.length === 0) return 'pending';
  if (picks.some(p => p.result === 'loss')) return 'loss';
  if (settled.length === picks.length && picks.every(p => p.result === 'win')) return 'win';
  if (settled.length < picks.length) return 'pending';
  return 'push';
}

function getConsensusResult(game, psuSpread) {
  if (!game || game.status !== 'complete' || game.home_score === null) return 'pending';
  const psuIsHome = game.home_team.includes('Penn State');
  const psuScore = psuIsHome ? game.home_score : game.away_score;
  const oppScore = psuIsHome ? game.away_score : game.home_score;
  const diff = psuScore - oppScore + psuSpread;
  if (diff > 0) return 'win';
  if (diff < 0) return 'loss';
  return 'push';
}

// One printed line on the slip: name + line up top, and the matchup underneath —
// the opponent and kickoff before the game, the score once it's on.
function Leg({ who, bet, result, gameStatus, detail }) {
  const live = result === 'pending' && gameStatus === 'in_progress';

  let mark = null;
  if (result === 'win') mark = <span className="mark w">W</span>;
  else if (result === 'loss') mark = <span className="mark l">L</span>;
  else if (result === 'push') mark = <span className="mark">P</span>;
  else if (live) mark = <span className="mark live"><span className="dot pulse-dot" />Live</span>;

  return (
    <div className="leg">
      <span className="lede">
        <span className="who">{who}</span>
        <span className="bet">{bet}</span>
      </span>
      {mark}
      {detail && <span className="score">{detail}</span>}
    </div>
  );
}

// pickedSide: 'home' | 'away' | null (null / totals show the raw matchup)
function legDetail(g, pickedSide, isTotal) {
  if (!g) return null;
  const { home_team, away_team, home_abbr, away_abbr, home_score, away_score, status, commence_time } = g;

  let matchup;
  if (isTotal || !pickedSide) {
    matchup = `${away_team} @ ${home_team}`;
  } else {
    const opp = pickedSide === 'home' ? away_team : home_team;
    matchup = `${pickedSide === 'home' ? 'vs' : '@'} ${opp}`;
  }

  if (status === 'complete' && home_score !== null) {
    const pts = isTotal ? ` · ${home_score + away_score} pts` : '';
    return <>{matchup} · Final <b>{away_abbr} {away_score}–{home_score} {home_abbr}</b>{pts}</>;
  }
  if (status === 'in_progress' && home_score !== null) {
    return <>{matchup} · <span className="q">Live</span> <b>{away_abbr} {away_score}–{home_score} {home_abbr}</b></>;
  }
  const when = commence_time
    ? new Date(commence_time).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
    : null;
  return <>{matchup}{when ? ` · ${when}` : ''}</>;
}

export default function ParlayCard() {
  const { user: currentUser } = useAuth();
  const [picks, setPicks] = useState([]);
  const [consensus, setConsensus] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [parlayRecord, setParlayRecord] = useState(null);
  const [streaks, setStreaks] = useState({});
  const [week, setWeek] = useState(null);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [parlayLinks, setParlayLinks] = useState({ draftkings_url: null, fanduel_url: null });
  const [dkInput, setDkInput] = useState('');
  const [fdInput, setFdInput] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [editingLinks, setEditingLinks] = useState(false);

  const loadReactions = useCallback(async (w, s) => {
    if (!w || !s) return;
    try {
      const res = await api.getReactions(w, s);
      setReactions(res.reactions || []);
    } catch {}
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [res, usersRes, recordRes, leaderboardRes] = await Promise.all([
          api.getPicks(),
          api.getUsers(),
          api.getParlayRecord(),
          api.getLeaderboard(),
        ]);
        setPicks(res.picks || []);
        setWeek(res.week);
        setSeason(res.season);
        setAllUsers(usersRes.users || []);
        setParlayRecord(recordRes.allTime || null);
        const streakMap = {};
        for (const entry of leaderboardRes.leaderboard || []) {
          if (entry.id && entry.streak) streakMap[entry.id] = entry.streak;
        }
        setStreaks(streakMap);
        await loadReactions(res.week, res.season);
        const linkRes = await api.getParlayLink(res.week, res.season);
        setParlayLinks(linkRes);
        setDkInput(linkRes.draftkings_url || '');
        setFdInput(linkRes.fanduel_url || '');
        try {
          const cv = await api.getConsensus(res.week, res.season);
          setConsensus(cv.consensusReached ? cv : null);
        } catch { setConsensus(null); }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [loadReactions]);

  if (loading) return <div className="p-6 text-center text-chalk-faint">Loading the slip…</div>;
  if (error) return <div className="p-6 text-center text-bust">{error}</div>;

  const consensusResult = consensus ? getConsensusResult(consensus.game, consensus.psuSpread) : null;
  const consensusLeg = consensus
    ? { _consensus: true, result: consensusResult || 'pending', game: consensus.game, psuSpread: consensus.psuSpread }
    : null;

  // Legs read top to bottom in kickoff order, like a real slip.
  const legKickoff = (l) => {
    const t = l._consensus ? l.game?.commence_time : l.commence_time;
    return t ? new Date(t).getTime() : Infinity;
  };
  const allLegs = (consensusLeg ? [consensusLeg, ...picks] : [...picks])
    .slice()
    .sort((a, b) => legKickoff(a) - legKickoff(b));

  const canEditLinks = currentUser?.isAdmin || currentUser?.isLinkAdmin;
  const pickedUserIds = new Set(picks.map(p => p.user_id));
  const missing = allUsers.filter(u => !pickedUserIds.has(u.id));

  const legCount = allLegs.length;
  const settled = allLegs.filter(l => l.result !== 'pending');
  const wins = allLegs.filter(l => l.result === 'win').length;
  const losses = allLegs.filter(l => l.result === 'loss').length;
  const pending = legCount - settled.length;
  const parlayResult = getParlayResult(allLegs);

  let verdict;
  if (legCount === 0) verdict = null;
  else if (pending > 0) verdict = { cls: 'live', label: 'Live', dot: true };
  else if (parlayResult === 'win') verdict = { cls: 'live', label: 'Cashed' };
  else if (parlayResult === 'loss') verdict = { cls: 'dead', label: 'Busted' };
  else verdict = { cls: 'dead', label: 'Push' };

  const busted = parlayResult === 'loss';
  const allSettled = legCount > 0 && pending === 0;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <p className="eyebrow mb-1">The group parlay</p>
        <h2 className="dateline text-[2.4rem]">Week {week}</h2>
      </div>

      {legCount === 0 ? (
        <div className="slip">
          <div className="slip-head">
            <span className="t">PSU PARLAY</span>
            <span className="meta">Wk {week} · {season}<br />No legs yet</span>
          </div>
          <p className="text-ink-dim text-sm py-6 text-center font-mono">
            Nobody's on the board yet this week.
          </p>
        </div>
      ) : (
        <div className="slip">
          {busted && (
            <div className="slip-stamp"><span>Busted</span></div>
          )}
          <div className="slip-head">
            <span className="t">PSU PARLAY</span>
            <span className="meta">
              Wk {week} · {season}<br />
              {legCount} {legCount === 1 ? 'leg' : 'legs'}
              {missing.length > 0 && <><br />{missing.length} still out</>}
            </span>
          </div>

          <div className="slip-verdict">
            {!busted && (
              <>
                <span className={`chip ${verdict.cls}`}>
                  {verdict.dot && <span className="dot pulse-dot" />}
                  {verdict.label}
                </span>
                <span className="sep">·</span>
              </>
            )}
            <span className="cov">
              {wins} of {legCount} covered
              {pending > 0 && ` · ${pending} to play`}
            </span>
          </div>

          <div className="legs">
            {allLegs.map((leg) => {
              if (leg._consensus) {
                const g = leg.game;
                const psuIsHome = g?.home_team?.includes('Penn State');
                return (
                  <Leg
                    key="consensus"
                    who="Group pick"
                    bet={`Penn State ${formatSpread(leg.psuSpread)}`}
                    result={leg.result}
                    gameStatus={g?.status}
                    detail={legDetail(g, psuIsHome ? 'home' : 'away', false)}
                  />
                );
              }

              const isTotal = leg.picked_team === 'over' || leg.picked_team === 'under';
              const team = isTotal
                ? (leg.picked_team === 'over' ? 'Over' : 'Under')
                : (leg.picked_team === 'home' ? leg.home_team : leg.away_team);
              const bet = `${team} ${isTotal ? leg.spread_at_pick : formatSpread(leg.spread_at_pick)}`.trim();

              return (
                <Leg
                  key={leg.id}
                  who={leg.display_name}
                  bet={bet}
                  result={leg.result}
                  gameStatus={leg.game_status}
                  detail={legDetail(leg, isTotal ? null : leg.picked_team, isTotal)}
                />
              );
            })}
          </div>

          <div className="slip-foot">
            <span>{legCount}-leg parlay</span>
            <span>All or nothing</span>
          </div>
        </div>
      )}

      {/* Still out */}
      {legCount > 0 && missing.length > 0 && (
        <div className="card px-4 py-2.5 flex items-center gap-2 flex-wrap">
          <span className="eyebrow">No pick yet</span>
          {missing.map(u => (
            <span
              key={u.id}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                u.id === currentUser?.id ? 'bg-cash/25 text-cash' : 'bg-navy-sink text-chalk-dim'
              }`}
            >
              {u.username}{u.id === currentUser?.id ? ' (you)' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Sportsbook links */}
      {editingLinks ? (
        <div className="card p-3 flex flex-col gap-2">
          {[
            { label: 'DraftKings', value: dkInput, onChange: setDkInput },
            { label: 'FanDuel', value: fdInput, onChange: setFdInput },
          ].map(({ label, value, onChange }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="eyebrow w-24 shrink-0">{label}</span>
              <input
                type="url"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={`Paste the ${label} link`}
                className="field !py-2 text-sm"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              disabled={linkSaving}
              onClick={async () => {
                setLinkSaving(true);
                try {
                  const normalize = u => (u ? (u.startsWith('http') ? u : `https://${u}`) : null);
                  const res = await api.setParlayLink(week, season, normalize(dkInput.trim()), normalize(fdInput.trim()));
                  setParlayLinks(res);
                  setEditingLinks(false);
                } finally {
                  setLinkSaving(false);
                }
              }}
              className="btn btn-primary flex-1"
            >
              {linkSaving ? 'Saving…' : 'Save links'}
            </button>
            <button
              onClick={() => {
                setDkInput(parlayLinks.draftkings_url || '');
                setFdInput(parlayLinks.fanduel_url || '');
                setEditingLinks(false);
              }}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {[
            { label: 'DraftKings', url: parlayLinks.draftkings_url, cls: 'dk' },
            { label: 'FanDuel', url: parlayLinks.fanduel_url, cls: 'fd' },
          ].map(({ label, url, cls }) =>
            url ? (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer" className={`book ${cls}`}>
                Open in {label}
              </a>
            ) : (
              <span key={label} className="book opacity-55 select-none">{label}</span>
            )
          )}
          {canEditLinks && (
            <button
              onClick={() => setEditingLinks(true)}
              className="btn btn-ghost !px-3"
              aria-label="Edit sportsbook links"
            >
              Edit
            </button>
          )}
        </div>
      )}

      {/* Week recap (all legs settled) */}
      {allSettled && <WeekRecap picks={picks} allTimeRecord={parlayRecord} />}

      {/* Reactions + notes — the group's takes, per pick */}
      {picks.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="eyebrow">Reactions</p>
          {picks.map(pick => {
            const isTotal = pick.picked_team === 'over' || pick.picked_team === 'under';
            const team = isTotal
              ? (pick.picked_team === 'over' ? 'Over' : 'Under')
              : (pick.picked_team === 'home' ? pick.home_team : pick.away_team);
            const streak = streaks[pick.user_id];
            return (
              <div key={pick.id} className="card p-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-chalk">{pick.display_name}</span>
                  {streak && (
                    <span className={`streak-chip ${streak.type === 'win' ? 'up' : 'down'}`}>
                      {streak.type === 'win' ? 'W' : 'L'}{streak.count}
                    </span>
                  )}
                  <span className="text-xs font-mono text-chalk-faint ml-auto">
                    {team} {isTotal ? pick.spread_at_pick : formatSpread(pick.spread_at_pick)}
                  </span>
                </div>
                {pick.note && (
                  <p className="text-xs text-chalk-dim italic mt-1">"{pick.note}"</p>
                )}
                <ReactionBar
                  pickId={pick.id}
                  reactions={reactions.filter(r => r.pick_id === pick.id)}
                  onUpdate={() => loadReactions(week, season)}
                />
              </div>
            );
          })}
        </div>
      )}

      {legCount > 0 && <TrashTalk week={week} season={season} />}
    </div>
  );
}
