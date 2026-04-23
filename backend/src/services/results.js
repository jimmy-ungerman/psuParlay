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

  const homeMargin = parseInt(game.home_score) - parseInt(game.away_score);
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

// Spread from the perspective of the picked team
export function spreadForTeam(pickedTeam, homeSpread) {
  return pickedTeam === 'home' ? homeSpread : -homeSpread;
}
