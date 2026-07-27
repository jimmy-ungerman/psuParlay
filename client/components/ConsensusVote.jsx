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

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-400">{error}</div>;
  }

  const { game, psuSpread, votes, totalUsers, yesVotes, noVotes, consensusReached, myVote } = data || {};

  const gameLocked = game && game.status !== 'scheduled';
  const yesPercent = totalUsers > 0 ? (yesVotes / totalUsers) * 100 : 0;
  const threshold = 50;

  const psuIsHome = game?.home_team?.includes('Penn State');
  const opponent = game ? (psuIsHome ? game.away_team : game.home_team) : null;
  const location = game ? (psuIsHome ? 'vs' : '@') : null;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
        Consensus Pick — Week {week}
      </h2>

      {/* PSU Game Card */}
      {game ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">{formatTime(game.commence_time)}</span>
            {gameLocked && (
              <span className="text-xs font-semibold text-yellow-500 uppercase">
                {game.status === 'complete' ? 'Final' : 'In Progress'}
              </span>
            )}
          </div>
          <p className="text-white font-semibold text-lg">
            Penn State {formatSpread(psuSpread)}
          </p>
          <p className="text-gray-400 text-sm">{location} {opponent}</p>
          {game.status === 'complete' && game.home_score !== null && (
            <p className="text-gray-500 text-xs mt-1">
              Final: {game.home_team} {game.home_score}–{game.away_score} {game.away_team}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center text-gray-600">
          <p className="text-3xl mb-2">🏈</p>
          <p>No Penn State game found for Week {week}</p>
        </div>
      )}

      {/* Consensus Status */}
      {game && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">
              Consensus Status
            </span>
            {consensusReached ? (
              <span className="text-xs font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded-full">
                CONSENSUS REACHED
              </span>
            ) : (
              <span className="text-xs text-gray-500">
                Need &gt;50% ({Math.ceil(totalUsers / 2 + 0.01)} of {totalUsers})
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${consensusReached ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(yesPercent, 100)}%` }}
            />
            {/* 50% threshold marker */}
            <div className="absolute top-0 bottom-0 w-px bg-gray-500" style={{ left: '50%' }} />
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>{yesVotes} yes · {noVotes} no · {totalUsers - yesVotes - noVotes} no vote</span>
            <span>{Math.round(yesPercent)}%</span>
          </div>

          {/* Vote buttons */}
          {!gameLocked && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => handleVote('yes')}
                disabled={voting}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  myVote === 'yes'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-green-500/20 hover:text-green-400 border border-gray-700'
                }`}
              >
                {myVote === 'yes' ? '✓ YES — Add PSU' : 'YES — Add PSU'}
              </button>
              <button
                onClick={() => handleVote('no')}
                disabled={voting}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  myVote === 'no'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-red-500/20 hover:text-red-400 border border-gray-700'
                }`}
              >
                {myVote === 'no' ? '✓ NO — Skip' : 'NO — Skip'}
              </button>
            </div>
          )}
          {gameLocked && (
            <p className="text-xs text-center text-gray-600 pt-1">Voting locked — game has started</p>
          )}
          {pickCleared && (
            <p className="text-xs text-yellow-400 bg-yellow-500/10 rounded-lg px-3 py-2 text-center">
              Your weekly pick was on the PSU game and has been cleared — please choose a new game.
            </p>
          )}
          {consensusDropped && (
            <p className="text-xs text-blue-400 bg-blue-500/10 rounded-lg px-3 py-2 text-center">
              Consensus dropped below 50% — PSU pick is available again.
            </p>
          )}
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        </div>
      )}

      {/* Vote list */}
      {game && votes?.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Votes</span>
          </div>
          <div className="divide-y divide-gray-800">
            {votes.map(v => (
              <div key={v.user_id} className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-white">{v.username}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  v.vote === 'yes'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {v.vote === 'yes' ? 'YES' : 'NO'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
