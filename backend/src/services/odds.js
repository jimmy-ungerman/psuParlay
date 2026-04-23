import axios from 'axios';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf';
// Bookmaker preference order
const PREFERRED_BOOKS = ['draftkings', 'fanduel', 'bovada', 'betmgm'];

export function isMockMode() {
  return !process.env.ODDS_API_KEY;
}

// Fetch current NCAAF spread odds from The Odds API.
// Returns games with real home_spread values.
export async function fetchOddsApiGames() {
  const res = await axios.get(`${ODDS_API_BASE}/odds/`, {
    params: {
      apiKey: process.env.ODDS_API_KEY,
      regions: 'us',
      markets: 'spreads',
      oddsFormat: 'american',
    },
    timeout: 10000,
  });

  // Log remaining API quota
  const remaining = res.headers['x-requests-remaining'];
  if (remaining) console.log(`Odds API requests remaining: ${remaining}`);

  return res.data.map(parseOddsEvent).filter(Boolean);
}

function parseOddsEvent(game) {
  const bookmaker =
    PREFERRED_BOOKS.map(k => game.bookmakers.find(b => b.key === k)).find(Boolean)
    ?? game.bookmakers[0];

  if (!bookmaker) return null;

  const spreadsMarket = bookmaker.markets?.find(m => m.key === 'spreads');
  if (!spreadsMarket) return null;

  const homeOutcome = spreadsMarket.outcomes.find(o => o.name === game.home_team);
  if (!homeOutcome) return null;

  return {
    oddsApiId: game.id,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    homeSpread: homeOutcome.point, // negative = home is favored
    commenceTime: game.commence_time,
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

export function generateMockSpread() {
  const spread = TYPICAL_SPREADS[Math.floor(Math.random() * TYPICAL_SPREADS.length)];
  return Math.random() > 0.45 ? spread : -spread;
}

export function fluctuateSpread(currentSpread) {
  const moves = [-1, -0.5, 0, 0, 0.5, 1];
  const delta = moves[Math.floor(Math.random() * moves.length)];
  return parseFloat((currentSpread + delta).toFixed(1));
}
