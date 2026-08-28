import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/index.js';

function formatSpread(spread) {
  if (spread === null || spread === undefined) return '';
  const n = parseFloat(spread);
  return n > 0 ? `+${n}` : `${n}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function ConsensusVote() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [week, setWeek] = useState(null);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState('');
  const [pickCleared, setPickCleared] = useState(false);
  const [consensusDropped, setConsensusDropped] = useState(false);

  useEffect(() => {
    api.getGames().then(res => {
      setWeek(res.week);
      setSeason(res.season || new Date().getFullYear());
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (week == null || season == null) return;
    load();
  }, [week, season]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getConsensus(week, season);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(vote) {
    setVoting(true);
    setError('');
    try {
      const res = await api.voteConsensus(week, season, vote);
      if (res.clearedPickUserIds?.includes(user.id)) {
        setPickCleared(true);
        setConsensusDropped(false);
      }
      if (res.consensusDropped) {
        setConsensusDropped(true);
        setPickCleared(false);
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setVoting(false);
    }
  }

  if (loading) return <div className="p-6 text-center text-chalk-faint">Loading…</div>;
  if (error) return <div className="p-6 text-center text-bust">{error}</div>;

  const { game, psuSpread, votes, totalUsers, yesVotes, noVotes, consensusReached, myVote } = data || {};

  const gameLocked = game && game.status !== 'scheduled';
  const yesPercent = totalUsers > 0 ? (yesVotes / totalUsers) * 100 : 0;
  const noPercent = totalUsers > 0 ? (noVotes / totalUsers) * 100 : 0;
  const needed = totalUsers ? Math.ceil(totalUsers / 2 + 0.01) : 0;
  const toLock = Math.max(0, needed - (yesVotes || 0));
  const noVoteCount = totalUsers - (yesVotes || 0) - (noVotes || 0);

  const psuIsHome = game?.home_team?.includes('Penn State');
  const opponent = game ? (psuIsHome ? game.away_team : game.home_team) : null;
  const location = game ? (psuIsHome ? 'vs' : '@') : null;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div>
        <p className="eyebrow mb-1">The Penn State question</p>
        <h2 className="dateline text-[2.4rem]">Week {week}</h2>
      </div>

      {!game ? (
        <div className="card p-6 text-center text-chalk-dim">
          <p className="dateline text-xl mb-1">No Penn State game</p>
          <p className="text-sm">Nothing to vote on for Week {week}.</p>
        </div>
      ) : (
        <>
          {/* The question */}
          <div className="card p-4">
            <p className="font-display font-bold text-lg text-chalk mb-2 text-balance">
              Put Penn State on the slip this week?
            </p>
            <p className="font-mono font-semibold text-2xl tracking-tight">
              Penn State <span className="text-favor">{formatSpread(psuSpread)}</span>
            </p>
            <p className="font-mono text-xs text-chalk-faint mt-1">
              {location} {opponent} · {formatTime(game.commence_time)}
              {gameLocked && (game.status === 'complete' ? ' · Final' : ' · In progress')}
            </p>
            {game.status === 'complete' && game.home_score !== null && (
              <p className="text-chalk-dim text-xs mt-1">
                Final: {game.home_team} {game.home_score}–{game.away_score} {game.away_team}
              </p>
            )}
          </div>

          {/* The tally */}
          <div className="flex flex-col gap-1.5">
            <div
              className="flex h-9 rounded-md overflow-hidden border border-line"
              role="img"
              aria-label={`${yesVotes} in favor, ${noVotes} against, ${noVoteCount} not voted`}
            >
              <span
                className="flex items-center px-2.5 bg-cash text-navy font-mono text-xs font-bold tracking-wider"
                style={{ width: `${Math.max(yesPercent, 14)}%` }}
              >
                In {yesVotes}
              </span>
              <span
                className="flex items-center justify-end px-2.5 flex-1 bg-navy-raised text-chalk-dim font-mono text-xs font-bold tracking-wider"
              >
                Pass {noVotes}
              </span>
            </div>
            <div className="flex justify-between font-mono text-[0.66rem] tracking-wide text-chalk-faint">
              <span>{noVoteCount} haven't voted</span>
              {consensusReached ? (
                <span className="text-cash">Locked in</span>
              ) : toLock > 0 ? (
                <span className="text-favor">{toLock} more to lock it in</span>
              ) : (
                <span>Need {needed} of {totalUsers}</span>
              )}
            </div>
          </div>

          {/* Vote */}
          {!gameLocked ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleVote('yes')}
                disabled={voting}
                className={`btn flex-1 ${myVote === 'yes' ? 'btn-primary' : 'btn-ghost'}`}
              >
                {myVote === 'yes' ? 'Voted: put it on' : 'Put it on'}
              </button>
              <button
                onClick={() => handleVote('no')}
                disabled={voting}
                className={`btn flex-1 ${
                  myVote === 'no'
                    ? '!bg-bust !text-navy !border-bust'
                    : 'btn-ghost'
                }`}
              >
                {myVote === 'no' ? 'Voted: pass' : 'Pass'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-center text-chalk-faint">Voting locked — the game has started.</p>
          )}

          <p className="text-xs text-chalk-faint text-balance">
            If it locks, Penn State goes on as a group leg and anyone who picked the Nittany Lions
            solo gets their pick back to choose again.
          </p>

          {pickCleared && (
            <p className="banner banner-warn">
              Your pick was on the Penn State game and has been cleared. Choose a new game.
            </p>
          )}
          {consensusDropped && (
            <p className="banner banner-info">
              The vote fell back under half — the Penn State pick is open again.
            </p>
          )}

          {/* Who voted */}
          {votes?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-2 border-b border-line-soft">
                <span className="eyebrow">Votes</span>
              </div>
              <div className="divide-y divide-line-soft">
                {votes.map(v => (
                  <div key={v.user_id} className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-sm text-chalk">{v.username}</span>
                    <span className={`streak-chip ${v.vote === 'yes' ? 'up' : 'down'}`}>
                      {v.vote === 'yes' ? 'IN' : 'PASS'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
