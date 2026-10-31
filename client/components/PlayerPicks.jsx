import { useState, useEffect } from 'react';
import { api } from '../api/index.js';
import PickDetail from './PickDetail.jsx';

export default function PlayerPicks({ userId, season, isMe, onBack, onH2H }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getPlayerPicks(userId, season)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId, season]);

  const record = data?.record;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-chalk-dim hover:text-chalk">← Standings</button>
        {!isMe && (
          <button onClick={onH2H} className="text-sm text-chalk-dim hover:text-chalk">Head-to-head</button>
        )}
      </div>

      {loading ? (
        <div className="p-6 text-center text-chalk-faint">Loading picks…</div>
      ) : error ? (
        <div className="p-6 text-center text-bust">{error}</div>
      ) : (
        <>
          <div>
            <p className="eyebrow mb-1">{season} season</p>
            <h2 className="dateline text-[2rem]">{data.user.username}</h2>
            <p className="font-mono text-sm font-bold tabular-nums mt-1">
              <span className="text-cash">{record.wins}</span>
              <span className="text-chalk-faint">–</span>
              <span className="text-bust">{record.losses}</span>
              {record.pushes > 0 && (
                <><span className="text-chalk-faint">–</span><span className="text-favor">{record.pushes}</span></>
              )}
              {record.pending > 0 && (
                <span className="text-chalk-faint font-normal text-xs"> · {record.pending} live</span>
              )}
            </p>
          </div>

          {data.picks.length === 0 ? (
            <div className="py-12 text-center text-chalk-faint">No picks this season</div>
          ) : (
            <div className="card overflow-hidden divide-y divide-line-soft">
              {data.picks.map(pick => (
                <PickDetail
                  key={pick.id}
                  pick={pick}
                  isHistorical={data.is_historical}
                  title={`Week ${pick.week_number}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
