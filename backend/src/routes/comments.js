import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPushToAll } from '../services/push.js';

const router = Router();

// GET /api/comments?week=&season=
router.get('/', requireAuth, async (req, res) => {
  const { week, season } = req.query;
  if (!week || !season) return res.status(400).json({ error: 'week and season required' });

  try {
    const { rows } = await pool.query(
      `SELECT c.*, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.week_number = $1 AND c.season = $2
       ORDER BY c.created_at ASC`,
      [week, season]
    );
    res.json({ comments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/comments
router.post('/', requireAuth, async (req, res) => {
  const { content, weekNumber, season } = req.body;
  const trimmed = content?.trim();
  if (!trimmed || !weekNumber || !season) {
    return res.status(400).json({ error: 'content, weekNumber, and season required' });
  }
  if (trimmed.length > 280) return res.status(400).json({ error: 'Max 280 characters' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO comments (week_number, season, user_id, content) VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [weekNumber, season, req.user.userId, trimmed]
    );
    const preview = trimmed.length > 60 ? trimmed.slice(0, 57) + '...' : trimmed;
    sendPushToAll(
      { title: `💬 ${req.user.username}`, body: preview },
      req.user.userId,
    ).catch(() => {});

    res.status(201).json({ comment: { ...rows[0], username: req.user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/comments/:id — only the author can delete
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Comment not found or not yours' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
