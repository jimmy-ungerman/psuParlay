import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
const VALID_EMOJIS = new Set(['🔥', '💀', '🤡', '🐐', '💸', '😬']);

// GET /api/reactions?week=&season=
// Returns all reactions for every pick in the given week
router.get('/', requireAuth, async (req, res) => {
  const { week, season } = req.query;
  if (!week || !season) return res.status(400).json({ error: 'week and season required' });

  try {
    const { rows } = await pool.query(
      `SELECT r.pick_id, r.user_id, r.emoji, u.username
       FROM reactions r
       JOIN picks p ON r.pick_id = p.id
       JOIN users u ON r.user_id = u.id
       WHERE p.week_number = $1 AND p.season = $2`,
      [week, season]
    );
    res.json({ reactions: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reactions — toggle a reaction on a pick
// If user already reacted with the same emoji: remove it
// If user reacted with a different emoji: switch it
// If no reaction yet: add it
router.post('/', requireAuth, async (req, res) => {
  const { pickId, emoji } = req.body;
  if (!pickId || !emoji) return res.status(400).json({ error: 'pickId and emoji required' });
  if (!VALID_EMOJIS.has(emoji)) return res.status(400).json({ error: 'Invalid emoji' });

  try {
    const { rows: existing } = await pool.query(
      'SELECT * FROM reactions WHERE pick_id = $1 AND user_id = $2',
      [pickId, req.user.userId]
    );

    if (existing.length > 0 && existing[0].emoji === emoji) {
      // Same emoji — remove it (toggle off)
      await pool.query('DELETE FROM reactions WHERE pick_id = $1 AND user_id = $2', [pickId, req.user.userId]);
      return res.json({ action: 'removed' });
    }

    // Upsert — add or switch emoji
    await pool.query(
      `INSERT INTO reactions (pick_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT (pick_id, user_id) DO UPDATE SET emoji = $3, created_at = CURRENT_TIMESTAMP`,
      [pickId, req.user.userId, emoji]
    );

    res.json({ action: existing.length > 0 ? 'switched' : 'added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
