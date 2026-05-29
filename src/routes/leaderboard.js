import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/leaderboard?season=
router.get('/', requireAuth, async (req, res) => {
  try {
    const season = req.query.season || new Date().getFullYear();
    const { rows } = await pool.query(
      `SELECT
         u.id, u.username as display_name,
         COUNT(p.id) FILTER (WHERE p.result = 'win')    as wins,
         COUNT(p.id) FILTER (WHERE p.result = 'loss')   as losses,
         COUNT(p.id) FILTER (WHERE p.result = 'push')   as pushes,
         COUNT(p.id) FILTER (WHERE p.result = 'pending') as pending,
         COUNT(p.id) as total_picks
       FROM users u
       LEFT JOIN picks p ON p.user_id = u.id AND p.season = $1
       GROUP BY u.id, u.username
       ORDER BY wins DESC, losses ASC, pushes DESC`,
      [season]
    );

    // Compute current streak for each user (across all seasons)
    const { rows: allPicks } = await pool.query(
      `SELECT user_id, result FROM picks
       WHERE result != 'pending'
       ORDER BY user_id, season DESC, week_number DESC`
    );

    const picksByUser = {};
    for (const p of allPicks) {
      if (!picksByUser[p.user_id]) picksByUser[p.user_id] = [];
      picksByUser[p.user_id].push(p.result);
    }

    const leaderboard = rows.map(row => {
      const streak = computeStreak(picksByUser[row.id] || []);
      return { ...row, streak };
    });

    res.json({ leaderboard, season: parseInt(season) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function computeStreak(results) {
  // results: ordered most-recent first
  if (results.length === 0) return null;
  const type = results[0];
  let count = 0;
  for (const r of results) {
    if (r === type) count++;
    else break;
  }
  if (count < 2) return null; // single-week streaks not shown
  return { type, count };
}

// GET /api/leaderboard/history?season=
router.get('/history', requireAuth, async (req, res) => {
  try {
    const season = req.query.season || new Date().getFullYear();
    const { rows: weeks } = await pool.query(
      'SELECT DISTINCT week_number, season FROM picks WHERE season = $1 ORDER BY week_number DESC',
      [season]
    );

    const history = await Promise.all(weeks.map(async ({ week_number, season }) => {
      const { rows: picks } = await pool.query(
        `SELECT p.*, u.username as display_name,
                g.home_team, g.away_team, g.home_score, g.away_score, g.home_spread
         FROM picks p
         JOIN users u ON p.user_id = u.id
         JOIN games g ON p.game_id = g.id
         WHERE p.week_number = $1 AND p.season = $2
         ORDER BY u.username`,
        [week_number, season]
      );

      const settled = picks.filter(p => p.result !== 'pending');
      const wins = picks.filter(p => p.result === 'win').length;
      const parlayResult =
        settled.length === 0 ? 'pending'
        : picks.some(p => p.result === 'loss') ? 'loss'
        : settled.length === picks.length && wins === picks.length ? 'win'
        : 'push';

      return { week_number, season, picks, parlay_result: parlayResult };
    }));

    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
