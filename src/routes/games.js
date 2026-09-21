import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { ensureGamesSeededCached } from '../services/schedule.js';
import { refreshRealSpreads } from '../jobs/scoreUpdater.js';
import { isMockMode, getOddsQuota } from '../services/odds.js';

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

// POST /api/games/refresh-odds — admin-only manual trigger to pull fresh spreads
// from the Odds API right now, instead of waiting for the next cron tick.
router.post('/refresh-odds', requireAdmin, async (req, res) => {
  if (isMockMode()) {
    return res.status(400).json({ error: 'ODDS_API_KEY is not set — running in mock mode' });
  }
  try {
    const result = await refreshRealSpreads();
    res.json(result);
  } catch (err) {
    console.error('Manual odds refresh failed:', err.message);
    res.status(502).json({ error: 'Odds API request failed', detail: err.message });
  }
});

// GET /api/games/odds-quota — admin-only, most recent Odds API quota headers
// seen by this process. Null until a real API call has happened (mock mode,
// or a fresh process that hasn't hit the cron/manual refresh yet).
router.get('/odds-quota', requireAdmin, (req, res) => {
  res.json({ mockMode: isMockMode(), quota: getOddsQuota() });
});

export default router;
