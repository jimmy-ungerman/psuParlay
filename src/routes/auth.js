import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/index.js';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/auth/me — returns current user from cookie session
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    setAuthCookie(res, signToken(user));
    res.json({ user: { id: user.id, username: user.username, isAdmin: !!user.is_admin } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// POST /api/auth/register
// - First ever registration (no users exist): no invite required, becomes admin
// - All subsequent registrations: invite token required
router.post('/register', async (req, res) => {
  const { username, password, inviteToken } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const { rows: existing } = await pool.query('SELECT COUNT(*) as count FROM users');
    const isFirstUser = existing[0].count === 0;

    if (!isFirstUser) {
      // Validate invite token
      if (!inviteToken) return res.status(400).json({ error: 'Invite token required' });

      const { rows: invites } = await pool.query(
        'SELECT * FROM invites WHERE token = $1 AND used_by IS NULL',
        [inviteToken]
      );
      if (invites.length === 0) return res.status(400).json({ error: 'Invalid or already used invite link' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { rows: users } = await pool.query(
      'INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, $3) RETURNING *',
      [username.trim(), passwordHash, isFirstUser ? 1 : 0]
    );
    const user = users[0];

    // Mark invite as used
    if (!isFirstUser) {
      await pool.query(
        'UPDATE invites SET used_by = $1, used_at = CURRENT_TIMESTAMP WHERE token = $2',
        [user.id, inviteToken]
      );
    }

    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: { id: user.id, username: user.username, isAdmin: !!user.is_admin } });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Username already taken' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
