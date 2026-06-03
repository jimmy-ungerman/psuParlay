import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReactionBar from './ReactionBar.jsx';
import TrashTalk from './TrashTalk.jsx';
import WeekRecap from './WeekRecap.jsx';

function formatSpread(spread) {
  const n = parseFloat(spread);
  return n > 0 ? `+${n}` : `${n}`;
}

function resultBadge(result) {
  switch (result) {
    case 'win': return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">W</span>;
    case 'loss': return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400">L</span>;
    case 'push': return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400">P</span>;
    default: return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-700 text-gray-400">—</span>;
  }
}

function LineMovement({ movement }) {
  if (movement === 0) return <span className="text-gray-500 text-xs">no movement</span>;
  const favorable = movement > 0;
  return (
    <span className={`text-xs font-medium ${favorable ? 'text-green-400' : 'text-red-400'}`}>
      {favorable ? '▲' : '▼'} {Math.abs(movement).toFixed(1)}
    </span>
  );
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

export default function ParlayCard() {
  const { user: currentUser } = useAuth();
  const [picks, setPicks] = useState([]);
  const [consensus, setConsensus] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [parlayRecord, setParlayRecord] = useState(null);
  const [week, setWeek] = useState(null);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [parlayLinks, setParlayLinks] = useState({ draftkings_url: null, fanduel_url: null });
  const [dkInput, setDkInput] = useState('');
  const [fdInput, setFdInput] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);

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
        const [res, usersRes, recordRes] = await Promise.all([
          api.getPicks(),
          api.getUsers(),
          api.getParlayRecord(),
        ]);
        setPicks(res.picks || []);
        setWeek(res.week);
        setSeason(res.season);
        setAllUsers(usersRes.users || []);
        setParlayRecord(recordRes.allTime || null);
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
  }, []);

  if (loading) return <div className="p-6 text-center text-gray-500">Loading parlay...</div>;
  if (error) return <div className="p-6 text-center text-red-400">{error}</div>;

  const consensusResult = consensus ? getConsensusResult(consensus.game, consensus.psuSpread) : null;
  const allLegs = consensus ? [...picks, { _consensus: true, result: consensusResult || 'pending' }] : picks;
  const parlayResult = getParlayResult(allLegs);
  const parlayBanner = {
    win:     { bg: 'bg-green-500/10 border-green-500/30',   text: 'text-green-400',  label: 'Parlay Wins!' },
    loss:    { bg: 'bg-red-500/10 border-red-500/30',       text: 'text-red-400',    label: 'Parlay Loses' },
    push:    { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', label: 'Parlay Pushes' },
    pending: { bg: 'bg-gray-800/50 border-gray-700',        text: 'text-gray-400',   label: 'In Progress' },
  }[parlayResult || 'pending'];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Week {week} Parlay</h2>
        <span className="text-xs text-gray-600">{allLegs.length} {allLegs.length === 1 ? 'leg' : 'legs'}</span>
      </div>

      {/* Parlay links — admin can set, everyone can open */}
      {(currentUser?.isAdmin || currentUser?.isLinkAdmin) ? (
        <div className="space-y-2">
          {[
            { label: 'DraftKings', value: dkInput, onChange: setDkInput },
            { label: 'FanDuel',    value: fdInput, onChange: setFdInput },
          ].map(({ label, value, onChange }) => (
            <div key={label} className="flex gap-2">
              <span className="text-xs text-gray-500 font-medium w-24 shrink-0 flex items-center">{label}</span>
              <input
                type="url"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={`Paste ${label} parlay link...`}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}
          <button
            disabled={linkSaving}
            onClick={async () => {
              setLinkSaving(true);
              try {
                const normalize = u => u ? (u.startsWith('http') ? u : `https://${u}`) : null;
                const res = await api.setParlayLink(week, season, normalize(dkInput.trim()), normalize(fdInput.trim()));
                setParlayLinks(res);
              } finally {
                setLinkSaving(false);
              }
            }}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
          >
            {linkSaving ? 'Saving...' : 'Save Links'}
          </button>
        </div>
      ) : (parlayLinks.draftkings_url || parlayLinks.fanduel_url) ? (
        <div className="flex gap-2">
          {parlayLinks.draftkings_url && (
            <a
              href={parlayLinks.draftkings_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 font-medium text-sm rounded-xl px-4 py-3"
            >
              🎰 DraftKings
            </a>
          )}
          {parlayLinks.fanduel_url && (
            <a
              href={parlayLinks.fanduel_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 font-medium text-sm rounded-xl px-4 py-3"
            >
              🎰 FanDuel
            </a>
          )}
        </div>
      ) : null}

      {picks.length === 0 && !consensus ? (
        <div className="text-center py-12 text-gray-600">
          <p className="text-4xl mb-3">🎰</p>
          <p>No picks yet this week</p>
        </div>
      ) : (
        <>
          {/* Who still needs a pick */}
          {(() => {
            const pickedUserIds = new Set(picks.map(p => p.user_id));
            const missing = allUsers.filter(u => !pickedUserIds.has(u.id));
            if (missing.length === 0) return null;
            return (
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-medium">Still needs a pick:</span>
                {missing.map(u => (
                  <span key={u.id} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.id === currentUser?.id
                      ? 'bg-blue-600/30 text-blue-300'
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {u.username}{u.id === currentUser?.id ? ' (you)' : ''}
                  </span>
                ))}
              </div>
            );
          })()}

          {/* Week recap (shown when all picks settled) */}
          <WeekRecap picks={picks} allTimeRecord={parlayRecord} />

          {/* Parlay status banner */}
          {picks.some(p => p.result === 'pending') && (
          <div className={`rounded-xl border px-4 py-3 ${parlayBanner.bg}`}>
            <div className="flex items-center justify-between">
              <span className={`font-bold ${parlayBanner.text}`}>{parlayBanner.label}</span>
              <span className="text-sm text-gray-500">
                {allLegs.filter(p => p.result === 'win').length}/{allLegs.length} covering
              </span>
            </div>
          </div>
          )}

          {/* Individual picks */}
          <div className="space-y-3">
            {/* Group consensus PSU pick */}
            {consensus && (() => {
              const { game, psuSpread } = consensus;
              const psuIsHome = game ? game.home_team.includes('Penn State') : null;
              const opponent = game ? (psuIsHome ? game.away_team : game.home_team) : null;
              const location = psuIsHome ? 'vs' : '@';
              const isLive = game?.status === 'in_progress';
              const isComplete = game?.status === 'complete';
              return (
                <div className="bg-gray-900 rounded-xl border border-blue-500/40 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">PSU Pick</span>
                      <span className="text-xs bg-blue-500/20 text-blue-400 font-semibold px-2 py-0.5 rounded-full">GROUP</span>
                    </div>
                    {resultBadge(consensusResult)}
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-bold text-white">Penn State</span>
                    {psuSpread !== null && <span className="text-blue-400 font-semibold">{formatSpread(psuSpread)}</span>}
                    {opponent && <span className="text-gray-600 text-xs">{location} {opponent}</span>}
                  </div>
                  {(isLive || isComplete) && game.home_score !== null && (
                    <div className={`mt-2 text-xs font-medium ${isLive ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />}
                      {game.home_abbr} {game.home_score} – {game.away_score} {game.away_abbr}
                      {isLive && ' (Live)'}
                      {isComplete && ' (Final)'}
                    </div>
                  )}
                </div>
              );
            })()}

            {picks.map(pick => {
              const isTotalPick = pick.picked_team === 'over' || pick.picked_team === 'under';
              const pickedTeam = isTotalPick ? (pick.picked_team === 'over' ? 'Over' : 'Under') : (pick.picked_team === 'home' ? pick.home_team : pick.away_team);
              const opponent   = isTotalPick ? `${pick.home_team} vs ${pick.away_team}` : (pick.picked_team === 'home' ? pick.away_team : pick.home_team);
              const isGameLive = pick.game_status === 'in_progress';
              const isComplete = pick.game_status === 'complete';
              const pickReactions = reactions.filter(r => r.pick_id === pick.id);

              return (
                <div key={pick.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white text-sm">{pick.display_name}</span>
                    {resultBadge(pick.result)}
                  </div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-bold text-white">{pickedTeam}</span>
                    <span className="text-blue-400 font-semibold">{formatSpread(pick.current_picked_spread)}</span>
                    <span className="text-gray-600 text-xs">vs {opponent}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Picked at {formatSpread(pick.spread_at_pick)}</span>
                    <LineMovement movement={pick.line_movement} />
                  </div>

                  {(isGameLive || isComplete) && (
                    <div className={`mt-2 text-xs font-medium ${isGameLive ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {isGameLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />}
                      {pick.home_abbr} {pick.home_score} – {pick.away_score} {pick.away_abbr}
                      {isTotalPick && pick.home_score !== null && ` (${pick.home_score + pick.away_score} pts)`}
                      {isGameLive && ' (Live)'}
                      {isComplete && ' (Final)'}
                    </div>
                  )}

                  <ReactionBar
                    pickId={pick.id}
                    reactions={pickReactions}
                    onUpdate={() => loadReactions(week, season)}
                  />
                </div>
              );
            })}
          </div>

          <TrashTalk week={week} season={season} />
        </>
      )}
    </div>
  );
}
