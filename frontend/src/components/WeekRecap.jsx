// Shown when all picks for a week are settled (no pending results)
export default function WeekRecap({ picks, allTimeRecord }) {
  if (!picks || picks.length === 0) return null;
  if (picks.some(p => p.result === 'pending')) return null;

  const wins   = picks.filter(p => p.result === 'win').length;
  const losses = picks.filter(p => p.result === 'loss').length;
  const parlayWon = losses === 0 && wins === picks.length;
  const parlayLost = losses > 0;

  // MVP: pick with the most comfortable cover margin
  // coverMargin > 0 means they covered; higher = more dominant
  function coverMargin(pick) {
    if (!pick.home_score || !pick.away_score) return 0;
    const homeMargin = parseInt(pick.home_score) - parseInt(pick.away_score);
    return pick.picked_team === 'home'
      ? homeMargin + parseFloat(pick.home_spread ?? 0)
      : -(homeMargin + parseFloat(pick.home_spread ?? 0));
  }

  const settled  = picks.filter(p => p.result !== 'pending');
  const winners  = settled.filter(p => p.result === 'win').sort((a, b) => coverMargin(b) - coverMargin(a));
  const crusher  = settled.find(p => p.result === 'loss');
  const mvp      = winners[0];

  const { wins: atW, losses: atL, pushes: atP } = allTimeRecord || {};
  const atRecord = allTimeRecord ? `${atW}-${atL}${atP ? `-${atP}` : ''} all time` : null;

  return (
    <div className={`rounded-2xl border p-4 ${
      parlayWon
        ? 'bg-green-500/10 border-green-500/30'
        : parlayLost
        ? 'bg-red-500/10 border-red-500/30'
        : 'bg-yellow-500/10 border-yellow-500/30'
    }`}>
      {/* Result headline */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={`text-lg font-bold ${parlayWon ? 'text-green-400' : parlayLost ? 'text-red-400' : 'text-yellow-400'}`}>
            {parlayWon ? '🎉 Parlay Hit!' : parlayLost ? '💀 Parlay Busted' : '😬 Parlay Pushes'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{wins}/{picks.length} covered{atRecord ? ` · ${atRecord}` : ''}</p>
        </div>
        <span className={`text-3xl ${parlayWon ? '' : 'grayscale'}`}>
          {parlayWon ? '🏆' : parlayLost ? '🚮' : '🤷'}
        </span>
      </div>

      {/* MVP / Parlay Killer callouts */}
      <div className="space-y-1.5">
        {mvp && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-400 font-semibold">🐐 MVP</span>
            <span className="text-gray-300">
              {mvp.display_name} — {mvp.picked_team === 'home' ? mvp.home_team : mvp.away_team}
              {coverMargin(mvp) > 0 && (
                <span className="text-gray-500 text-xs ml-1">
                  (covered by {coverMargin(mvp).toFixed(1)})
                </span>
              )}
            </span>
          </div>
        )}
        {crusher && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-red-400 font-semibold">💀 Parlay killer</span>
            <span className="text-gray-300">
              {crusher.display_name} — {crusher.picked_team === 'home' ? crusher.home_team : crusher.away_team}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
