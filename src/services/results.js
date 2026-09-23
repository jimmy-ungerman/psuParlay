// Determines pick result given a pick row and a game row.
// Grading uses the game's own line (game.home_spread / game.total), not the
// value frozen at pick time: the line is meant to stay fluid up to the pick
// deadline (11:30 AM ET Saturday) and only then hold steady, because
// `scoreUpdater.refreshRealSpreads` stops writing to a game once
// `pickStillOpen` goes false (see src/jobs/scoreUpdater.js). That gate — not
// a per-pick snapshot — is what keeps a live in-game line from ever reaching
// a graded pick (the PR #55 bug: an in-progress game's live odds got pulled
// into `games`, and grading naively read whatever was there).
// Signed cover margin for a pick: how many points it beat its number by.
// > 0 covered, < 0 missed, 0 push. Same basis as historical_picks.spread_value,
// so live and historical differentials add up on one scale.
// Returns null if the game isn't scored yet or has no line.
export function coverMargin(pick, game) {
  const homeScore = parseInt(game.home_score);
  const awayScore = parseInt(game.away_score);
  const line = currentLine(pick, game);
  if (Number.isNaN(homeScore) || Number.isNaN(awayScore) || line === null || Number.isNaN(line)) return null;

  if (pick.picked_team === 'over' || pick.picked_team === 'under') {
    const combined = homeScore + awayScore;
    return pick.picked_team === 'over' ? combined - line : line - combined;
  }

  // Margin from the picked team's perspective, plus its spread.
  const pickedMargin = pick.picked_team === 'home'
    ? homeScore - awayScore
    : awayScore - homeScore;
  return pickedMargin + line;
}

export function calculateResult(pick, game) {
  if (
    game.status !== 'complete' ||
    game.home_score === null ||
    game.away_score === null
  ) {
    return 'pending';
  }

  const margin = coverMargin(pick, game);
  if (margin === null) return 'pending';
  if (margin > 0) return 'win';
  if (margin < 0) return 'loss';
  return 'push';
}

// Line from the perspective of the pick (spread for home/away, total for over/under)
export function spreadForTeam(pickedTeam, homeSpread) {
  return pickedTeam === 'home' ? homeSpread : -homeSpread;
}

// The game's line from the pick's perspective (spread for home/away, total
// for over/under). Used for both grading (coverMargin) and display (slip/
// history) — there is one line, and it's fluid pre-deadline, frozen after.
export function currentLine(pick, game) {
  if (pick.picked_team === 'over' || pick.picked_team === 'under') {
    return game.total === null || game.total === undefined ? null : parseFloat(game.total);
  }
  if (game.home_spread === null || game.home_spread === undefined) return null;
  return spreadForTeam(pick.picked_team, parseFloat(game.home_spread));
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
