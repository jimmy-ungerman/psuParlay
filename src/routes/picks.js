import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { spreadForTeam, getPickDeadline } from '../services/results.js';
const router = Router();

// GET /api/picks?week=&season=
router.get('/', requireAuth, async (req, res) => {
  try {
    let { week, season } = req.query;

    if (!week || !season) {
      const { rows } = await pool.query(
        'SELECT week_number, season FROM games ORDER BY season DESC, week_number DESC LIMIT 1'
      );
      if (rows.length === 0) return res.json({ picks: [], week: null, season: null });
      week = rows[0].week_number;
      season = rows[0].season;
    }

    const { rows: picks } = await pool.query(
      `SELECT
         p.*,
         u.username as display_name,
         g.home_team, g.away_team, g.home_abbr, g.away_abbr,
         g.home_spread as current_home_spread,
         g.total as current_total,
         g.commence_time, g.status as game_status,
         g.home_score, g.away_score,
         (SELECT home_spread FROM odds_snapshots WHERE game_id = g.id ORDER BY recorded_at ASC LIMIT 1) as opening_spread
       FROM picks p
       JOIN users u ON p.user_id = u.id
       JOIN games g ON p.game_id = g.id
       WHERE p.week_number = $1 AND p.season = $2
       ORDER BY p.created_at`,
      [week, season]
    );

    const annotated = picks.map(p => {
      const isTotalPick = p.picked_team === 'over' || p.picked_team === 'under';
      const currentPickedSpread = isTotalPick
        ? parseFloat(p.current_total)
        : spreadForTeam(p.picked_team, parseFloat(p.current_home_spread));
      const movement = !isNaN(currentPickedSpread)
        ? parseFloat((currentPickedSpread - parseFloat(p.spread_at_pick)).toFixed(1))
        : 0;
      return { ...p, current_picked_spread: currentPickedSpread, line_movement: movement };
    });

    res.json({ picks: annotated, week: parseInt(week), season: parseInt(season) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/picks
router.post('/', requireAuth, async (req, res) => {
  const { gameId, pickedTeam } = req.body;
  if (!gameId || !['home', 'away', 'over', 'under'].includes(pickedTeam)) {
    return res.status(400).json({ error: 'gameId and pickedTeam (home|away|over|under) required' });
  }

  try {
    const { rows: gameRows } = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameRows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = gameRows[0];

    if (new Date() >= getPickDeadline(game.commence_time)) {
      return res.status(400).json({ error: 'Pick deadline has passed — picks lock at 11:30 AM ET Saturday' });
    }

    if (new Date(game.commence_time).getDay() !== 6) {
      return res.status(400).json({ error: 'Only Saturday games are eligible for picks' });
    }

    // Check if another user already claimed this game this week
    const { rows: claimed } = await pool.query(
      `SELECT u.username FROM picks p
       JOIN users u ON p.user_id = u.id
       WHERE p.game_id = $1 AND p.week_number = $2 AND p.season = $3 AND p.user_id != $4`,
      [gameId, game.week_number, game.season, req.user.userId]
    );
    if (claimed.length > 0) {
      return res.status(409).json({ error: `${claimed[0].username} already has this game` });
    }

    if ((pickedTeam === 'over' || pickedTeam === 'under') && !game.total) {
      return res.status(400).json({ error: 'No total available for this game' });
    }

    const spreadAtPick = (pickedTeam === 'over' || pickedTeam === 'under')
      ? parseFloat(game.total)
      : spreadForTeam(pickedTeam, parseFloat(game.home_spread));

    const { rows: pick } = await pool.query(
      `INSERT INTO picks (user_id, game_id, week_number, season, picked_team, spread_at_pick)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, week_number, season)
       DO UPDATE SET game_id = $2, picked_team = $5, spread_at_pick = $6, result = 'pending', created_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.userId, gameId, game.week_number, game.season, pickedTeam, spreadAtPick]
    );

    res.status(201).json({ pick: pick[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
