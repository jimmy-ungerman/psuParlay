import cron from 'node-cron';
import pool from '../db/index.js';
import { fetchLiveScores } from '../services/espn.js';
import { calculateResult } from '../services/results.js';
import { fetchOddsApiGames, fluctuateSpread, isMockMode, teamsMatch } from '../services/odds.js';
import { sendPushToUser, sendPushToAll } from '../services/push.js';

// Every 15 min: update scores and resolve picks
// Every 6 hours: refresh spreads from The Odds API (or simulate movement in mock mode)
export function startScoreUpdater() {
  cron.schedule('*/15 * * * *', async () => {
    try { await updateScores(); } catch (err) { console.error('Score update error:', err.message); }
  });

  cron.schedule('0 */6 * * *', async () => {
    try {
      if (isMockMode()) {
        await simulateLineMovement();
      } else {
        await refreshRealSpreads();
      }
    } catch (err) { console.error('Spread update error:', err.message); }
  });

  console.log('Score updater scheduled (scores: every 15 min, spreads: every 6 hours)');
}

async function updateScores() {
  const { rows: games } = await pool.query(
    `SELECT * FROM games WHERE status != 'complete' AND espn_id IS NOT NULL`
  );
  if (games.length === 0) return;

  const liveData = await fetchLiveScores(games.map(g => g.espn_id));

  for (const live of liveData) {
    const game = games.find(g => g.espn_id === live.espnId);
    if (!game) continue;

    await pool.query(
      `UPDATE games SET status = $1, home_score = $2, away_score = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
      [live.status, live.homeScore, live.awayScore, game.id]
    );

    const wasScheduled = game.status === 'scheduled';
    const updatedGame = { ...game, status: live.status, home_score: live.homeScore, away_score: live.awayScore };

    if (live.status === 'in_progress' && wasScheduled) {
      // Notify pick owners that their game just went live
      const { rows: picks } = await pool.query(
        'SELECT p.user_id, p.picked_team FROM picks p WHERE p.game_id = $1',
        [game.id]
      );
      for (const pick of picks) {
        const team = pick.picked_team === 'home' ? game.home_team : game.away_team;
        sendPushToUser(pick.user_id, {
          title: '🔴 Your game is live!',
          body: `${game.home_team} vs ${game.away_team} — you picked ${team}`,
        }).catch(() => {});
      }
    }

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

  // Check if all picks for this week/season are now settled — notify everyone
  if (picks.length > 0) {
    const { week_number, season } = game;
    const { rows: remaining } = await pool.query(
      `SELECT COUNT(*) as cnt FROM picks WHERE week_number = $1 AND season = $2 AND result = 'pending'`,
      [week_number, season]
    );
    if (parseInt(remaining[0].cnt) === 0) {
      const { rows: weekPicks } = await pool.query(
        `SELECT result FROM picks WHERE week_number = $1 AND season = $2`,
        [week_number, season]
      );
      const wins = weekPicks.filter(p => p.result === 'win').length;
      const total = weekPicks.length;
      const parlayWon = weekPicks.every(p => p.result === 'win');
      const parlayLost = weekPicks.some(p => p.result === 'loss');
      const outcome = parlayWon ? '🎉 Parlay Hit!' : parlayLost ? '💀 Parlay Busted' : '😬 Parlay Pushes';
      sendPushToAll({
        title: `Week ${week_number} Results Are In`,
        body: `${outcome} — ${wins}/${total} covered`,
      }).catch(() => {});
    }
  }
}

async function refreshRealSpreads() {
  const { rows: games } = await pool.query(
    `SELECT * FROM games WHERE status = 'scheduled'`
  );
  if (games.length === 0) return;

  const oddsGames = await fetchOddsApiGames();

  for (const game of games) {
    const match = oddsGames.find(
      o => teamsMatch(o.homeTeam, game.home_team) && teamsMatch(o.awayTeam, game.away_team)
    );
    if (!match) continue;

    const newSpread = match.homeSpread;
    if (parseFloat(newSpread) === parseFloat(game.home_spread)) continue;

    await pool.query(`UPDATE games SET home_spread = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newSpread, game.id]);
    await pool.query(`INSERT INTO odds_snapshots (game_id, home_spread) VALUES ($1, $2)`, [game.id, newSpread]);
    console.log(`Spread updated: ${game.home_team} vs ${game.away_team}: ${game.home_spread} → ${newSpread}`);
  }
}

// Mock mode only: simulate small spread movements for demo
async function simulateLineMovement() {
  const { rows: games } = await pool.query(
    `SELECT * FROM games WHERE status = 'scheduled' AND home_spread IS NOT NULL`
  );
  for (const game of games) {
    if (Math.random() > 0.2) continue;
    const newSpread = fluctuateSpread(parseFloat(game.home_spread));
    await pool.query(`UPDATE games SET home_spread = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [newSpread, game.id]);
    await pool.query(`INSERT INTO odds_snapshots (game_id, home_spread) VALUES ($1, $2)`, [game.id, newSpread]);
  }
}
