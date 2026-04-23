import { useState, useEffect } from 'react';
import { api } from '../api/index.js';

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gray-900 rounded-t-2xl border-t border-gray-700 p-5 pb-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-4" />

        {loading && <p className="text-center text-gray-500 py-6">Loading...</p>}

        {!loading && !data && (
          <p className="text-center text-gray-500 py-6">No head-to-head data yet</p>
        )}

        {!loading && data && (
          <>
            <h3 className="text-lg font-bold text-white text-center mb-1">
              You vs {data.opponent}
            </h3>
            <p className="text-center text-gray-500 text-xs mb-5">
              Head-to-head — weeks where you both had picks
            </p>

            {/* Record */}
            <div className="flex justify-center gap-6 mb-5">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{data.wins}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">You up</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-500">{data.ties}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Tied</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{data.losses}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">They up</p>
              </div>
            </div>

            {/* Week-by-week */}
            {data.weeks.length > 0 && (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {data.weeks.map(w => {
                  const iWon   = w.my_result === 'win';
                  const theyWon = w.their_result === 'win';
                  const edge = iWon && !theyWon ? 'text-green-400' : theyWon && !iWon ? 'text-red-400' : 'text-gray-500';
                  return (
                    <div key={`${w.season}-${w.week_number}`} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-500">Week {w.week_number} {w.season}</span>
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        <span className={w.my_result === 'win' ? 'text-green-400' : w.my_result === 'loss' ? 'text-red-400' : 'text-yellow-400'}>
                          You {w.my_result.toUpperCase()}
                        </span>
                        <span className="text-gray-700">|</span>
                        <span className={w.their_result === 'win' ? 'text-green-400' : w.their_result === 'loss' ? 'text-red-400' : 'text-yellow-400'}>
                          {data.opponent} {w.their_result.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {data.weeks.length === 0 && (
              <p className="text-center text-gray-600 text-sm">No completed weeks against each other yet</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
