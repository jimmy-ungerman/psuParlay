#!/usr/bin/env node
// Import 2025 historical parlay stats into historical_picks table.
// Run: node scripts/import-2025.js

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// ── ESPN helpers ─────────────────────────────────────────────────────────────

async function fetchEspnWeek(season, week) {
  // groups=80 = FBS, limit=300 ensures we get all games in a week
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${season}&week=${week}&seasontype=2&groups=80&limit=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.events || []).map(parseEspnEvent);
}

function parseEspnEvent(event) {
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
    commenceTime: event.date,
    status: statusName === 'STATUS_FINAL' ? 'complete'
           : statusName === 'STATUS_IN_PROGRESS' ? 'in_progress' : 'scheduled',
    homeScore: home?.score !== undefined && home.score !== '' ? parseInt(home.score) : null,
    awayScore: away?.score !== undefined && away.score !== '' ? parseInt(away.score) : null,
  };
}

function normalizeTeam(name) {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

// Words that indicate a *different* school when they follow a shared prefix.
// e.g. "Iowa" should not match "Iowa State" because "State" is a qualifier.
const SCHOOL_QUALIFIERS = new Set(['state', 'tech', 'a&m', 'christian', 'southern']);

function teamsMatch(a, b) {
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  if (na === nb) return true;

  const wa = na.split(' ');
  const wb = nb.split(' ');
  const [shorter, longer] = wa.length <= wb.length ? [wa, wb] : [wb, wa];

  // Shorter words must be a prefix of longer words (exact, in order).
  // Then the very next word in the longer name must NOT be a qualifier —
  // that would indicate a different school (Iowa ≠ Iowa State, Utah ≠ Utah State, etc.)
  const isPrefix = shorter.every((w, i) => w === longer[i]);
  if (isPrefix) {
    const nextWord = longer[shorter.length];
    if (nextWord && SCHOOL_QUALIFIERS.has(nextWord)) return false;
    return true;
  }

  // Handle abbreviated first words: "App State" ↔ "Appalachian State"
  return shorter.length >= 2 &&
    (longer[0].startsWith(shorter[0]) || shorter[0].startsWith(longer[0])) &&
    shorter[1] === longer[1];
}

const DB_PATH = process.env.DB_PATH || './data/psuparlay.db';
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

// Abbreviation → ESPN canonical team name
// null = not a team pick (totals bet, etc.)
const ABBREV_MAP = {
  'A&M':       'Texas A&M',
  'AF':        'Air Force',
  'AppState':  'Appalachian State',
  'Army':      'Army',
  'Auburn':    'Auburn',
  'AzST':      'Arizona State',
  'BYU':       'BYU',
  'Bama':      'Alabama',
  'Cincy':     'Cincinnati',
  'Clem':      'Clemson',
  'Coastal':   'Coastal Carolina',
  'Colorado':  'Colorado',
  'Duke':      'Duke',
  'ECU':       'East Carolina',
  'GT':        'Georgia Tech',
  'Georgia':   'Georgia',
  'Georgia Tech': 'Georgia Tech',
  'Harvard':   'Harvard',
  'Illinois':  'Illinois',
  'Indiana':   'Indiana',
  'Iowa':      'Iowa',
  'Iowa St':   'Iowa State',
  'JMU':       'James Madison',
  'K State':   'Kansas State',
  'Kansas':    'Kansas',
  'Kennesaw':  'Kennesaw State',
  'Lehigh':    'Lehigh',
  'Lville':    'Louisville',
  'Marshall':  'Marshall',
  'Maryland':  'Maryland',
  'Memphis':   'Memphis',
  'Miami':     'Miami',
  'Minn':      'Minnesota',
  'Missou':    'Missouri',
  'Mizzou':    'Missouri',
  'ND':        'Notre Dame',
  'NWestern':  'Northwestern',
  'Nwestrn':   'Northwestern',
  'OK':        'Oklahoma',
  'OSU':       'Ohio State',
  'Oklahoma':  'Oklahoma',
  'Ole Miss':  'Ole Miss',
  'Oregon':    'Oregon',
  'PSU':       'Penn State',
  'Penn State': 'Penn State',
  'Pitt':      'Pittsburgh',
  'Rice':      'Rice',
  'SC':        'South Carolina',
  'SDSU':      'San Diego State',
  'Michigan':  'Michigan',
  'SMU':       'SMU',
  'SoMiss':    'Southern Miss',
  'Tulane':    'Tulane',
  'Stan':      'Stanford',
  'Ten':       'Tennessee',
  'Tenn':      'Tennessee',
  'Texas Tech':'Texas Tech',
  'Toledo':    'Toledo',
  'UCF':       'UCF',
  'UCLA':      'UCLA',
  'UCONN':     'UConn',
  'UConn':     'UConn',
  'UK':        'Kentucky',
  'UNLV':      'UNLV',
  'USC':       'USC',
  'USF':       'South Florida',
  'UTSA':      'UTSA',
  'Utah':      'Utah',

  'VA':        'Virginia',
  'Vandy':     'Vanderbilt',
  'Virginia':  'Virginia',
  'Wake':      'Wake Forest',
  'Wisconsin': 'Wisconsin',
  'WVU':       'West Virginia',
  'Wash':      'Washington',
};

// Extracts team abbreviation from a pick string like "Ten -13.5" → "Ten"
function parseAbbrev(pickedTeam) {
  if (!pickedTeam) return null;
  // Strip trailing spread (e.g. " -13.5", " +7.5")
  return pickedTeam.replace(/\s+[+-][\d.]+$/, '').trim();
}

function canonicalize(pickedTeam) {
  if (!pickedTeam) return null;
  // Totals picks (Over/Under X) have no canonical team
  if (/^(Over|Under)\s+[\d.]+$/i.test(pickedTeam)) return null;
  const abbrev = parseAbbrev(pickedTeam);
  if (!abbrev) return null;
  return ABBREV_MAP[abbrev] ?? null;
}

// Ensure table exists and has picked_team column
db.exec(`CREATE TABLE IF NOT EXISTS historical_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  result TEXT NOT NULL,
  spread_value REAL NOT NULL,
  picked_team TEXT,
  canonical_team TEXT,
  game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
  UNIQUE(season, week_number, display_name)
)`);
const hpCols = db.prepare(`PRAGMA table_info(historical_picks)`).all();
if (!hpCols.some(c => c.name === 'picked_team')) {
  db.exec(`ALTER TABLE historical_picks ADD COLUMN picked_team TEXT`);
}
if (!hpCols.some(c => c.name === 'canonical_team')) {
  db.exec(`ALTER TABLE historical_picks ADD COLUMN canonical_team TEXT`);
}
if (!hpCols.some(c => c.name === 'game_id')) {
  db.exec(`ALTER TABLE historical_picks ADD COLUMN game_id INTEGER REFERENCES games(id) ON DELETE SET NULL`);
}

// Wipe all 2025 historical picks — DATA array is the source of truth.
// This ensures removed/corrected rows don't linger.
db.prepare('DELETE FROM historical_picks WHERE season = 2025').run();
console.log('Cleared existing 2025 historical picks.');

// Hardcoded 2025 data: [displayName, week, result, spreadValue, pickedTeam]
const DATA = [
  // Jobin69 (Kevin)
  ['Jobin69', 1,  'win',  27.5,  'Utah -5.5'],
  ['Jobin69', 2,  'loss', -10.5, 'UTSA -3.5'],
  ['Jobin69', 3,  'loss', -8.5,  'Auburn -24.5'],
  ['Jobin69', 4,  'win',  9.5,   'JMU -8.5'],
  ['Jobin69', 5,  'loss', -4.5,  'Marshall -1.5'],
  ['Jobin69', 6,  'loss', -10.5, 'Rice -4.5'],
  ['Jobin69', 7,  'loss', -3.5,  'UNLV -6.5'],
  ['Jobin69', 8,  'win',  3.5,   'Army +10.5'],
  ['Jobin69', 9,  'win',  19.5,  'SDSU -3.5'],
  ['Jobin69', 10, 'loss', -31,   'Colorado +4'],
  ['Jobin69', 11, 'win',  5.5,   'Coastal -7.5'],
  ['Jobin69', 12, 'win',  10.5,  'Wake -5.5'],
  ['Jobin69', 13, 'loss',  -24,  'Harvard -7'],
  ['Jobin69', 14, 'loss', -12.5, 'Wisconsin -2.5'],

  // jimmy
  ['jimmy', 1,  'win',  5.5,   'OSU -1.5'],
  ['jimmy', 2,  'loss', -2.5,  'Ole Miss -9.5'],
  ['jimmy', 3,  'win',  6.5,   'GT +3.5'],
  ['jimmy', 4,  'win',  8.5,   'Memphis +7.5'],
  ['jimmy', 5,  'loss', -3.5,  'Indiana -8.5'],
  ['jimmy', 6,  'win',  8.5,   'Illinois -7.5'],
  ['jimmy', 7,  'win',  0.5,   'Missou +3.5'],
  ['jimmy', 8,  'loss', -7.5,  'Tenn +9.5'],
  ['jimmy', 9,  'win',  4.5,   'Vandy -2.5'],
  ['jimmy', 10, 'win',  0.5,   'Vandy +3.5'],
  ['jimmy', 11, 'win',  0.5,   'Bama -10.5'],
  ['jimmy', 12, 'win',  10.5,  'Penn State -7.5'],
  ['jimmy', 13, 'loss',  -16.5,  'Georgia Tech -2.5'],
  ['jimmy', 14, 'loss',  -9.5,  'Penn State -13.5'],

  // r-zenti (Ryan Arzenti)
  ['r-zenti', 1,  'win',  6,     'SC -7'],
  ['r-zenti', 2,  'win',  38.5,  'Oregon -27.5'],
  ['r-zenti', 3,  'loss', -4.5,  'USC -20.5'],
  ['r-zenti', 4,  'win',  0.5,   'Oklahoma -6.5'],
  ['r-zenti', 5,  'win',  19.5,  'Iowa St -5.5'],
  ['r-zenti', 7,  'win',  33.5,  'Iowa -3.5'],
  ['r-zenti', 8,  'win',  5.5,   'Vandy -1.5'],
  ['r-zenti', 9,  'win',  0.5,   'Nwestrn +7.5'],
  ['r-zenti', 10, 'win',  24,    'Indiana -21'],
  ['r-zenti', 11, 'loss', -9.5,  'BYU +12.5'],

  // Sundy (unregistered)
  ['Sundy', 2,  'loss', -2,    'Lehigh -20'],
  ['Sundy', 3,  'loss', -1.5,  'Kennesaw -15.5'],
  ['Sundy', 4,  'win',  5.5,   'Lehigh -11.5'],
  ['Sundy', 5,  'loss', -1.5,  'Vandy -21.5'],
  ['Sundy', 6,  'loss', -0.5,  'ND -21.5'],
  ['Sundy', 7,  'win',  32.5,  'UCLA +7.5'],
  ['Sundy', 8,  'win',  33.5,  'JMU -2.5'],
  ['Sundy', 9,  'win',  29.5,  'Iowa -8.5'],
  ['Sundy', 11, 'win',  9.5,   'Georgia -10.5'],

  // Boxmaster69420 (Tim)
  ['Boxmaster69420', 1,  'win',  5.5,   'Ten -13.5'],
  ['Boxmaster69420', 2,  'win',  8.5,   'Memphis -13.5'],
  ['Boxmaster69420', 3,  'win',  17.5,  'Memphis -3.5'],
  ['Boxmaster69420', 4,  'win',  23.5,  'Ole Miss -11.5'],
  ['Boxmaster69420', 5,  'win',  15.5,  'Memphis -13.5'],
  ['Boxmaster69420', 6,  'win',  34.5,  'UConn -6.5'],
  ['Boxmaster69420', 7,  'loss', -15.5, 'Toledo -10.5'],
  ['Boxmaster69420', 8,  'win',  13.5,  'UCONN -1.5'],
  ['Boxmaster69420', 9,  'win',  17.5,  'Cincy -3.5'],
  ['Boxmaster69420', 10, 'win',  7.5,   'UCONN -11.5'],
  ['Boxmaster69420', 11, 'loss', -13.5, 'Wash -10.5'],
  ['Boxmaster69420', 12, 'win',  4.5,   'Marshall -7.5'],
  ['Boxmaster69420', 13, 'loss',  -4.5,   'UCONN -7.5'],
  ['Boxmaster69420', 14, 'win',  11.5,   'Virginia -8.5'],

  // Tanner (unregistered)
  ['Tanner', 2,  'loss', -7.5,  'PSU -41.5'],
  ['Tanner', 3,  'win',  0.5,   'Tenn +3.5'],
  ['Tanner', 4,  'win',  27.5,  'Texas Tech +3.5'],
  ['Tanner', 5,  'loss', -9.5,  'PSU -3.5'],
  ['Tanner', 7,  'loss', -6.5,  'Auburn +3.5'],
  ['Tanner', 9,  'win',  13.5,  'Ole Miss +5.5'],
  ['Tanner', 10, 'win',  11.5,  'Under 55.5'],
  ['Tanner', 11, 'win',  7.5,     'Under 42.5'],
  ['Tanner', 12, 'win',  6,     'Over 51'],
  ['Tanner', 13, 'win',  30.5,     'Over 58.5'],
  ['Tanner', 14, 'loss',  -6.5,     'Oklahoma -10.5'],

  // G_Money24 (Grant Grasha)
  ['G_Money24', 1,  'win',  18.5,  'Oregon -27.5'],
  ['G_Money24', 2,  'loss', -0.5,  'Iowa St -3.5'],
  ['G_Money24', 3,  'loss', -6.5,  'Oregon -26.5'],
  ['G_Money24', 4,  'win',  27.5,  'Maryland +10.5'],
  ['G_Money24', 5,  'win',  3.5,   'Ole Miss -1.5'],
  ['G_Money24', 6,  'win',  2,     'Maryland +6'],
  ['G_Money24', 7,  'win',  15.5,  'USC -2.5'],
  ['G_Money24', 8,  'win',  6.5,   'BYU +3.5'],
  ['G_Money24', 9,  'loss', -3,    'Bama -10'],
  ['G_Money24', 10, 'loss', -2.5,  'Georgia -6.5'],
  ['G_Money24', 11, 'loss', -11.5, 'Duke -8.5'],
  ['G_Money24', 12, 'loss', -1.5,  'USC -6.5'],
  ['G_Money24', 13, 'loss', -4.5,  'USC +10.5'],
  ['G_Money24', 14, 'loss', -1.5, 'Auburn +5.5'],

  // Mitch (Mitch Bacco)
  ['Mitch', 2,  'loss', -20.5, 'K State -17.5'],
  ['Mitch', 3,  'loss', -7.5,  'ND -6.5'],
  ['Mitch', 5,  'loss', -7.5,  'Kansas -4.5'],
  ['Mitch', 6,  'win',  2.5,   'AppState -1.5'],
  ['Mitch', 8,  'loss', -1.5,  'AF -4.5'],
  ['Mitch', 9,  'loss', -14.5, 'AzST -6.5'],
  ['Mitch', 10, 'loss', -0.5,  'Minn -3.5'],
  ['Mitch', 11, 'win',  0.5,   'WVU -6.5'],
  ['Mitch', 12, 'loss', -30.5, 'SoMiss -3.5'],

  // SammyBigBeans (Steve Barker)
  ['SammyBigBeans', 1,  'win',  32.5,  'Iowa St -15.5'],
  ['SammyBigBeans', 2,  'win',  23.5,  'Illinois -2.5'],
  ['SammyBigBeans', 3,  'loss', -19.5, 'USF +17.5'],
  ['SammyBigBeans', 4,  'win',  11.5,  'Miami -7.5'],
  ['SammyBigBeans', 5,  'win',  9.5,   'OSU -8.5'],
  ['SammyBigBeans', 6,  'loss', -6.5,  'Iowa St +1.5'],
  ['SammyBigBeans', 7,  'loss', -14.5, 'OK +2.5'],
  ['SammyBigBeans', 8,  'win',  12.5,  'GT +3.5'],
  ['SammyBigBeans', 9,  'win',  16.5,  'BYU +2.5'],
  ['SammyBigBeans', 10, 'win',  26.5,  'ECU -4.5'],
  ['SammyBigBeans', 11, 'loss', -13.5, 'VA -6.5'],
  ['SammyBigBeans', 12, 'loss', -0.5,  'Memphis +3.5'],
  ['SammyBigBeans', 13, 'win',  16.5,  'Tulane -7.5'],
  ['SammyBigBeans', 14, 'loss', -16.5, 'SC -2.5'],

  // glenngrasha (Glenn Grasha)
  ['glenngrasha', 1,  'loss', -28,   'Bama -14'],
  ['glenngrasha', 2,  'loss', -5.5,  'SMU -2.5'],
  ['glenngrasha', 3,  'win',  10.5,  'Illinois -27.5'],
  ['glenngrasha', 4,  'win',  17.5,  'UCF -7.5'],
  ['glenngrasha', 5,  'loss', -8.5,  'UCF +5.5'],
  ['glenngrasha', 6,  'win',  23.5,  'NWestern -11.5'],
  ['glenngrasha', 7,  'win',  17.5,  'Clem -13.5'],
  ['glenngrasha', 8,  'loss', -4.5,  'A&M -7.5'],
  ['glenngrasha', 9,  'loss', -17.5, 'Oregon -31.5'],
  ['glenngrasha', 10, 'win',  1,     'Pitt -14'],
  ['glenngrasha', 11, 'win',  0.5,   'Vandy -6.5'],
  ['glenngrasha', 12, 'loss', -9.5,  'Michigan -11.5'],
  ['glenngrasha', 14, 'win',  39.5,  'Lville -1.5'],

  // jungerman (unregistered)
  ['jungerman', 1,  'loss', -1.5,  'UK -9.5'],
  ['jungerman', 2,  'win',  5.5,   'Mizzou -5.5'],
  ['jungerman', 3,  'loss', -1.5,  'OSU -29.5'],
  ['jungerman', 5,  'win',  3.5,   'Lville -3.5'],
  ['jungerman', 11, 'loss', -4.5,  'Oregon -6.5'],
  ['jungerman', 12, 'loss', -11.5, 'Cincy -5.5'],
  ['jungerman', 14, 'win',  5.5,   'Oregon -6.5'],
];

const insert = db.prepare(`
  INSERT INTO historical_picks (season, week_number, display_name, user_id, result, spread_value, picked_team, canonical_team)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (season, week_number, display_name) DO UPDATE SET
    result = excluded.result,
    spread_value = excluded.spread_value,
    user_id = excluded.user_id,
    picked_team = excluded.picked_team,
    canonical_team = excluded.canonical_team
`);

// Pre-resolve user IDs by looking up display_name directly as a username
const userIdCache = {};
const unknownAbbrevs = new Set();
const allNames = [...new Set(DATA.map(([name]) => name))];
for (const name of allNames) {
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
  userIdCache[name] = row?.id ?? null;
}

let inserted = 0;
for (const [displayName, week, result, spreadValue, pickedTeam] of DATA) {
  const isTotalsPick = pickedTeam && /^(Over|Under)\s+[\d.]+$/i.test(pickedTeam);
  const canonical = pickedTeam ? canonicalize(pickedTeam) : null;
  if (pickedTeam && !canonical && !isTotalsPick) {
    const abbrev = parseAbbrev(pickedTeam);
    if (!unknownAbbrevs.has(abbrev)) {
      console.warn(`Warning: no canonical mapping for '${abbrev}' (from '${pickedTeam}')`);
      unknownAbbrevs.add(abbrev);
    }
  }
  insert.run(2025, week, displayName, userIdCache[displayName] ?? null, result, spreadValue, pickedTeam ?? null, canonical);
  inserted++;
}

console.log(`Imported ${inserted} historical picks for 2025.`);

// ── Phase 2: Seed 2025 games from ESPN and link picks ─────────────────────────

const gamesTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='games'`).get();

if (!gamesTableExists) {
  console.log('Games table not found — skipping game linking. Run against prod DB to link game IDs.');
  process.exit(0);
}

// Clear any previously script-seeded 2025 games so week numbers are recomputed cleanly.
// (Safe: live picks table only has current-season picks, not 2025 historical ones.)
db.prepare('UPDATE historical_picks SET game_id = NULL WHERE season = 2025').run();
db.prepare(`DELETE FROM games WHERE season = 2025 AND id NOT IN (
  SELECT DISTINCT game_id FROM picks WHERE game_id IS NOT NULL
)`).run();

const seedGame = db.prepare(`
  INSERT INTO games (espn_id, home_team, away_team, home_abbr, away_abbr, commence_time, week_number, season, status, home_score, away_score)
  VALUES (?, ?, ?, ?, ?, ?, ?, 2025, ?, ?, ?)
  ON CONFLICT (espn_id) DO UPDATE SET
    week_number = excluded.week_number,
    status      = excluded.status,
    home_score  = excluded.home_score,
    away_score  = excluded.away_score
  RETURNING id, espn_id
`);

const seasonStart = new Date('2025-08-25T00:00:00Z');

// Fetch ESPN weeks 1-15, collect all eligible games, then assign our own
// week numbers based on which Saturday each game falls on.
// This avoids any reliance on ESPN's week numbering (which has a week-0 offset).

function getWeekSaturday(commenceTime) {
  // Shift to Eastern Daylight Time (UTC-4) before computing day-of-week.
  // Football season runs Sep–Nov which is all EDT.
  const et = new Date(new Date(commenceTime).getTime() - 4 * 60 * 60 * 1000);
  const day = et.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  // Sunday/Monday games belong to the *previous* Saturday's week
  // (e.g. Aug 31 Sunday games = same college-football week as Aug 30 Saturday)
  const daysOffset = day === 0 ? -1 : day === 1 ? -2 : (6 - day);
  const sat = new Date(et);
  sat.setUTCDate(et.getUTCDate() + daysOffset);
  return sat.toISOString().slice(0, 10); // YYYY-MM-DD
}

console.log('Fetching ESPN weeks 1-15 for 2025...');
const allEvents = [];
for (let espnWeek = 1; espnWeek <= 15; espnWeek++) {
  try {
    const events = await fetchEspnWeek(2025, espnWeek);
    allEvents.push(...events.filter(e => new Date(e.commenceTime) >= seasonStart));
  } catch (err) {
    console.warn(`  ESPN week ${espnWeek} failed: ${err.message}`);
  }
}

// Build Saturday → week_number map (sorted chronologically)
const saturdays = [...new Set(allEvents.map(e => getWeekSaturday(e.commenceTime)))].sort();
const saturdayToWeek = Object.fromEntries(saturdays.map((sat, i) => [sat, i + 1]));
console.log(`Found ${saturdays.length} game weeks across ${allEvents.length} eligible games`);

let gamesSeeded = 0;
for (const e of allEvents) {
  const week = saturdayToWeek[getWeekSaturday(e.commenceTime)];
  const rows = seedGame.all(
    e.espnId, e.homeTeam, e.awayTeam, e.homeAbbr, e.awayAbbr,
    e.commenceTime, week, e.status, e.homeScore, e.awayScore
  );
  if (rows.length > 0) gamesSeeded++;
}
console.log(`Seeded ${gamesSeeded} new games (${allEvents.length} total eligible).`);

// ── Manual game inserts (FCS teams not in ESPN FBS feed) ─────────────────────
const MANUAL_GAMES = [
  // Sundy W2: Lehigh -20 vs Sacred Heart (Lehigh won 28-10)
  { espnId: '401767658', homeTeam: 'Lehigh Mountain Hawks', awayTeam: 'Sacred Heart Pioneers',
    homeAbbr: 'LEH', awayAbbr: 'SHU', commenceTime: '2025-09-06T16:00Z',
    weekNumber: 2, status: 'complete', homeScore: 28, awayScore: 10 },
  // Sundy W4: Lehigh -11.5 at Bucknell (Lehigh won 41-24)
  { espnId: '401767664', homeTeam: 'Bucknell Bison', awayTeam: 'Lehigh Mountain Hawks',
    homeAbbr: 'BUCK', awayAbbr: 'LEH', commenceTime: '2025-09-20T22:00Z',
    weekNumber: 4, status: 'complete', homeScore: 24, awayScore: 41 },
  // Kevin W13: Harvard -7 at Yale (Harvard lost 0-10)
  { espnId: '401767708', homeTeam: 'Yale Bulldogs', awayTeam: 'Harvard Crimson',
    homeAbbr: 'YALE', awayAbbr: 'HAR', commenceTime: '2025-11-22T22:03Z',
    weekNumber: 13, status: 'complete', homeScore: 45, awayScore: 28 },
];

const seedManual = db.prepare(`
  INSERT INTO games (espn_id, home_team, away_team, home_abbr, away_abbr, commence_time, week_number, season, status, home_score, away_score)
  VALUES (?, ?, ?, ?, ?, ?, ?, 2025, ?, ?, ?)
  ON CONFLICT (espn_id) DO UPDATE SET
    week_number = excluded.week_number,
    status      = excluded.status,
    home_score  = excluded.home_score,
    away_score  = excluded.away_score
  RETURNING id, espn_id
`);

for (const g of MANUAL_GAMES) {
  seedManual.all(g.espnId, g.homeTeam, g.awayTeam, g.homeAbbr, g.awayAbbr,
    g.commenceTime, g.weekNumber, g.status, g.homeScore, g.awayScore);
}
console.log(`Inserted ${MANUAL_GAMES.length} manual FCS games.`);

// Link historical picks to their game via canonical_team match
const picks = db.prepare(
  `SELECT id, week_number, canonical_team FROM historical_picks WHERE season = 2025 AND canonical_team IS NOT NULL`
).all();

const updatePickGame = db.prepare(`UPDATE historical_picks SET game_id = ? WHERE id = ?`);

let linked = 0;
let unlinked = [];
for (const pick of picks) {
  const games = db.prepare(
    `SELECT id, home_team, away_team FROM games WHERE week_number = ? AND season = 2025`
  ).all(pick.week_number);

  const match = games.find(g =>
    teamsMatch(g.home_team, pick.canonical_team) || teamsMatch(g.away_team, pick.canonical_team)
  );

  if (match) {
    updatePickGame.run(match.id, pick.id);
    linked++;
  } else {
    unlinked.push(`  W${pick.week_number} ${pick.canonical_team}`);
  }
}

console.log(`Linked ${linked}/${picks.length} picks to games.`);
if (unlinked.length) {
  console.log('Unlinked picks (no game match found):');
  unlinked.forEach(u => console.log(u));
}

// ── Totals picks: link by team names (no canonical_team to match on) ─────────
const TOTALS_GAME_LINKS = [
  // Tanner W10: Under 55.5 — Ole Miss vs South Carolina (combined 44, Under hit)
  { displayName: 'Tanner', weekNumber: 10, teams: ['Ole Miss', 'South Carolina'] },
  // Tanner W11: Under 42.5 — North Carolina vs Stanford (combined 35, Under hit)
  { displayName: 'Tanner', weekNumber: 11, teams: ['North Carolina', 'Stanford'] },
  // Tanner W12: Over 51 — BYU vs TCU (combined 57, Over hit)
  { displayName: 'Tanner', weekNumber: 12, teams: ['BYU', 'TCU'] },
  // Tanner W13: Over 58.5 — Texas vs Arkansas (combined 89, Over hit)
  { displayName: 'Tanner', weekNumber: 13, teams: ['Texas', 'Arkansas'] },
];

const getPickId = db.prepare('SELECT id FROM historical_picks WHERE season=2025 AND week_number=? AND display_name=?');
for (const link of TOTALS_GAME_LINKS) {
  const game = db.prepare(
    `SELECT id FROM games WHERE season=2025 AND week_number=? AND (
      (home_team LIKE ? AND away_team LIKE ?) OR
      (home_team LIKE ? AND away_team LIKE ?)
    )`
  ).get(link.weekNumber,
    `%${link.teams[0]}%`, `%${link.teams[1]}%`,
    `%${link.teams[1]}%`, `%${link.teams[0]}%`
  );
  const pick = getPickId.get(link.weekNumber, link.displayName);
  if (game && pick) {
    updatePickGame.run(game.id, pick.id);
    console.log(`Linked totals pick: ${link.displayName} W${link.weekNumber} → game ${game.id}`);
  } else {
    console.warn(`Could not link totals pick: ${link.displayName} W${link.weekNumber}`);
  }
}
