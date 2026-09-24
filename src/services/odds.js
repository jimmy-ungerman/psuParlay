import axios from 'axios';
import pool from '../db/index.js';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf';
// Only trust these two — both are high-liquidity, sharp books. A game with
// no line from either (e.g. a P4-vs-FCS buy game) is skipped entirely
// rather than falling back to a thinner book's number.
const TRUSTED_BOOKS = ['fanduel', 'draftkings'];

export function isMockMode() {
  return !process.env.ODDS_API_KEY;
}

// Reads back whatever The Odds API's response headers said on the most
// recent successful call, plus the most recent failure (if any hasn't been
// cleared by a later success). Stored in the DB (not process memory) so it
// survives pod restarts and stays consistent if there's more than one
// replica — this is exactly the last response's numbers, nothing computed.
export async function getOddsQuota() {
  const { rows } = await pool.query(`SELECT * FROM odds_quota WHERE id = 1`);
  const row = rows[0];
  if (!row) return null;
  return {
    remaining: row.remaining,
    used: row.used,
    lastCost: row.last_cost,
    updatedAt: row.updated_at,
    lastError: row.last_error_code
      ? { code: row.last_error_code, message: row.last_error_message, at: row.last_error_at }
      : null,
  };
}

// Records an Odds API call failure (e.g. quota exhausted) so it's visible in
// the admin panel instead of only a server log line. Keeps whatever quota
// numbers we last saw — this call didn't change them, the API rejected it
// outright — falling back to 0 only if we've never had a successful call.
async function recordOddsError(code, message) {
  const { rows } = await pool.query(`SELECT remaining, used, last_cost FROM odds_quota WHERE id = 1`);
  const prev = rows[0];
  await pool.query(
    `INSERT INTO odds_quota (id, remaining, used, last_cost, last_error_code, last_error_message, last_error_at)
     VALUES (1, $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET last_error_code = excluded.last_error_code, last_error_message = excluded.last_error_message, last_error_at = excluded.last_error_at`,
    [prev?.remaining ?? 0, prev?.used ?? null, prev?.last_cost ?? null, code, message]
  );
}

// How often the *seeding* path (ensureGamesSeeded, called on every server
// start and on a 6h/Monday cron in scoreUpdater.js, none of which are aware
// of each other) is allowed to actually hit the paid endpoint. Without this,
// a single week containing a game with no DraftKings/FanDuel line yet (a
// buy game Vegas hasn't posted) stays "new" forever, so every startup and
// every 6h tick re-fetches the whole slate just to re-confirm that one game
// still isn't posted — silently burning credits the tuned refresh cadence
// above never accounted for. This is independent of that cadence: it only
// gates seeding, never the deliberate refresh/manual-refresh calls.
const SEED_THROTTLE_MS = 60 * 60 * 1000;

export async function canAttemptOddsSeed() {
  const { rows } = await pool.query(`SELECT last_seed_attempt_at FROM odds_quota WHERE id = 1`);
  const last = rows[0]?.last_seed_attempt_at;
  if (!last) return true;
  // SQLite's CURRENT_TIMESTAMP is UTC but stored without a timezone suffix
  // ("YYYY-MM-DD HH:MM:SS") — without appending Z, Date parses it as local
  // time and the throttle math comes out wrong by the server's UTC offset.
  const lastMs = new Date(`${last.replace(' ', 'T')}Z`).getTime();
  return Date.now() - lastMs >= SEED_THROTTLE_MS;
}

export async function recordOddsSeedAttempt() {
  await pool.query(
    `INSERT INTO odds_quota (id, remaining, last_seed_attempt_at) VALUES (1, 0, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET last_seed_attempt_at = excluded.last_seed_attempt_at`
  );
}

// Fetch current NCAAF spread odds from The Odds API.
// Returns games with real home_spread values.
export async function fetchOddsApiGames() {
  let res;
  try {
    res = await axios.get(`${ODDS_API_BASE}/odds/`, {
      params: {
        apiKey: process.env.ODDS_API_KEY,
        regions: 'us',
        markets: 'spreads,totals',
        oddsFormat: 'american',
      },
      timeout: 10000,
    });
  } catch (err) {
    const code = err.response?.data?.error_code ?? null;
    const message = err.response?.data?.message ?? err.message;
    await recordOddsError(code, message);
    throw err;
  }

  const remaining = res.headers['x-requests-remaining'];
  const used = res.headers['x-requests-used'];
  const lastCost = res.headers['x-requests-last'];
  if (remaining != null) {
    await pool.query(
      `INSERT INTO odds_quota (id, remaining, used, last_cost, updated_at, last_error_code, last_error_message, last_error_at)
       VALUES (1, $1, $2, $3, CURRENT_TIMESTAMP, NULL, NULL, NULL)
       ON CONFLICT (id) DO UPDATE SET remaining = excluded.remaining, used = excluded.used, last_cost = excluded.last_cost, updated_at = excluded.updated_at, last_error_code = NULL, last_error_message = NULL, last_error_at = NULL`,
      [Number(remaining), used != null ? Number(used) : null, lastCost != null ? Number(lastCost) : null]
    );
    console.log(`Odds API requests remaining: ${remaining}`);
  }

  return res.data.map(parseOddsEvent).filter(Boolean);
}

function parseOddsEvent(game) {
  const bookmaker = TRUSTED_BOOKS
    .map(k => game.bookmakers.find(b => b.key === k))
    .find(Boolean);

  if (!bookmaker) {
    console.log(`[odds] ${game.away_team} @ ${game.home_team}: no DraftKings/FanDuel line, skipping`);
    return null;
  }

  const spreadsMarket = bookmaker.markets?.find(m => m.key === 'spreads');
  if (!spreadsMarket) return null;

  const homeOutcome = spreadsMarket.outcomes.find(o => o.name === game.home_team);
  if (!homeOutcome) return null;

  const totalsMarket = bookmaker.markets?.find(m => m.key === 'totals');
  const overOutcome = totalsMarket?.outcomes.find(o => o.name === 'Over');

  console.log(`[odds] ${game.away_team} @ ${game.home_team}: ${bookmaker.key} spread=${homeOutcome.point}`);

  return {
    oddsApiId: game.id,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    homeSpread: homeOutcome.point,
    total: overOutcome?.point ?? null,
    commenceTime: game.commence_time,
    bookmakerKey: bookmaker.key,
  };
}

// Normalize a team name for fuzzy matching between APIs
export function normalizeTeam(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

export function teamsMatch(a, b) {
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// --- Mock mode helpers (used when ODDS_API_KEY is not set) ---

const TYPICAL_SPREADS = [-3, -3.5, -6.5, -7, -7.5, -10, -10.5, -13.5, -14, -17, -21, -24.5, -28];
const TYPICAL_TOTALS = [41.5, 44.5, 47.5, 48.5, 51.5, 54, 55.5, 57.5, 61.5, 65];

export function generateMockSpread() {
  const spread = TYPICAL_SPREADS[Math.floor(Math.random() * TYPICAL_SPREADS.length)];
  return Math.random() > 0.45 ? spread : -spread;
}

export function generateMockTotal() {
  return TYPICAL_TOTALS[Math.floor(Math.random() * TYPICAL_TOTALS.length)];
}

export function fluctuateSpread(currentSpread) {
  const moves = [-1, -0.5, 0, 0, 0.5, 1];
  const delta = moves[Math.floor(Math.random() * moves.length)];
  return parseFloat((currentSpread + delta).toFixed(1));
}
