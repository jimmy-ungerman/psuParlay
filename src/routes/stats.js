import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/stats/parlay-record
// Returns week-by-week parlay outcomes and all-time totals
router.get('/parlay-record', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT week_number, season,
         COUNT(*) FILTER (WHERE result = 'win')  as wins,
         COUNT(*) FILTER (WHERE result = 'loss') as losses,
         COUNT(*) FILTER (WHERE result = 'push') as pushes,
         COUNT(*) FILTER (WHERE result = 'pending') as pending
       FROM picks
       GROUP BY week_number, season
       ORDER BY season DESC, week_number DESC`
    );

    let allTimeWins = 0, allTimeLosses = 0, allTimePushes = 0;

    const weeks = rows.map(row => {
      const wins = parseInt(row.wins);
      const losses = parseInt(row.losses);
      const pushes = parseInt(row.pushes);
      const pending = parseInt(row.pending);

      let result = 'pending';
      if (pending === 0) {
        if (losses > 0) result = 'loss';
        else if (pushes > 0) result = 'push';
        else result = 'win';
      }

      if (result === 'win')  allTimeWins++;
      if (result === 'loss') allTimeLosses++;
      if (result === 'push') allTimePushes++;

      return { week_number: row.week_number, season: row.season, result };
    });

    res.json({
      weeks,
      allTime: { wins: allTimeWins, losses: allTimeLosses, pushes: allTimePushes },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stats/h2h/:userId
// Returns the current user's head-to-head record vs another user
router.get('/h2h/:userId', requireAuth, async (req, res) => {
  const myId = req.user.userId;
  const theirId = parseInt(req.params.userId);
  if (myId === theirId) return res.status(400).json({ error: 'Cannot compare with yourself' });

  try {
    const { rows: theirInfo } = await pool.query(
      'SELECT username FROM users WHERE id = $1', [theirId]
    );
    if (theirInfo.length === 0) return res.status(404).json({ error: 'User not found' });

    const { rows } = await pool.query(
      `SELECT p1.week_number, p1.season, p1.result as my_result, p2.result as their_result
       FROM picks p1
       JOIN picks p2
         ON p1.week_number = p2.week_number AND p1.season = p2.season
         AND p2.user_id = $2
       WHERE p1.user_id = $1
         AND p1.result != 'pending'
         AND p2.result != 'pending'
       UNION ALL
       SELECT hp1.week_number, hp1.season, hp1.result as my_result, hp2.result as their_result
       FROM historical_picks hp1
       JOIN historical_picks hp2
         ON hp1.week_number = hp2.week_number AND hp1.season = hp2.season
         AND hp2.user_id = $2
       WHERE hp1.user_id = $1
       ORDER BY season DESC, week_number DESC`,
      [myId, theirId]
    );

    let wins = 0, losses = 0, ties = 0;
    for (const row of rows) {
      const iWon   = row.my_result === 'win';
      const theyWon = row.their_result === 'win';
      if (iWon && !theyWon) wins++;
      else if (theyWon && !iWon) losses++;
      else ties++;
    }

    res.json({
      opponent: theirInfo[0].username,
      wins, losses, ties,
      weeks: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
