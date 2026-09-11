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

// groups=80 = FBS, limit=300 ensures we get every game in the week rather than
// ESPN's default "top 25-ish" scoreboard slate.
export async function getCurrentWeekGames() {
  const res = await axios.get(`${ESPN_BASE}/scoreboard`, {
    params: { groups: 80, limit: 300 },
    timeout: 10000,
  });
  return parseScoreboard(res.data);
}

// The pick week rolls to the next one every Monday at 6 AM ET — ahead of ESPN's
// own scoreboard, which lingers on the just-played week until roughly Tuesday.
// Once we're past that Monday, return next week's slate instead of the current one.
const WEEK_ROLLOVER_HOUR_ET = 6;

export async function getActiveWeekGames() {
  const current = await getCurrentWeekGames();
  if (!pastWeekRollover(current.events)) return current;
  console.log(`Week rollover: past Monday cutoff for wk ${current.week}, advancing to wk ${current.week + 1}`);

  const nextWeek = current.week + 1;
  try {
    const next = await getWeekGames(current.season, nextWeek);
    if (next.events.length > 0) {
      return { season: current.season, week: nextWeek, events: next.events };
    }
  } catch (err) {
    console.error(`Week rollover: ${current.season} wk ${nextWeek} fetch failed:`, err.message);
  }
  return current;
}

// True once `now` is past 6 AM ET on the Monday after this slate's Saturday.
export function pastWeekRollover(events, now = Date.now()) {
  const sat = slateSaturday(events);
  if (!sat) return false;
  const monday = addDays(sat, 2);
  return now >= etCutoff(monday, WEEK_ROLLOVER_HOUR_ET);
}

// The college-football "week Saturday" (YYYY-MM-DD, ET) that a kickoff belongs to:
// Thu–Sat map to that Saturday, Sun/Mon map back to the Saturday just before them.
export function weekSaturday(commenceTime) {
  // ET is UTC-4 (EDT) for the whole Sep–Nov season.
  const et = new Date(new Date(commenceTime).getTime() - 4 * 3600 * 1000);
  const day = et.getUTCDay(); // 0=Sun … 6=Sat
  const offset = day === 0 ? -1 : day === 1 ? -2 : 6 - day;
  et.setUTCDate(et.getUTCDate() + offset);
  return et.toISOString().slice(0, 10);
}

// The Saturday most of a week's games belong to (most common; latest on a tie).
function slateSaturday(events) {
  if (!events?.length) return null;
  const counts = {};
  for (const e of events) {
    const s = weekSaturday(e.commenceTime);
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0][0];
}

function addDays(dateStr, n) {
  const dt = new Date(`${dateStr}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// Epoch ms for `YYYY-MM-DD` at `hour`:00 America/New_York (DST-aware).
function etCutoff(dateStr, hour) {
  const [y, m, d] = dateStr.split('-').map(Number);
  for (const tzOffset of [4, 5]) { // EDT, then EST
    const candidate = new Date(Date.UTC(y, m - 1, d, hour + tzOffset, 0));
    const etHour = parseInt(
      candidate.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false })
    );
    if (etHour === hour) return candidate.getTime();
  }
  return Date.UTC(y, m - 1, d, hour + 4, 0);
}

export async function getWeekGames(season, week) {
  const res = await axios.get(`${ESPN_BASE}/scoreboard`, {
    params: { dates: season, week, seasontype: 2, groups: 80, limit: 300 },
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
