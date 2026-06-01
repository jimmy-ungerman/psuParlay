import { Router } from 'express';
import pool from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { getCurrentWeekGames } from '../services/espn.js';
import { fetchOddsApiGames, generateMockSpread, isMockMode, teamsMatch } from '../services/odds.js';

const router = Router();

// Cache the seeding result for 5 minutes so concurrent requests and
// rapid reloads don't hammer the ESPN or Odds APIs.
let seedCache = null; // { result, expiresAt }
let seedingPromise = null; // deduplicates concurrent in-flight calls

async function ensureGamesSeededCached() {
  const now = Date.now();
  if (seedCache && now < seedCache.expiresAt) return seedCache.result;
  // Deduplicate: if a seed is already in flight, wait for it
  if (!seedingPromise) {
    seedingPromise = ensureGamesSeeded().then(result => {
      seedCache = { result, expiresAt: now + 5 * 60 * 1000 };
      seedingPromise = null;
      return result;
    }).catch(err => {
      seedingPromise = null;
      throw err;
    });
  }
  return seedingPromise;
}

// GET /api/games — returns current week's games, seeding if needed
router.get('/', requireAuth, async (req, res) => {
  try {
    const { season, week } = await ensureGamesSeededCached();
    const { rows: games } = await pool.query(
      `SELECT g.*,
        (SELECT home_spread FROM odds_snapshots WHERE game_id = g.id ORDER BY recorded_at ASC LIMIT 1) as opening_spread
       FROM games g
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

async function ensureGamesSeeded() {
  const espnData = await getCurrentWeekGames();
  const { season, week, events } = espnData;
  if (events.length === 0) return { season, week };

  const { rows: existing } = await pool.query(
    'SELECT espn_id FROM games WHERE week_number = $1 AND season = $2',
    [week, season]
  );
  const existingIds = new Set(existing.map(r => r.espn_id));
  const newEvents = events.filter(e => !existingIds.has(e.espnId));
  if (newEvents.length === 0) return { season, week };

  if (isMockMode()) {
    await seedWithMockSpreads(newEvents, week, season);
  } else {
    await seedWithRealOdds(newEvents, week, season);
  }

  return { season, week };
}

async function seedWithMockSpreads(events, week, season) {
  for (const event of events) {
    const spread = generateMockSpread();
    const { rows: inserted } = await pool.query(
      `INSERT INTO games (espn_id, home_team, away_team, home_abbr, away_abbr, home_spread, commence_time, week_number, season, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (espn_id) DO NOTHING RETURNING id`,
      [event.espnId, event.homeTeam, event.awayTeam, event.homeAbbr, event.awayAbbr,
       spread, event.commenceTime, week, season, event.status]
    );
    if (inserted.length > 0) {
      await pool.query('INSERT INTO odds_snapshots (game_id, home_spread) VALUES ($1, $2)', [inserted[0].id, spread]);
    }
  }
}

async function seedWithRealOdds(events, week, season) {
  let oddsGames;
  try {
    oddsGames = await fetchOddsApiGames();
  } catch (err) {
    console.error('Odds API failed, falling back to mock spreads:', err.message);
    return seedWithMockSpreads(events, week, season);
  }

  for (const event of events) {
    const oddsGame = oddsGames.find(
      o => teamsMatch(o.homeTeam, event.homeTeam) && teamsMatch(o.awayTeam, event.awayTeam)
    );
    const spread = oddsGame?.homeSpread ?? generateMockSpread();
    if (!oddsGame) console.warn(`No odds match for ${event.homeTeam} vs ${event.awayTeam}, using mock spread`);

    const { rows: inserted } = await pool.query(
      `INSERT INTO games (espn_id, home_team, away_team, home_abbr, away_abbr, home_spread, commence_time, week_number, season, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (espn_id) DO NOTHING RETURNING id`,
      [event.espnId, event.homeTeam, event.awayTeam, event.homeAbbr, event.awayAbbr,
       spread, event.commenceTime, week, season, event.status]
    );
    if (inserted.length > 0) {
      await pool.query('INSERT INTO odds_snapshots (game_id, home_spread) VALUES ($1, $2)', [inserted[0].id, spread]);
    }
  }
}

export default router;
