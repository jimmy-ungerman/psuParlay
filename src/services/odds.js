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
// recent successful call. Stored in the DB (not process memory) so it
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
  };
}

// Fetch current NCAAF spread odds from The Odds API.
// Returns games with real home_spread values.
export async function fetchOddsApiGames() {
  const res = await axios.get(`${ODDS_API_BASE}/odds/`, {
    params: {
      apiKey: process.env.ODDS_API_KEY,
      regions: 'us',
      markets: 'spreads,totals',
      oddsFormat: 'american',
    },
    timeout: 10000,
  });

  const remaining = res.headers['x-requests-remaining'];
  const used = res.headers['x-requests-used'];
  const lastCost = res.headers['x-requests-last'];
  if (remaining != null) {
    await pool.query(
      `INSERT INTO odds_quota (id, remaining, used, last_cost, updated_at) VALUES (1, $1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET remaining = excluded.remaining, used = excluded.used, last_cost = excluded.last_cost, updated_at = excluded.updated_at`,
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
