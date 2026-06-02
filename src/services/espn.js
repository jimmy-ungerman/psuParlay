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

export async function fetchLiveScores(espnIds) {
  try {
    const res = await axios.get(`${ESPN_BASE}/scoreboard`, { timeout: 10000 });
    const events = res.data.events || [];
    return events
      .filter(e => espnIds.includes(e.id))
      .map(parseEvent);
  } catch (err) {
    console.error('ESPN score fetch failed:', err.message);
    return [];
  }
}

function parseScoreboard(data) {
  const season = data.season?.year || new Date().getFullYear();
  const week = data.week?.number || 1;
  const events = (data.events || []).map(parseEvent);
  return { season, week, events };
}

export function parseEvent(event) {
  const comp = event.competitions?.[0];
  const home = comp?.competitors?.find(c => c.homeAway === 'home');
  const away = comp?.competitors?.find(c => c.homeAway === 'away');
  const statusName = comp?.status?.type?.name;

  return {
    espnId: event.id,
    homeTeam: home?.team?.displayName || 'TBD',
    awayTeam: away?.team?.displayName || 'TBD',
    homeAbbr: home?.team?.abbreviation || '???',
    awayAbbr: away?.team?.abbreviation || '???',
    conference: normalizeConference(comp?.groups?.name),
    commenceTime: event.date,
    status: mapStatus(statusName),
    homeScore: home?.score !== undefined && home.score !== '' ? parseInt(home.score) : null,
    awayScore: away?.score !== undefined && away.score !== '' ? parseInt(away.score) : null,
  };
}

function mapStatus(espnStatus) {
  if (espnStatus === 'STATUS_FINAL') return 'complete';
  if (espnStatus === 'STATUS_IN_PROGRESS') return 'in_progress';
  return 'scheduled';
}
