import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getPickDeadline } from '../services/results.js';

const router = Router();

// GET /api/consensus?week=&season=
router.get('/', requireAuth, async (req, res) => {
  const { week, season } = req.query;
  if (!week || !season) return res.status(400).json({ error: 'week and season required' });

  try {
    const { rows: games } = await pool.query(
      `SELECT id, home_team, away_team, home_spread, home_abbr, away_abbr,
              commence_time, status, home_score, away_score
       FROM games
       WHERE week_number = $1 AND season = $2
         AND (home_team LIKE '%Penn State%' OR away_team LIKE '%Penn State%')
       LIMIT 1`,
      [week, season]
    );

    const { rows: votes } = await pool.query(
      `SELECT cv.user_id, cv.vote, u.username
       FROM consensus_votes cv
       JOIN users u ON cv.user_id = u.id
       WHERE cv.week_number = $1 AND cv.season = $2
       ORDER BY cv.created_at ASC`,
      [week, season]
    );

    const { rows: userRows } = await pool.query('SELECT COUNT(*) as count FROM users', []);
    const totalUsers = parseInt(userRows[0].count);

    const yesVotes = votes.filter(v => v.vote === 'yes').length;
    const noVotes = votes.filter(v => v.vote === 'no').length;
    const consensusReached = yesVotes > totalUsers / 2;
    const myVote = votes.find(v => v.user_id === req.user.userId)?.vote || null;

    const game = games[0] || null;
    let psuSpread = null;
    if (game) {
      const psuIsHome = game.home_team.includes('Penn State');
      psuSpread = psuIsHome ? game.home_spread : (game.home_spread !== null ? -game.home_spread : null);
    }

    res.json({ game, psuSpread, votes, totalUsers, yesVotes, noVotes, consensusReached, myVote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/consensus/vote
router.post('/vote', requireAuth, async (req, res) => {
  const { week, season, vote } = req.body;
  if (!week || !season || !vote) return res.status(400).json({ error: 'week, season, and vote required' });
  if (!['yes', 'no'].includes(vote)) return res.status(400).json({ error: 'vote must be yes or no' });

  try {
    // Lock voting once the game has started
    const { rows: games } = await pool.query(
      `SELECT status FROM games
       WHERE week_number = $1 AND season = $2
         AND (home_team LIKE '%Penn State%' OR away_team LIKE '%Penn State%')
       LIMIT 1`,
      [week, season]
    );
    if (games[0]?.status !== 'scheduled') {
      return res.status(400).json({ error: 'Voting is locked once the game has started' });
    }

    // Check consensus before recording this vote
    const { rows: allVotesBefore } = await pool.query(
      'SELECT vote FROM consensus_votes WHERE week_number = $1 AND season = $2',
      [week, season]
    );
    const { rows: userCountRows } = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(userCountRows[0].count);
    const consensusBefore = allVotesBefore.filter(v => v.vote === 'yes').length > totalUsers / 2;

    const { rows: existing } = await pool.query(
      'SELECT vote FROM consensus_votes WHERE week_number = $1 AND season = $2 AND user_id = $3',
      [week, season, req.user.userId]
    );

    let action;
    if (existing.length > 0 && existing[0].vote === vote) {
      await pool.query(
        'DELETE FROM consensus_votes WHERE week_number = $1 AND season = $2 AND user_id = $3',
        [week, season, req.user.userId]
      );
      action = 'removed';
    } else {
      await pool.query(
        `INSERT INTO consensus_votes (week_number, season, user_id, vote) VALUES ($1, $2, $3, $4)
         ON CONFLICT (week_number, season, user_id) DO UPDATE SET vote = $4, created_at = CURRENT_TIMESTAMP`,
        [week, season, req.user.userId, vote]
      );
      action = existing.length > 0 ? 'switched' : 'added';
    }

    // Check consensus after recording this vote
    const { rows: allVotesAfter } = await pool.query(
      'SELECT vote FROM consensus_votes WHERE week_number = $1 AND season = $2',
      [week, season]
    );
    const consensusAfter = allVotesAfter.filter(v => v.vote === 'yes').length > totalUsers / 2;

    // If consensus just tipped, clear any picks on the PSU game
    let clearedPickUserIds = [];
    if (!consensusBefore && consensusAfter) {
      const { rows: psuGames } = await pool.query(
        `SELECT id, commence_time FROM games
         WHERE week_number = $1 AND season = $2
           AND (home_team LIKE '%Penn State%' OR away_team LIKE '%Penn State%')
         LIMIT 1`,
        [week, season]
      );
      if (psuGames.length > 0) {
        const psuGame = psuGames[0];
        if (new Date() < getPickDeadline(psuGame.commence_time)) {
          const { rows: cleared } = await pool.query(
            `DELETE FROM picks WHERE game_id = $1 AND result = 'pending' RETURNING user_id`,
            [psuGame.id]
          );
          clearedPickUserIds = cleared.map(r => r.user_id);
        }
      }
    }

    const consensusDropped = consensusBefore && !consensusAfter;

    res.json({ action, clearedPickUserIds, consensusDropped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
