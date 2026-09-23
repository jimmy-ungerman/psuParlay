import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getPickDeadline, currentLine } from '../services/results.js';
import { ensureGamesSeededCached } from '../services/schedule.js';
const router = Router();

// GET /api/picks?week=&season=
router.get('/', requireAuth, async (req, res) => {
  try {
    let { week, season } = req.query;

    if (!week || !season) {
      // Same "active week" the games route serves, so the slip rolls over to the
      // new week on Monday morning even if the Pick tab hasn't been opened yet.
      try {
        ({ week, season } = await ensureGamesSeededCached());
      } catch {
        const { rows } = await pool.query(
          'SELECT week_number, season FROM games ORDER BY season DESC, week_number DESC LIMIT 1'
        );
        if (rows.length === 0) return res.json({ picks: [], week: null, season: null });
        week = rows[0].week_number;
        season = rows[0].season;
      }
    }

    const { rows: picks } = await pool.query(
      `SELECT
         p.*,
         u.username as display_name,
         g.home_team, g.away_team, g.home_abbr, g.away_abbr,
         g.commence_time, g.status as game_status,
         g.home_score, g.away_score,
         g.home_spread, g.total
       FROM picks p
       JOIN users u ON p.user_id = u.id
       JOIN games g ON p.game_id = g.id
       WHERE p.week_number = $1 AND p.season = $2
       ORDER BY p.created_at`,
      [week, season]
    );

    // Same line calculateResult grades against: fluid until the pick deadline,
    // frozen after (scoreUpdater stops refreshing games.home_spread/total once
    // pickStillOpen goes false). Computed here so the slip/history views don't
    // duplicate the spread-vs-total perspective logic.
    // e.g. pick Ole Miss +2.5 Wed, line moves to +3.5 Thu -> slip shows +3.5;
    // Saturday's final pre-lock refresh sets it for good, and that's what grades it.
    for (const pick of picks) {
      pick.current_line = currentLine(pick, pick);
    }

    res.json({ picks, week: parseInt(week), season: parseInt(season) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/picks
router.post('/', requireAuth, async (req, res) => {
  const { gameId, pickedTeam, note } = req.body;
  if (!gameId || !['home', 'away', 'over', 'under'].includes(pickedTeam)) {
    return res.status(400).json({ error: 'gameId and pickedTeam (home|away|over|under) required' });
  }
  if (note && note.length > 100) {
    return res.status(400).json({ error: 'Note must be 100 characters or less' });
  }

  try {
    const { rows: gameRows } = await pool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameRows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = gameRows[0];

    if (new Date() >= getPickDeadline(game.commence_time)) {
      return res.status(400).json({ error: 'Pick deadline has passed — picks lock at 11:30 AM ET Saturday' });
    }

    // Check day in ET (UTC-4 during football season) — late western-timezone games
    // (e.g. 7:30 PM MST) are stored as UTC Sunday but are still Saturday games.
    const etDay = new Date(new Date(game.commence_time).getTime() - 4 * 60 * 60 * 1000).getUTCDay();
    if (etDay !== 6) {
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

    const { rows: pick } = await pool.query(
      `INSERT INTO picks (user_id, game_id, week_number, season, picked_team, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, week_number, season)
       DO UPDATE SET game_id = $2, picked_team = $5, note = $6, result = 'pending', created_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.userId, gameId, game.week_number, game.season, pickedTeam, note?.trim() || null]
    );

    res.status(201).json({ pick: pick[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/picks/note — update trash talk note on current pick (before deadline only)
router.patch('/note', requireAuth, async (req, res) => {
  const { note } = req.body;
  if (note && note.length > 100) {
    return res.status(400).json({ error: 'Note must be 100 characters or less' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT p.id, g.commence_time FROM picks p
       JOIN games g ON g.id = p.game_id
       WHERE p.user_id = $1 AND p.result = 'pending'
       ORDER BY p.created_at DESC LIMIT 1`,
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No active pick found' });

    const pick = rows[0];
    if (new Date() >= getPickDeadline(pick.commence_time)) {
      return res.status(400).json({ error: 'Pick deadline has passed' });
    }

    await pool.query('UPDATE picks SET note = $1 WHERE id = $2', [note?.trim() || null, pick.id]);
    res.json({ message: 'Note updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/picks — clear the current user's pick for this week (before deadline only)
router.delete('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, g.commence_time FROM picks p
       JOIN games g ON g.id = p.game_id
       WHERE p.user_id = $1 AND p.result = 'pending'
       ORDER BY p.created_at DESC LIMIT 1`,
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No active pick to clear' });

    const pick = rows[0];
    if (new Date() >= getPickDeadline(pick.commence_time)) {
      return res.status(400).json({ error: 'Pick deadline has passed — picks lock at 11:30 AM ET Saturday' });
    }

    await pool.query('DELETE FROM picks WHERE id = $1', [pick.id]);
    res.json({ message: 'Pick cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
