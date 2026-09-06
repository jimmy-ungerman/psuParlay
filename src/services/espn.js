import axios from 'axios';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football';

const CONF_NAME_MAP = {
  'Southeastern Conference': 'SEC',
  'Big Ten Conference': 'Big Ten',
  'Big 12 Conference': 'Big 12',
  'Atlantic Coast Conference': 'ACC',
  'Mountain West Conference': 'Mtn West',
  'American Athletic Conference': 'AAC',
  'Mid-American Conference': 'MAC',
  'Sun Belt Conference': 'Sun Belt',
  'Conference USA': 'CUSA',
  'FBS Independents': 'Ind.',
  'Pac-12 Conference': 'Pac-12',
};

function normalizeConference(name) {
  if (!name) return null;
  return CONF_NAME_MAP[name] ?? name;
}

export async function getCurrentWeekGames() {
  const res = await axios.get(`${ESPN_BASE}/scoreboard`, { timeout: 10000 });
  return parseScoreboard(res.data);
}

export async function getWeekGames(season, week) {
  const res = await axios.get(`${ESPN_BASE}/scoreboard`, {
    params: { dates: season, week, seasontype: 2 },
    timeout: 10000,
  });
  return parseScoreboard(res.data);
}

// Pull scores for the given espn ids. `weeks` is a list of { season, week } to
// query — needed because ESPN's default scoreboard only covers a rolling window,
// so games that kicked off on Sunday/Monday (or last week) drop off it and never
// get their final score. Falls back to the current scoreboard if no weeks given.
export async function fetchLiveScores(espnIds, weeks = []) {
  const ids = new Set(espnIds);
  const boards = weeks.length > 0
    ? weeks.map(w => getWeekGames(w.season, w.week).then(d => d.events).catch(err => {
        console.error(`ESPN score fetch failed (${w.season} wk ${w.week}):`, err.message);
        return [];
      }))
    : [getCurrentWeekGames().then(d => d.events).catch(err => {
        console.error('ESPN score fetch failed:', err.message);
        return [];
      })];

  const byId = new Map();
  for (const events of await Promise.all(boards)) {
    for (const event of events) {
      if (ids.has(event.espnId)) byId.set(event.espnId, event);
    }
  }
  return [...byId.values()];
}

function parseScoreboard(data) {
  const season = data.season?.year || new Date().getFullYear();
  const week = data.week?.number || 1;
  const events = (data.events || []).map(parseEvent);
  return { season, week, events };
}

// ESPN's curatedRank tracks the AP Poll all season (verified: doesn't switch to CFP
// committee rankings once those start in November - checked a week where the two
// disagreed on team order and curatedRank followed AP). 99 is the "unranked" sentinel.
function parseRank(competitor) {
  const rank = competitor?.curatedRank?.current;
  return rank && rank !== 99 ? rank : null;
}

export function parseEvent(event) {
  const comp = event.competitions?.[0];
  const home = comp?.competitors?.find(c => c.homeAway === 'home');
  const away = comp?.competitors?.find(c => c.homeAway === 'away');
  const status = mapStatus(comp?.status?.type?.name);

  // ESPN returns score: "0" (a string) for games that haven't kicked off yet.
  // Only trust scores once the game is actually underway, otherwise a scheduled
  // game gets stored as 0-0 and renders as a phantom "Final".
  const hasLiveScore = status === 'in_progress' || status === 'complete';
  const parseScore = c =>
    hasLiveScore && c?.score !== undefined && c.score !== '' ? parseInt(c.score) : null;

  return {
    espnId: event.id,
    homeTeam: home?.team?.displayName || 'TBD',
    awayTeam: away?.team?.displayName || 'TBD',
    homeAbbr: home?.team?.abbreviation || '???',
    awayAbbr: away?.team?.abbreviation || '???',
    homeRank: parseRank(home),
    awayRank: parseRank(away),
    conference: normalizeConference(comp?.groups?.name),
    commenceTime: event.date,
    status,
    homeScore: parseScore(home),
    awayScore: parseScore(away),
  };
}

function mapStatus(espnStatus) {
  if (espnStatus === 'STATUS_FINAL') return 'complete';
  if (
    espnStatus === 'STATUS_IN_PROGRESS' ||
    espnStatus === 'STATUS_HALFTIME' ||
    espnStatus === 'STATUS_END_PERIOD'
  ) {
    return 'in_progress';
  }
  return 'scheduled';
}
