import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { matchesSearch, CONF_ORDER, getConference } from '../utils/conferences.js';

function formatSpread(spread) {
  const n = parseFloat(spread);
  return n > 0 ? `+${n}` : `${n}`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function WeekPicker() {
  const { user } = useAuth();
  const [games, setGames] = useState([]);
  const [week, setWeek] = useState(null);
  const [myPick, setMyPick] = useState(null);
  const [claimedGames, setClaimedGames] = useState({}); // gameId -> username
  const [activeConf, setActiveConf] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [gamesRes, picksRes] = await Promise.all([
        api.getGames(),
        api.getPicks(),
      ]);
      setGames(gamesRes.games || []);
      setWeek(gamesRes.week);

      const mine = (picksRes.picks || []).find(p => p.user_id === user?.id);
      setMyPick(mine || null);

      // Build a map of gameId -> username for games claimed by others
      const claimed = {};
      for (const p of picksRes.picks || []) {
        if (p.user_id !== user?.id) claimed[p.game_id] = p.display_name;
      }
      setClaimedGames(claimed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handlePick(gameId, pickedTeam) {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.submitPick(gameId, pickedTeam);
      setSuccess('Pick submitted!');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Countdown to first kickoff
  const deadline = useMemo(() => {
    const future = games.map(g => new Date(g.commence_time)).filter(d => d > new Date());
    return future.length ? new Date(Math.min(...future)) : null;
  }, [games]);

  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    if (!deadline) return;
    function tick() {
      const diff = deadline - Date.now();
      if (diff <= 0) { setTimeLeft(null); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ d, h, m, s, total: diff });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  // Build conference tabs from games actually present this week, in standard order
  const conferences = useMemo(() => {
    const present = new Set();
    games.forEach(g => {
      present.add(g.conference || getConference(g.home_team));
      present.add(getConference(g.away_team));
    });
    return ['All', ...CONF_ORDER.filter(c => present.has(c))];
  }, [games]);

  const filteredGames = useMemo(() => {
    return games.filter(g => {
      const homeConf = g.conference || getConference(g.home_team);
      const awayConf = getConference(g.away_team);
      const matchesConf = activeConf === 'All' || homeConf === activeConf || awayConf === activeConf;
      return matchesConf && matchesSearch(g, search);
    });
  }, [games, activeConf, search]);

  if (loading) return <div className="p-6 text-center text-gray-500">Loading games...</div>;

  if (games.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <div className="text-4xl mb-3">🏈</div>
        <p className="font-medium text-gray-300">No games available</p>
        <p className="text-sm mt-1">Games will appear here when the season starts.</p>
      </div>
    );
  }

  const isLocked = (game) => new Date(game.commence_time) <= new Date();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Week {week} — Pick Your Game</h2>
      </div>

      {/* Countdown to first kickoff */}
      {timeLeft && (
        <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
          timeLeft.total < 3600000 ? 'bg-red-500/10 border-red-500/30' :
          timeLeft.total < 86400000 ? 'bg-yellow-500/10 border-yellow-500/30' :
          'bg-gray-800/50 border-gray-700'
        }`}>
          <span className={`text-xs font-semibold uppercase tracking-wide ${
            timeLeft.total < 3600000 ? 'text-red-400' :
            timeLeft.total < 86400000 ? 'text-yellow-400' : 'text-gray-500'
          }`}>
            {myPick ? 'Locks in' : 'Pick deadline'}
          </span>
          <span className={`font-mono font-bold tabular-nums ${
            timeLeft.total < 3600000 ? 'text-red-400' :
            timeLeft.total < 86400000 ? 'text-yellow-300' : 'text-white'
          }`}>
            {timeLeft.d > 0 && `${timeLeft.d}d `}
            {(timeLeft.d > 0 || timeLeft.h > 0) && `${timeLeft.h}h `}
            {`${String(timeLeft.m).padStart(2,'0')}m `}
            {timeLeft.total < 3600000 && `${String(timeLeft.s).padStart(2,'0')}s`}
          </span>
        </div>
      )}

      {myPick && (
        <div className="flex justify-end">
          <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full">Pick made</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search teams..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Conference filter tabs */}
      {conferences.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
          {conferences.map(conf => (
            <button
              key={conf}
              onClick={() => setActiveConf(conf)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeConf === conf
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {conf}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-green-400 text-sm bg-green-400/10 rounded-lg px-3 py-2">{success}</p>}

      {myPick && (
        <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-4">
          <p className="text-xs text-blue-400 font-medium uppercase tracking-wide mb-1">Your Pick</p>
          <p className="font-semibold text-white">
            {myPick.picked_team === 'home' ? myPick.home_team : myPick.away_team}
            <span className="text-blue-300 ml-2">{formatSpread(myPick.spread_at_pick)}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {myPick.picked_team === 'home' ? myPick.away_team : myPick.home_team} (opponent)
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Locked before kickoff — you can change until then</p>
        </div>
      )}

      {filteredGames.length === 0 && (
        <p className="text-center text-gray-600 py-8 text-sm">No games match "{search}"</p>
      )}

      <div className="space-y-3">
        {filteredGames.map(game => {
          const locked = isLocked(game);
          const isMyGame = myPick?.game_id === game.id;
          const takenBy = !isMyGame ? claimedGames[game.id] : null;
          const unavailable = locked || !!takenBy;

          return (
            <div
              key={game.id}
              className={`bg-gray-900 rounded-xl border transition-colors ${
                isMyGame ? 'border-blue-600/50' : takenBy ? 'border-gray-800 opacity-50' : 'border-gray-800'
              }`}
            >
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <span className="text-xs text-gray-500">{formatTime(game.commence_time)}</span>
                {takenBy && (
                  <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                    {takenBy}'s pick
                  </span>
                )}
                {!takenBy && locked && (
                  <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                    {game.status === 'complete' ? 'Final' : game.status === 'in_progress' ? 'Live' : 'Locked'}
                  </span>
                )}
                {game.status === 'complete' && (
                  <span className="text-xs text-gray-400">
                    {game.home_abbr} {game.home_score} – {game.away_score} {game.away_abbr}
                  </span>
                )}
              </div>

              {/* Home team */}
              <button
                disabled={unavailable || submitting}
                onClick={() => handlePick(game.id, 'home')}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors rounded-t-none ${
                  isMyGame && myPick.picked_team === 'home' ? 'bg-blue-600/20' : ''
                } disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2">
                  {isMyGame && myPick.picked_team === 'home' && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                  <span className="font-medium text-white">{game.home_team}</span>
                  <span className="text-xs text-gray-500">HOME</span>
                </div>
                <span className={`font-semibold tabular-nums ${parseFloat(game.home_spread) < 0 ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {formatSpread(game.home_spread)}
                </span>
              </button>

              <div className="border-t border-gray-800 mx-4" />

              {/* Away team */}
              <button
                disabled={unavailable || submitting}
                onClick={() => handlePick(game.id, 'away')}
                className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors ${
                  isMyGame && myPick.picked_team === 'away' ? 'bg-blue-600/20' : ''
                } disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2">
                  {isMyGame && myPick.picked_team === 'away' && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                  <span className="font-medium text-white">{game.away_team}</span>
                  <span className="text-xs text-gray-500">AWAY</span>
                </div>
                <span className={`font-semibold tabular-nums ${parseFloat(game.home_spread) > 0 ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {formatSpread(-parseFloat(game.home_spread))}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
