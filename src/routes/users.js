import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/users — all users (needed for "needs a pick" feature)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, is_admin, is_link_admin, created_at FROM users ORDER BY created_at'
    );
    res.json({ users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/:id/link-admin — toggle link admin role (admin only)
router.patch('/:id/link-admin', requireAdmin, async (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) required' });

  try {
    const { rows } = await pool.query(
      'UPDATE users SET is_link_admin = $1 WHERE id = $2 RETURNING id, username, is_admin, is_link_admin',
      [enabled ? 1 : 0, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
