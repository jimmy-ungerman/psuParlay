import { schedule } from 'node-cron';
import pool from '../db/index.js';
import { fetchLiveScores } from '../services/espn.js';
import { calculateResult, getPickDeadline } from '../services/results.js';
import { fetchOddsApiGames, fluctuateSpread, isMockMode, teamsMatch } from '../services/odds.js';
import { ensureGamesSeeded } from '../services/schedule.js';
// Every 5 min: update scores and resolve picks (keeps the slip's live scores current)
// Every 4 hours: refresh spreads from The Odds API (or simulate movement in mock mode)
// Saturday 11:29 AM ET: final spread snapshot just before picks close
// Spreads are never refreshed once a game's pick deadline has passed, so the
// line is frozen at lock.
export function startScoreUpdater() {
  schedule('*/5 * * * *', async () => {
    try { await updateScores(); } catch (err) { console.error('Score update error:', err.message); }
  });

  schedule('0 */4 * * *', async () => {
    try {
      if (isMockMode()) {
        await simulateLineMovement();
      } else {
        await refreshRealSpreads();
      }
    } catch (err) { console.error('Spread update error:', err.message); }
  });

  // Final spread update at 11:29 AM ET every Saturday — the last refresh before
  // picks close at 11:30, so the slip shows the true closing line.
  schedule('29 11 * * 6', async () => {
    try {
      console.log('Running final Saturday spread update (11:29 AM ET)');
      if (isMockMode()) {
        await simulateLineMovement();
      } else {
        await refreshRealSpreads();
      }
    } catch (err) { console.error('Final spread update error:', err.message); }
  }, { timezone: 'America/New_York' });

  // Advance the games table to the new week just after the Monday 6 AM ET
  // rollover, and keep it topped up through the day, so the app moves on to the
  // next slate without waiting for someone to open the Pick tab.
  schedule('15 6 * * 1', () => {
    ensureGamesSeeded().catch(err => console.error('Monday week-seed error:', err.message));
  }, { timezone: 'America/New_York' });

  schedule('0 */6 * * *', () => {
    ensureGamesSeeded().catch(err => console.error('Periodic week-seed error:', err.message));
  });

  console.log('Score updater scheduled (scores: every 5 min, spreads: every 4 hours + Saturday 11:29 AM ET; week seed: Monday 6:15 AM ET + every 6h)');
}

// A spread should only move while the pick is still open. Once the deadline
// (11:30 AM ET on game day) has passed, the line the picker saw is locked in.
function pickStillOpen(game) {
  const deadline = getPickDeadline(game.commence_time);
  return deadline && Date.now() < deadline.getTime();
}

async function updateScores() {
  const { rows: games } = await pool.query(
    `SELECT * FROM games WHERE status != 'complete' AND espn_id IS NOT NULL`
  );
  if (games.length === 0) return;

  const weeks = [...new Map(
    games.map(g => [`${g.season}-${g.week_number}`, { season: g.season, week: g.week_number }])
  ).values()];
  const liveData = await fetchLiveScores(games.map(g => g.espn_id), weeks);

  for (const live of liveData) {
    const game = games.find(g => g.espn_id === live.espnId);
    if (!game) continue;

    // Guard against ESPN briefly reporting a not-yet-played game as FINAL with no
    // score (happens for postponed/cancelled games and transient feed glitches).
    // Marking it 'complete' here is a one-way door — updateScores never revisits
    // complete games — so it would stick as a phantom "0-0 Final".
    const noScore = !live.homeScore && !live.awayScore;
    if (live.status === 'complete' && noScore && new Date(game.commence_time) > new Date()) {
      continue;
    }

    await pool.query(
      `UPDATE games SET status = $1, home_score = $2, away_score = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
      [live.status, live.homeScore, live.awayScore, game.id]
    );

    const wasScheduled = game.status === 'scheduled';
    const updatedGame = { ...game, status: live.status, home_score: live.homeScore, away_score: live.awayScore };

    if (live.status === 'complete') {
      await resolvePicksForGame(updatedGame);
    }
  }
}

async function resolvePicksForGame(game) {
  const { rows: picks } = await pool.query(
    `SELECT * FROM picks WHERE game_id = $1 AND result = 'pending'`,
    [game.id]
  );
  for (const pick of picks) {
    const result = calculateResult(pick, game);
    if (result !== 'pending') {
      await pool.query(`UPDATE picks SET result = $1 WHERE id = $2`, [result, pick.id]);
    }
  }

}

async function refreshRealSpreads() {
  const { rows: allScheduled } = await pool.query(
    `SELECT * FROM games WHERE status = 'scheduled'`
  );
  const games = allScheduled.filter(pickStillOpen);
  if (games.length === 0) return; // nothing still open, don't burn an API call

  const oddsGames = await fetchOddsApiGames();

  for (const game of games) {
    const match = oddsGames.find(
      o => teamsMatch(o.homeTeam, game.home_team) && teamsMatch(o.awayTeam, game.away_team)
    );
    if (!match) continue;

    const newSpread = match.homeSpread;
    const newTotal = match.total ?? null;
    const spreadChanged = parseFloat(newSpread) !== parseFloat(game.home_spread);
    const totalChanged = newTotal !== null && parseFloat(newTotal) !== parseFloat(game.total);

    if (!spreadChanged && !totalChanged) continue;

    await pool.query(
      `UPDATE games SET home_spread = $1, total = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [newSpread, newTotal, game.id]
    );
    console.log(`Odds updated: ${game.home_team} vs ${game.away_team}: spread ${game.home_spread} → ${newSpread}, total ${game.total} → ${newTotal}`);
  }
}

// Mock mode only: simulate small spread movements for demo
async function simulateLineMovement() {
  const { rows: allScheduled } = await pool.query(
    `SELECT * FROM games WHERE status = 'scheduled' AND home_spread IS NOT NULL`
  );
  for (const game of allScheduled.filter(pickStillOpen)) {
    if (Math.random() > 0.2) continue;
    const newSpread = fluctuateSpread(parseFloat(game.home_spread));
    await pool.query(`UPDATE games SET home_spread = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newSpread, game.id]);
  }
}
