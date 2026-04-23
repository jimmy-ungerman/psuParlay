import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/invites — admin: list all invites
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*,
        creator.username as created_by_name,
        used.username as used_by_name
       FROM invites i
       LEFT JOIN users creator ON i.created_by = creator.id
       LEFT JOIN users used ON i.used_by = used.id
       ORDER BY i.created_at DESC`
    );
    res.json({ invites: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/invites — admin: create invite
router.post('/', requireAdmin, async (req, res) => {
  const { label } = req.body;
  const token = uuidv4().replace(/-/g, '');

  try {
    const { rows } = await pool.query(
      'INSERT INTO invites (token, label, created_by) VALUES ($1, $2, $3) RETURNING *',
      [token, label?.trim() || null, req.user.userId]
    );
    res.status(201).json({ invite: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/invites/:id — admin: revoke unused invite
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM invites WHERE id = $1 AND used_by IS NULL RETURNING id',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Invite not found or already used' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/invites/validate/:token — public: check if token is valid (for registration page)
router.get('/validate/:token', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, label FROM invites WHERE token = $1 AND used_by IS NULL',
      [req.params.token]
    );
    if (rows.length === 0) return res.status(404).json({ valid: false });
    res.json({ valid: true, label: rows[0].label });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
