import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const CURRENT_SEASON = new Date().getFullYear();

// GET /api/leaderboard?season=  (season can be a year or 'all')
router.get('/', requireAuth, async (req, res) => {
  try {
    const seasonParam = req.query.season || CURRENT_SEASON;
    const isAllTime = seasonParam === 'all';

    let leaderboard;

    if (isAllTime) {
      // Aggregate live picks + historical picks across all time
      const { rows: liveRows } = await pool.query(
        `SELECT u.username as display_name,
                COUNT(p.id) FILTER (WHERE p.result = 'win')  as wins,
                COUNT(p.id) FILTER (WHERE p.result = 'loss') as losses,
                COUNT(p.id) FILTER (WHERE p.result = 'push') as pushes,
                SUM(CASE WHEN p.result = 'win' THEN 1 WHEN p.result = 'loss' THEN 1 ELSE 0 END) as total_picks
         FROM users u
         LEFT JOIN picks p ON p.user_id = u.id AND p.result != 'pending'
         GROUP BY u.username`,
        []
      );
      const { rows: histRows } = await pool.query(
        `SELECT display_name,
                COUNT(*) FILTER (WHERE result = 'win')  as wins,
                COUNT(*) FILTER (WHERE result = 'loss') as losses,
                0 as pushes,
                COUNT(*) as total_picks,
                SUM(spread_value) as spread_total
         FROM historical_picks
         GROUP BY display_name`,
        []
      );

      // Merge by display_name
      const map = {};
      for (const r of liveRows) {
        map[r.display_name] = {
          display_name: r.display_name,
          wins: parseInt(r.wins) || 0,
          losses: parseInt(r.losses) || 0,
          pushes: parseInt(r.pushes) || 0,
          spread_total: 0,
        };
      }
      for (const r of histRows) {
        if (map[r.display_name]) {
          map[r.display_name].wins += parseInt(r.wins) || 0;
          map[r.display_name].losses += parseInt(r.losses) || 0;
          map[r.display_name].spread_total += parseFloat(r.spread_total) || 0;
        } else {
          map[r.display_name] = {
            display_name: r.display_name,
            wins: parseInt(r.wins) || 0,
            losses: parseInt(r.losses) || 0,
            pushes: 0,
            spread_total: parseFloat(r.spread_total) || 0,
          };
        }
      }
      leaderboard = Object.values(map)
        .filter(e => e.wins + e.losses + e.pushes > 0)
        .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
        .map(e => ({ ...e, streak: null, pending: 0 }));

    } else if (parseInt(seasonParam) < CURRENT_SEASON) {
      // Historical season
      const { rows } = await pool.query(
        `SELECT display_name,
                COUNT(*) FILTER (WHERE result = 'win')  as wins,
                COUNT(*) FILTER (WHERE result = 'loss') as losses,
                0 as pushes,
                0 as pending,
                SUM(spread_value) as spread_total
         FROM historical_picks
         WHERE season = $1
         GROUP BY display_name
         ORDER BY wins DESC, losses ASC`,
        [parseInt(seasonParam)]
      );
      leaderboard = rows.map(r => ({
        ...r,
        wins: parseInt(r.wins) || 0,
        losses: parseInt(r.losses) || 0,
        pushes: 0,
        pending: 0,
        spread_total: parseFloat(r.spread_total) || 0,
        streak: null,
      }));

    } else {
      // Current live season
      const season = parseInt(seasonParam);
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

      leaderboard = rows.map(row => ({
        ...row,
        wins: parseInt(row.wins) || 0,
        losses: parseInt(row.losses) || 0,
        pushes: parseInt(row.pushes) || 0,
        pending: parseInt(row.pending) || 0,
        spread_total: null,
        streak: computeStreak(picksByUser[row.id] || []),
      }));
    }

    res.json({ leaderboard, season: seasonParam });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function computeStreak(results) {
  if (results.length === 0) return null;
  const type = results[0];
  let count = 0;
  for (const r of results) {
    if (r === type) count++;
    else break;
  }
  if (count < 2) return null;
  return { type, count };
}

// GET /api/leaderboard/history?season=
router.get('/history', requireAuth, async (req, res) => {
  try {
    const seasonParam = req.query.season || CURRENT_SEASON;
    const season = parseInt(seasonParam);

    if (season < CURRENT_SEASON) {
      // Historical: return simplified weeks from historical_picks
      const { rows: weekRows } = await pool.query(
        'SELECT DISTINCT week_number FROM historical_picks WHERE season = $1 ORDER BY week_number DESC',
        [season]
      );

      const history = await Promise.all(weekRows.map(async ({ week_number }) => {
        const { rows: picks } = await pool.query(
          `SELECT hp.display_name, hp.result, hp.spread_value, hp.picked_team,
                  g.home_team, g.away_team, g.home_abbr, g.away_abbr,
                  g.home_score, g.away_score, g.home_spread
           FROM historical_picks hp
           LEFT JOIN games g ON hp.game_id = g.id
           WHERE hp.season = $1 AND hp.week_number = $2
           ORDER BY hp.display_name`,
          [season, week_number]
        );

        const wins = picks.filter(p => p.result === 'win').length;
        const losses = picks.filter(p => p.result === 'loss').length;
        const parlayResult = losses > 0 ? 'loss' : wins === picks.length ? 'win' : 'push';

        return { week_number, season, picks, parlay_result: parlayResult, is_historical: true };
      }));

      return res.json({ history });
    }

    // Current season
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

      return { week_number, season, picks, parlay_result: parlayResult, is_historical: false };
    }));

    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leaderboard/seasons — available season years
router.get('/seasons', requireAuth, async (req, res) => {
  try {
    const { rows: liveSeasons } = await pool.query(
      'SELECT DISTINCT season FROM picks ORDER BY season DESC', []
    );
    const { rows: histSeasons } = await pool.query(
      'SELECT DISTINCT season FROM historical_picks ORDER BY season DESC', []
    );
    const all = new Set([
      ...liveSeasons.map(r => r.season),
      ...histSeasons.map(r => r.season),
    ]);
    const seasons = [...all].sort((a, b) => b - a);
    res.json({ seasons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
