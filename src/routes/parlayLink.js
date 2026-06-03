import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/parlay-link?week=&season=
router.get('/', requireAuth, async (req, res) => {
  try {
    let { week, season } = req.query;
    if (!week || !season) {
      const { rows } = await pool.query(
        'SELECT week_number, season FROM games ORDER BY season DESC, week_number DESC LIMIT 1'
      );
      if (rows.length === 0) return res.json({ draftkings_url: null, fanduel_url: null });
      week = rows[0].week_number;
      season = rows[0].season;
    }
    const { rows } = await pool.query(
      'SELECT draftkings_url, fanduel_url FROM parlay_links WHERE week_number = $1 AND season = $2',
      [week, season]
    );
    res.json({
      draftkings_url: rows[0]?.draftkings_url || null,
      fanduel_url: rows[0]?.fanduel_url || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/parlay-link
router.put('/', requireAuth, async (req, res) => {
  if (!req.user.isAdmin && !req.user.isLinkAdmin) return res.status(403).json({ error: 'Not authorized' });

  const { week, season, draftkings_url, fanduel_url } = req.body;
  if (!week || !season) return res.status(400).json({ error: 'week and season required' });

  try {
    await pool.query(
      `INSERT INTO parlay_links (week_number, season, draftkings_url, fanduel_url, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (week_number, season)
       DO UPDATE SET draftkings_url = $3, fanduel_url = $4, updated_at = CURRENT_TIMESTAMP`,
      [week, season, draftkings_url || null, fanduel_url || null]
    );
    res.json({ draftkings_url: draftkings_url || null, fanduel_url: fanduel_url || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
