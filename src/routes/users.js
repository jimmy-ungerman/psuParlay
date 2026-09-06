import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/users — all users (needed for "needs a pick" feature)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, is_admin, is_link_admin, must_change_password, created_at FROM users ORDER BY created_at'
    );
    res.json({ users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users — manually create an account (admin only), bypassing the invite
// flow. The user logs in with the temp password and must change it on first login.
router.post('/', requireAdmin, async (req, res) => {
  const { username, tempPassword } = req.body;
  if (!username?.trim() || !tempPassword) {
    return res.status(400).json({ error: 'Username and temporary password required' });
  }
  if (tempPassword.length < 6) {
    return res.status(400).json({ error: 'Temporary password must be at least 6 characters' });
  }

  try {
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, is_admin, must_change_password)
       VALUES ($1, $2, 0, 1) RETURNING id, username, is_admin, is_link_admin, must_change_password`,
      [username.trim(), passwordHash]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/:id/reset-password — admin sets a temp password for a user who
// forgot theirs (no email flow). Forces a change on the user's next login.
router.post('/:id/reset-password', requireAdmin, async (req, res) => {
  const { tempPassword } = req.body;
  if (!tempPassword || tempPassword.length < 6) {
    return res.status(400).json({ error: 'Temporary password must be at least 6 characters' });
  }

  try {
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const { rows } = await pool.query(
      `UPDATE users SET password_hash = $1, must_change_password = 1 WHERE id = $2
       RETURNING id, username, is_admin, is_link_admin, must_change_password`,
      [passwordHash, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
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
