export function formatSpread(spread) {
  const n = parseFloat(spread);
  return n > 0 ? `+${n}` : `${n}`;
}

export function ResultChip({ result }) {
  const map = {
    win: 'up',
    loss: 'down',
    push: 'up',
  };
  const label = result === 'pending' ? '—' : result.toUpperCase();
  return <span className={`streak-chip ${map[result] || ''}`}>{label}</span>;
}

// One pick row: title line, matchup/line, final score, and result chip.
// `title` defaults to the picker's name (History); the per-player view passes the week instead.
export default function PickDetail({ pick, isHistorical, title = pick.display_name }) {
  let description, final = null;

  if (isHistorical) {
    const hasGame = pick.home_team != null;
    const isTeamPick = pick.canonical_team != null;

    let pickedFullTeam = null, opponent = null;
    if (isTeamPick && hasGame) {
      const canon = pick.canonical_team.toLowerCase();
      const homeMatch = pick.home_team.toLowerCase().includes(canon);
      pickedFullTeam = homeMatch ? pick.home_team : pick.away_team;
      opponent = homeMatch ? pick.away_team : pick.home_team;
    }

    const spreadMatch = pick.picked_team?.match(/([+-]?\d+\.?\d*)$/);
    const spreadText = spreadMatch ? formatSpread(parseFloat(spreadMatch[1])) : '';

    description = isTeamPick && pickedFullTeam
      ? `${pickedFullTeam} ${spreadText}${opponent ? ` vs ${opponent}` : ''}`
      : hasGame
        ? `${pick.picked_team} · ${pick.home_team} vs ${pick.away_team}`
        : pick.picked_team || '—';

    if (hasGame && pick.game_status === 'complete' && pick.home_score !== null) {
      final = `Final: ${pick.home_team} ${pick.home_score}–${pick.away_score} ${pick.away_team}`;
    }
  } else {
    const isTotalPick = pick.picked_team === 'over' || pick.picked_team === 'under';
    const pickedTeam = isTotalPick ? null : (pick.picked_team === 'home' ? pick.home_team : pick.away_team);
    const opponent = isTotalPick ? null : (pick.picked_team === 'home' ? pick.away_team : pick.home_team);
    // current_line is from the picked side's perspective
    // (and is the total for over/under picks).
    const spread = parseFloat(pick.current_line);

    description = isTotalPick
      ? `${pick.picked_team === 'over' ? 'Over' : 'Under'} ${spread} · ${pick.home_team} vs ${pick.away_team}`
      : `${pickedTeam} ${formatSpread(spread)} vs ${opponent}`;

    if (pick.game_status === 'complete' && pick.home_score !== null) {
      final = `Final: ${pick.home_team} ${pick.home_score}–${pick.away_score} ${pick.away_team}`
        + (isTotalPick ? ` (${pick.home_score + pick.away_score} pts)` : '');
    }
  }

  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-sm text-chalk">{title}</p>
        <p className="text-xs text-chalk-dim mt-0.5 font-mono">{description}</p>
        {final && <p className="text-xs text-chalk-faint mt-0.5 font-mono">{final}</p>}
      </div>
      <ResultChip result={pick.result} />
    </div>
  );
}
