import { useState, useEffect, useMemo } from 'react';
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
  const [consensusReached, setConsensusReached] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

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
      setNote(mine?.note || '');

      // Build a map of gameId -> username for games claimed by others
      const claimed = {};
      for (const p of picksRes.picks || []) {
        if (p.user_id !== user?.id) claimed[p.game_id] = p.display_name;
      }
      setClaimedGames(claimed);

      if (gamesRes.week && gamesRes.season) {
        const consensusRes = await api.getConsensus(gamesRes.week, gamesRes.season).catch(() => null);
        setConsensusReached(consensusRes?.consensusReached || false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSaveNote() {
    if (noteSaving) return;
    setNoteSaving(true);
    try {
      await api.updatePickNote(note);
      setMyPick(p => ({ ...p, note: note.trim() || null }));
    } catch (err) {
      setError(err.message);
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleClearPick() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.clearPick();
      setSuccess('Pick cleared.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePick(gameId, pickedTeam) {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.submitPick(gameId, pickedTeam);
      setSuccess('Pick submitted.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Countdown to first kickoff
  const deadline = useMemo(() => {
    const saturdays = games.filter(g => new Date(g.commence_time).getDay() === 6);
    if (!saturdays.length) return null;
    const firstSaturday = new Date(Math.min(...saturdays.map(g => new Date(g.commence_time))));
    const dateStr = firstSaturday.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const [year, month, day] = dateStr.split('-').map(Number);
    for (const offset of [4, 5]) {
      const candidate = new Date(Date.UTC(year, month - 1, day, 11 + offset, 30));
      const easternHour = parseInt(
        candidate.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false })
      );
      if (easternHour === 11) return candidate;
    }
    return null;
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
    games.filter(g => new Date(g.commence_time).getDay() === 6).forEach(g => {
      present.add(getConference(g.home_team));
      present.add(getConference(g.away_team));
    });
    return ['All', ...CONF_ORDER.filter(c => present.has(c))];
  }, [games]);

  const filteredGames = useMemo(() => {
    const list = games.filter(g => {
      if (new Date(g.commence_time).getDay() !== 6) return false;
      const homeConf = getConference(g.home_team);
      const awayConf = getConference(g.away_team);
      const matchesConf = activeConf === 'All' || homeConf === activeConf || awayConf === activeConf;
      return matchesConf && matchesSearch(g, search);
    });

    // The game you've picked is always shown, and always first — no matter the
    // filter or search, so you never lose track of it.
    if (myPick?.game_id) {
      const picked = games.find(g => g.id === myPick.game_id);
      if (picked) return [picked, ...list.filter(g => g.id !== picked.id)];
    }
    return list;
  }, [games, activeConf, search, myPick]);

  if (loading) return <div className="p-6 text-center text-chalk-faint">Loading games…</div>;

  if (games.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="dateline text-2xl mb-2">No games yet</p>
        <p className="text-sm text-chalk-dim">They'll show up here once the week's lines are posted.</p>
      </div>
    );
  }

  const isLocked = () => deadline ? new Date() >= deadline : false;
  const cd = timeLeft
    ? timeLeft.total < 3600000 ? 'error' : timeLeft.total < 86400000 ? 'warn' : 'neutral'
    : null;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <p className="eyebrow mb-1">Saturday slate · pick one game</p>
        <h2 className="dateline text-[2.4rem]">Week {week}</h2>
      </div>

      {/* Countdown to first kickoff */}
      {timeLeft && (
        <div
          className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 ${
            cd === 'error' ? 'border-bust/40 bg-bust/10'
            : cd === 'warn' ? 'border-favor/40 bg-favor/10'
            : 'border-line bg-navy-raised'
          }`}
        >
          <span className={`eyebrow ${cd === 'error' ? '!text-bust' : cd === 'warn' ? '!text-favor' : ''}`}>
            {myPick ? 'Your pick locks in' : 'Pick deadline'}
          </span>
          <span className={`font-mono font-semibold tabular-nums text-sm ${
            cd === 'error' ? 'text-bust' : cd === 'warn' ? 'text-favor' : 'text-chalk'
          }`}>
            {timeLeft.d > 0 && `${timeLeft.d}d `}
            {(timeLeft.d > 0 || timeLeft.h > 0) && `${String(timeLeft.h).padStart(2, '0')}h `}
            {`${String(timeLeft.m).padStart(2, '0')}m`}
            {timeLeft.total < 3600000 && ` ${String(timeLeft.s).padStart(2, '0')}s`}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-chalk-faint pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search teams…"
          className="field !py-2.5 pl-9 pr-9 text-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-chalk-faint hover:text-chalk"
          >
            ✕
          </button>
        )}
      </div>

      {/* Conference filter */}
      {conferences.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4">
          {conferences.map(conf => (
            <button
              key={conf}
              onClick={() => setActiveConf(conf)}
              className={`pill ${activeConf === conf ? 'is-on' : ''}`}
            >
              {conf}
            </button>
          ))}
        </div>
      )}

      {consensusReached && !myPick && (
        <p className="banner banner-warn">
          The group locked in Penn State, so your pick was cleared. Choose a new game.
        </p>
      )}
      {error && <p className="banner banner-error">{error}</p>}
      {success && <p className="banner banner-info">{success}</p>}

      {/* Your pick — the helmet stripe */}
      {myPick && (
        <div className="bg-stripe text-ink rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow !text-ink-dim">Your pick</span>
            {!isLocked() && (
              <button
                onClick={handleClearPick}
                disabled={submitting}
                className="text-xs font-semibold text-bust-ink underline disabled:opacity-50"
              >
                Clear
              </button>
            )}
          </div>

          <p className="font-semibold text-lg mt-1 flex items-baseline gap-2">
            {myPick.picked_team === 'over' || myPick.picked_team === 'under' ? (
              <>
                {myPick.picked_team === 'over' ? 'Over' : 'Under'}
                <span className="font-mono text-cash-ink">{myPick.spread_at_pick}</span>
              </>
            ) : (
              <>
                {myPick.picked_team === 'home' ? myPick.home_team : myPick.away_team}
                <span className="font-mono text-cash-ink">{formatSpread(myPick.spread_at_pick)}</span>
              </>
            )}
          </p>
          <p className="text-xs text-ink-dim mt-0.5">
            {myPick.picked_team === 'over' || myPick.picked_team === 'under'
              ? `${myPick.home_team} vs ${myPick.away_team}`
              : `vs ${myPick.picked_team === 'home' ? myPick.away_team : myPick.home_team}`}
          </p>

          {!isLocked() ? (
            <div className="mt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value.slice(0, 100))}
                  onBlur={handleSaveNote}
                  placeholder="Add a trash-talk line (optional)"
                  className="flex-1 rounded-md border border-ink/15 bg-paper-shade/40 px-3 py-1.5 text-xs text-ink placeholder-ink-dim focus:outline-none focus:border-cash-ink"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={noteSaving || note === (myPick.note || '')}
                  className="text-xs font-semibold text-cash-ink disabled:opacity-40 px-1"
                >
                  {noteSaving ? '…' : 'Save'}
                </button>
              </div>
              <p className="text-right text-[0.65rem] text-ink-dim mt-0.5">{note.length}/100</p>
            </div>
          ) : myPick.note ? (
            <p className="text-xs text-ink-dim italic mt-2">"{myPick.note}"</p>
          ) : null}

          <p className="text-[0.65rem] text-ink-dim mt-2">Locks at kickoff — change it any time before then.</p>
        </div>
      )}

      {filteredGames.length === 0 && (
        <p className="text-center text-chalk-faint py-8 text-sm">Nothing matches "{search}"</p>
      )}

      {/* The line sheet */}
      <div className="flex flex-col">
        {filteredGames.map(game => {
          const locked = isLocked(game);
          const isMyGame = myPick?.game_id === game.id;
          const takenBy = !isMyGame ? claimedGames[game.id] : null;
          const unavailable = locked || !!takenBy;
          const homeFav = parseFloat(game.home_spread) < 0;
          const awayFav = parseFloat(game.home_spread) > 0;

          const Side = ({ team, tag, side, spread, favored, rank }) => {
            const mine = isMyGame && myPick.picked_team === side;
            return (
              <button
                disabled={unavailable || submitting}
                onClick={() => handlePick(game.id, side)}
                className={`lineside ${mine ? 'is-mine' : ''} ${takenBy ? 'is-taken' : ''}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {mine && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cash-ink flex-shrink-0" />
                  )}
                  {rank && (
                    <span className={`font-mono text-[0.62rem] font-semibold flex-shrink-0 ${mine ? 'text-ink-dim' : 'text-chalk-faint'}`}>
                      #{rank}
                    </span>
                  )}
                  <span className="font-medium truncate">{team}</span>
                  {tag && <span className="eyebrow !text-[0.55rem] flex-shrink-0">{tag}</span>}
                </span>
                <span className={`spread ${favored ? 'fav' : ''}`}>{spread}</span>
              </button>
            );
          };

          return (
            <div key={game.id} className="linegame">
              <div className="flex items-center justify-between text-[0.62rem] font-mono text-chalk-faint mb-1">
                <span>{formatTime(game.commence_time)}</span>
                <span>
                  {takenBy
                    ? `${takenBy}'s pick`
                    : game.status === 'complete'
                      ? `Final · ${game.home_abbr} ${game.home_score}–${game.away_score} ${game.away_abbr}`
                      : game.status === 'in_progress'
                        ? 'Live'
                        : locked ? 'Locked' : ''}
                </span>
              </div>

              <Side
                team={game.away_team}
                tag="Away"
                side="away"
                spread={formatSpread(-parseFloat(game.home_spread))}
                favored={awayFav}
                rank={game.away_rank}
              />
              <Side
                team={game.home_team}
                tag="Home"
                side="home"
                spread={formatSpread(game.home_spread)}
                favored={homeFav}
                rank={game.home_rank}
              />

              {game.total != null && (
                <div className="flex gap-2 mt-1">
                  <div className="flex-1">
                    <Side team="Over" side="over" spread={String(game.total)} />
                  </div>
                  <div className="flex-1">
                    <Side team="Under" side="under" spread={String(game.total)} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
