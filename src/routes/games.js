import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { ensureGamesSeededCached } from '../services/schedule.js';

const router = Router();

// GET /api/games — returns the active week's games, seeding if needed
router.get('/', requireAuth, async (req, res) => {
  try {
    const { season, week } = await ensureGamesSeededCached();
    const { rows: games } = await pool.query(
      `SELECT g.* FROM games g
       WHERE g.week_number = $1 AND g.season = $2
       ORDER BY g.commence_time`,
      [week, season]
    );
    res.json({ games, week, season });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load games' });
  }
});

export default router;
