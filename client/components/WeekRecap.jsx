// Shown when all picks for a week are settled (no pending results)
export default function WeekRecap({ picks, allTimeRecord }) {
  if (!picks || picks.length === 0) return null;
  if (picks.some(p => p.result === 'pending')) return null;

  const wins   = picks.filter(p => p.result === 'win').length;
  const losses = picks.filter(p => p.result === 'loss').length;
  const parlayWon = losses === 0 && wins === picks.length;
  const parlayLost = losses > 0;

  // MVP: pick with the most comfortable cover margin, graded off the locked line
  function coverMargin(pick) {
    if (pick.home_score == null || pick.away_score == null) return 0;
    if (pick.picked_team === 'over' || pick.picked_team === 'under') return 0;
    const line = parseFloat(pick.spread_at_pick ?? 0);
    const pickedMargin = pick.picked_team === 'home'
      ? parseInt(pick.home_score) - parseInt(pick.away_score)
      : parseInt(pick.away_score) - parseInt(pick.home_score);
    return pickedMargin + line;
  }

  const settled  = picks.filter(p => p.result !== 'pending');
  const winners  = settled.filter(p => p.result === 'win').sort((a, b) => coverMargin(b) - coverMargin(a));
  const crusher  = settled.find(p => p.result === 'loss');
  const mvp      = winners[0];

  const { wins: atW, losses: atL, pushes: atP } = allTimeRecord || {};
  const atRecord = allTimeRecord ? `${atW}–${atL}${atP ? `–${atP}` : ''} all time` : null;

  const tone = parlayWon ? 'banner-info' : parlayLost ? 'banner-error' : 'banner-warn';
  const headline = parlayWon ? 'Parlay cashed' : parlayLost ? 'Parlay busted' : 'Parlay pushed';

  return (
    <div className={`banner ${tone} !p-4`}>
      <div className="flex items-baseline justify-between">
        <p className="font-display font-extrabold text-lg">{headline}</p>
        <p className="font-mono text-[0.66rem] tracking-wide opacity-80">
          {wins}/{picks.length} covered{atRecord ? ` · ${atRecord}` : ''}
        </p>
      </div>

      <div className="flex flex-col gap-1 mt-2 text-sm text-chalk">
        {mvp && (
          <div className="flex items-center gap-2">
            <span className="eyebrow !text-cash">MVP</span>
            <span>
              {mvp.display_name} — {mvp.picked_team === 'home' ? mvp.home_team : mvp.away_team}
              {coverMargin(mvp) > 0 && (
                <span className="text-chalk-faint text-xs ml-1">covered by {coverMargin(mvp).toFixed(1)}</span>
              )}
            </span>
          </div>
        )}
        {crusher && (
          <div className="flex items-center gap-2">
            <span className="eyebrow !text-bust">Killed it</span>
            <span>
              {crusher.display_name} — {crusher.picked_team === 'home' ? crusher.home_team : crusher.away_team}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
