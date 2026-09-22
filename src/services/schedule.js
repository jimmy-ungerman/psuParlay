import pool from '../db/index.js';
import { getActiveWeekGames } from './espn.js';
import {
  fetchOddsApiGames,
  generateMockSpread,
  generateMockTotal,
  isMockMode,
  teamsMatch,
} from './odds.js';

// Cache the seeding result for 5 minutes so concurrent requests and rapid
// reloads don't hammer the ESPN or Odds APIs.
let seedCache = null; // { result, expiresAt }
let seedingPromise = null; // deduplicates concurrent in-flight calls

export async function ensureGamesSeededCached() {
  const now = Date.now();
  if (seedCache && now < seedCache.expiresAt) return seedCache.result;
  if (!seedingPromise) {
    seedingPromise = ensureGamesSeeded()
      .then(result => {
        seedCache = { result, expiresAt: Date.now() + 5 * 60 * 1000 };
        seedingPromise = null;
        return result;
      })
      .catch(err => {
        seedingPromise = null;
        throw err;
      });
  }
  return seedingPromise;
}

export async function ensureGamesSeeded() {
  const { season, week, events } = await getActiveWeekGames();
  if (events.length === 0) return { season, week };

  const { rows: existing } = await pool.query(
    'SELECT espn_id FROM games WHERE week_number = $1 AND season = $2',
    [week, season]
  );
  const existingIds = new Set(existing.map(r => r.espn_id));

  // Exclude week 0 games — only seed games from September onwards
  const seasonStart = new Date(`${season}-09-01T00:00:00Z`);
  const eligibleEvents = events.filter(e => new Date(e.commenceTime) >= seasonStart);
  const newEvents = eligibleEvents.filter(e => !existingIds.has(e.espnId));

  // Backfill conference for any existing games that are missing it
  const needsConference = events.filter(e => existingIds.has(e.espnId) && e.conference);
  for (const e of needsConference) {
    await pool.query(
      `UPDATE games SET conference = $1 WHERE espn_id = $2 AND conference IS NULL`,
      [e.conference, e.espnId]
    );
  }

  // Backfill AP rank for any existing games that are missing it (e.g. a team was
  // unranked when first seeded but the poll has since updated)
  const needsRank = events.filter(e => existingIds.has(e.espnId) && (e.homeRank || e.awayRank));
  for (const e of needsRank) {
    await pool.query(
      `UPDATE games SET home_rank = $1, away_rank = $2 WHERE espn_id = $3 AND home_rank IS NULL AND away_rank IS NULL`,
      [e.homeRank, e.awayRank, e.espnId]
    );
  }

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
    const total = generateMockTotal();
    await pool.query(
      `INSERT INTO games (espn_id, home_team, away_team, home_abbr, away_abbr, home_spread, total, commence_time, week_number, season, status, conference, home_rank, away_rank)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (espn_id) DO UPDATE SET conference = excluded.conference WHERE games.conference IS NULL RETURNING id`,
      [event.espnId, event.homeTeam, event.awayTeam, event.homeAbbr, event.awayAbbr,
       spread, total, event.commenceTime, week, season, event.status, event.conference,
       event.homeRank, event.awayRank]
    );
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
    if (!oddsGame) {
      console.log(`No odds yet for ${event.homeTeam} vs ${event.awayTeam}, skipping until lines are posted`);
      continue;
    }
    const spread = oddsGame.homeSpread;
    const total = oddsGame.total ?? null;

    await pool.query(
      `INSERT INTO games (espn_id, home_team, away_team, home_abbr, away_abbr, home_spread, total, commence_time, week_number, season, status, conference, home_rank, away_rank)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (espn_id) DO UPDATE SET conference = excluded.conference WHERE games.conference IS NULL RETURNING id`,
      [event.espnId, event.homeTeam, event.awayTeam, event.homeAbbr, event.awayAbbr,
       spread, total, event.commenceTime, week, season, event.status, event.conference,
       event.homeRank, event.awayRank]
    );
  }
}
