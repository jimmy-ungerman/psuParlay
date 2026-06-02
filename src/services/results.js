// Determines pick result given a pick row and a game row.
// home_spread convention: negative = home is favorite (e.g., -7 means home -7)
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

  if (pick.picked_team === 'over' || pick.picked_team === 'under') {
    const combined = homeScore + awayScore;
    const total = parseFloat(pick.spread_at_pick);
    const margin = pick.picked_team === 'over' ? combined - total : total - combined;
    if (margin > 0) return 'win';
    if (margin < 0) return 'loss';
    return 'push';
  }

  const homeMargin = homeScore - awayScore;
  const homeSpread = parseFloat(game.home_spread);

  // coverMargin > 0 = picked team covered, < 0 = failed to cover, 0 = push
  const coverMargin =
    pick.picked_team === 'home'
      ? homeMargin + homeSpread
      : -(homeMargin + homeSpread);

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
