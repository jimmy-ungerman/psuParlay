// Determines pick result given a pick row and a game row.
// Everything is graded against `spread_at_pick` — the line the pick locked in —
// not the game's current line, which keeps moving until kickoff.
// spread_at_pick convention: stored from the picked side's perspective, so a
// home pick of -7 stores -7 and the matching away pick stores +7.
export function calculateResult(pick, game) {
  if (
    game.status !== 'complete' ||
    game.home_score === null ||
    game.away_score === null
  ) {
    return 'pending';
  }

  const homeScore = parseInt(game.home_score);
  const awayScore = parseInt(game.away_score);
  const line = parseFloat(pick.spread_at_pick);

  if (pick.picked_team === 'over' || pick.picked_team === 'under') {
    const combined = homeScore + awayScore;
    const margin = pick.picked_team === 'over' ? combined - line : line - combined;
    if (margin > 0) return 'win';
    if (margin < 0) return 'loss';
    return 'push';
  }

  // Margin from the picked team's perspective, plus its spread.
  // > 0 = covered, < 0 = failed to cover, 0 = push
  const pickedMargin = pick.picked_team === 'home'
    ? homeScore - awayScore
    : awayScore - homeScore;
  const coverMargin = pickedMargin + line;

  if (coverMargin > 0) return 'win';
  if (coverMargin < 0) return 'loss';
  return 'push';
}

// Line from the perspective of the pick (spread for home/away, total for over/under)
export function spreadForTeam(pickedTeam, homeSpread) {
  return pickedTeam === 'home' ? homeSpread : -homeSpread;
}

// Returns the pick deadline: 11:30 AM Eastern on the Saturday of the given game.
// Handles DST by probing UTC-4 (EDT) and UTC-5 (EST).
export function getPickDeadline(commenceTime) {
  const game = new Date(commenceTime);
  const dateStr = game.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [year, month, day] = dateStr.split('-').map(Number);
  for (const offset of [4, 5]) {
    const candidate = new Date(Date.UTC(year, month - 1, day, 11 + offset, 30));
    const easternHour = parseInt(
      candidate.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false })
    );
    if (easternHour === 11) return candidate;
  }
}
