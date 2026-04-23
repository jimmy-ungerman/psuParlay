import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function generateCode() {
  return uuidv4().replace(/-/g, '').toUpperCase().slice(0, 6);
}

router.post('/', async (req, res) => {
  const { name, displayName } = req.body;
  if (!name?.trim() || !displayName?.trim()) {
    return res.status(400).json({ error: 'name and displayName are required' });
  }

  try {
    let code, attempts = 0;
    do {
      code = generateCode();
      attempts++;
      if (attempts > 10) return res.status(500).json({ error: 'Could not generate unique code' });
    } while ((await pool.query('SELECT id FROM rooms WHERE code = $1', [code])).rows.length > 0);

    const { rows: roomRows } = await pool.query(
      'INSERT INTO rooms (code, name) VALUES ($1, $2) RETURNING *',
      [code, name.trim().slice(0, 100)]
    );
    const room = roomRows[0];

    const token = uuidv4();
    const { rows: userRows } = await pool.query(
      'INSERT INTO users (room_id, display_name, session_token, is_admin) VALUES ($1, $2, $3, TRUE) RETURNING *',
      [room.id, displayName.trim().slice(0, 50), token]
    );

    res.status(201).json({ token, user: userRows[0], room });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:code', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*,
        (SELECT COUNT(*) FROM users WHERE room_id = r.id) as member_count
       FROM rooms r WHERE r.code = $1`,
      [req.params.code.toUpperCase()]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });

    const { rows: members } = await pool.query(
      'SELECT id, display_name, is_admin, created_at FROM users WHERE room_id = $1 ORDER BY created_at',
      [rows[0].id]
    );

    res.json({ room: rows[0], members });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
