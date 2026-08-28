import { useState, useEffect } from 'react';
import { api } from '../api/index.js';

function resultColor(r) {
  return r === 'win' ? 'text-cash' : r === 'loss' ? 'text-bust' : 'text-favor';
}

export default function HeadToHead({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getH2H(userId)
      .then(res => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-sink/70 lg:items-center lg:p-6" onClick={onClose}>
      <div
        className="w-full max-w-[30rem] bg-navy-raised rounded-t-2xl border-t border-line p-5 pb-8 lg:rounded-2xl lg:border lg:max-w-md lg:pb-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4 lg:hidden" />

        {loading && <p className="text-center text-chalk-faint py-6">Loading…</p>}

        {!loading && !data && (
          <p className="text-center text-chalk-faint py-6">No head-to-head data yet</p>
        )}

        {!loading && data && (
          <>
            <h3 className="font-display font-bold text-lg text-chalk text-center mb-1">
              You vs {data.opponent}
            </h3>
            <p className="text-center text-chalk-faint text-xs mb-5">
              Weeks you both had a pick
            </p>

            <div className="flex justify-center gap-6 mb-5">
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-cash tabular-nums">{data.wins}</p>
                <p className="eyebrow">You up</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-chalk-faint tabular-nums">{data.ties}</p>
                <p className="eyebrow">Tied</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-bust tabular-nums">{data.losses}</p>
                <p className="eyebrow">They up</p>
              </div>
            </div>

            {data.weeks.length > 0 && (
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                {data.weeks.map(w => (
                  <div key={`${w.season}-${w.week_number}`} className="flex items-center justify-between bg-navy-sink rounded-lg px-3 py-2">
                    <span className="font-mono text-xs text-chalk-faint">Wk {w.week_number} · {w.season}</span>
                    <div className="flex items-center gap-3 text-xs font-semibold font-mono">
                      <span className={resultColor(w.my_result)}>You {w.my_result.toUpperCase()}</span>
                      <span className="text-line">|</span>
                      <span className={resultColor(w.their_result)}>{data.opponent} {w.their_result.toUpperCase()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.weeks.length === 0 && (
              <p className="text-center text-chalk-faint text-sm">No completed weeks against each other yet</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
