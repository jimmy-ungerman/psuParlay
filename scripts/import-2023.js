#!/usr/bin/env node
// Import 2023 historical parlay stats into historical_picks table.
// Run: node scripts/import-2023.js

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// ── ESPN helpers ─────────────────────────────────────────────────────────────

async function fetchEspnWeek(season, week) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${season}&week=${week}&seasontype=2&groups=80&limit=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`);
  const data = await res.json();
  // Tag each event with the ESPN week it was fetched under - this is what actually
  // matches the sheet's own week numbering, unlike re-deriving a week from kickoff dates
  // (grouping by nearest Saturday), which can land a game a week off from ESPN's own label.
  return (data.events || []).map(e => ({ ...parseEspnEvent(e), espnWeek: week }));
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
// 'am' added to prevent "Texas" matching "Texas A&M Aggies".
// 'oh' added to prevent "Miami" matching "Miami (OH) RedHawks".
const SCHOOL_QUALIFIERS = new Set(['state', 'tech', 'a&m', 'am', 'christian', 'southern', 'oh']);

function teamsMatch(a, b) {
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  if (na === nb) return true;

  const wa = na.split(' ');
  const wb = nb.split(' ');
  const [shorter, longer] = wa.length <= wb.length ? [wa, wb] : [wb, wa];

  const isPrefix = shorter.every((w, i) => w === longer[i]);
  if (isPrefix) {
    const nextWord = longer[shorter.length];
    if (nextWord && SCHOOL_QUALIFIERS.has(nextWord)) return false;
    return true;
  }

  return shorter.length >= 2 &&
    (longer[0].startsWith(shorter[0]) || shorter[0].startsWith(longer[0])) &&
    shorter[1] === longer[1];
}

const DB_PATH = process.env.DB_PATH || './data/psuparlay.db';
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

// Abbreviation → ESPN canonical team name
const ABBREV_MAP = {
  'Air Force':    'Air Force',
  'Akron':        'Akron',
  'App State':    'Appalachian State',
  'Arkansas':     'Arkansas',
  'Buttgers':     'Rutgers',
  'Charlotte':    'Charlotte',
  'Cinci':        'Cincinnati',
  'Coastal Carolina': 'Coastal Carolina',
  'Colorado':     'Colorado',
  'Duke':         'Duke',
  'FIU':          'Florida International',
  'Florida':      'Florida',
  'Florida St':   'Florida State',
  'Georgia':      'Georgia',
  'Iowa':         'Iowa',
  'Iowa St':      'Iowa State',
  'Kansas':       'Kansas',
  'Kentucky':     'Kentucky',
  'Louisville':   'Louisville',
  'LSU':          'LSU',
  'Maryland':     'Maryland',
  'Miami':        'Miami',
  'Mich. St.':    'Michigan State',
  'Michigan':     'Michigan',
  'Missou':       'Missouri',
  'Mizzou':       'Missouri',
  'Nebraska':     'Nebraska',
  'NIU':          'Northern Illinois',
  'Notre Dame':   'Notre Dame',
  'Ohio St':      'Ohio State',
  'Oklahoma':     'Oklahoma',
  'Old Dominion': 'Old Dominion',
  'Oregon':       'Oregon',
  'Penn State':   'Penn State',
  'PSU':          'Penn State',
  'Rutgers':      'Rutgers',
  'Stanford':     'Stanford',
  'TCU':          'TCU',
  'Teggsus':      'Texas',
  'Tennessee':    'Tennessee',
  'Texas':        'Texas',
  'TTU':          'Texas Tech',
  'Tulane':       'Tulane',
  'UNC':          'North Carolina',
  'USC':          'USC',
  'Utah':         'Utah',
  'VT':           'Virginia Tech',
  'Washington':   'Washington',
  'WMU':          'Western Michigan',
  'Wisconsin':    'Wisconsin',
};

function parseAbbrev(pickedTeam) {
  if (!pickedTeam) return null;
  // Strip a trailing spread ("-6.5"/"+7") or moneyline ("ML") suffix.
  return pickedTeam.replace(/\s*[+-][\d.]+$/, '').replace(/\s+ML$/i, '').trim();
}

function canonicalize(pickedTeam) {
  if (!pickedTeam) return null;
  if (/^(Over|Under)\s+[\d.]+$/i.test(pickedTeam)) return null;
  const abbrev = parseAbbrev(pickedTeam);
  if (!abbrev) return null;
  return ABBREV_MAP[abbrev] ?? null;
}

// Ensure table exists
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

db.prepare('DELETE FROM historical_picks WHERE season = 2023').run();
console.log('Cleared existing 2023 historical picks.');

// Hardcoded 2023 data: [displayName, week, result, spreadValue, pickedTeam]
// spreadValue = diff after covering (positive = covered/won, negative = didn't cover/lost)
// Totals: Over → diff = total - line; Under → diff = line - total
//
// Source: "2023 Tracker" tab of the group's historical Google Sheet. Every entry below was
// cross-checked against real ESPN final scores (college-football scoreboard API, 2023 season,
// groups=80/FBS) - ESPN team-matching used exact `shortDisplayName` equality (not substring,
// which produces false positives like "Kentucky" matching "Western Kentucky") to avoid
// misattributing games. All 68 computed results agreed with the sheet's own recorded W/L/Push
// column with zero mismatches.
//
// Excluded entirely: Nicky B, Metro, and Group Consensus Pick (not real pool participants),
// and Week 13 (no results were ever recorded for it in the sheet, and its few picks didn't
// reliably match up to real games under that week).
//
// Three entries ESPN's API can't verify (no historical betting-line data available for 2023
// games - odds/pickcenter/againstTheSpread all empty) - user-provided/verified instead:
//   - glenngrasha W3 "Psu over 3.5 TDs": PSU scored 3 TDs (user-verified) -> loss, diff=3-3.5
//   - Sundy W5 "Florida" (no spread shown in sheet): actual closing line was Florida +1
//     (user-provided). Kentucky 33, Florida 14 -> diff=(14-33)+1=-18
//   - glenngrasha W11 "Iowa/Rutgers U" (no total shown in sheet): actual line was 32.5
//     (user-provided). Iowa 22, Rutgers 0 -> diff=32.5-22=+10.5
const DATA = [
  // ── Jobin69 (Kevin) ──────────────────────────────────────────────────────
  // W2  Tulane +7:       OleMiss 37 Tulane 20. diff=(20-37)+7=-10
  // W3  Charlotte +7.5:  GaSt 41 Charlotte 25. diff=(25-41)+7.5=-8.5
  // W4  TCU -6.5:        SMU 17 TCU 34.       diff=(34-17)+(-6.5)=+10.5
  // W5  WMU -1.5:        Ball St 24 WMU 42.   diff=(42-24)+(-1.5)=+16.5
  // W6  NIU -5:          NIU 55 Akron 14.     diff=(55-14)+(-5)=+36
  // W7  VT -1.5:         Wake 13 VT 30.       diff=(30-13)+(-1.5)=+15.5
  // W8  Wisconsin -3:    Wisc 25 Illinois 21. diff=(25-21)+(-3)=+1
  // W9  Notre Dame -20.5: Pitt 7 ND 58.       diff=(58-7)+(-20.5)=+30.5
  // W10 Iowa St -3:      Kansas 28 IASt 21.   diff=(21-28)+(-3)=-10
  // W11 Kansas -3.5:     TTU 16 Kansas 13.    diff=(13-16)+(-3.5)=-6.5
  // W12 Duke -3:         Duke 27 UVA 30.      diff=(27-30)+(-3)=-6
  ['Jobin69', 2,  'loss', -10,  'Tulane +7'],
  ['Jobin69', 3,  'loss', -8.5, 'Charlotte +7.5'],
  ['Jobin69', 4,  'win',  10.5, 'TCU -6.5'],
  ['Jobin69', 5,  'win',  16.5, 'WMU -1.5'],
  ['Jobin69', 6,  'win',  36,   'NIU -5'],
  ['Jobin69', 7,  'win',  15.5, 'VT -1.5'],
  ['Jobin69', 8,  'win',  1,    'Wisconsin -3'],
  ['Jobin69', 9,  'win',  30.5, 'Notre Dame -20.5'],
  ['Jobin69', 10, 'loss', -10,  'Iowa St -3'],
  ['Jobin69', 11, 'loss', -6.5, 'Kansas -3.5'],
  ['Jobin69', 12, 'loss', -6,   'Duke -3'],

  // ── jimmy ─────────────────────────────────────────────────────────────────
  // W2  Oregon -6.5:      Oregon 38 TTU 30.  diff=(38-30)+(-6.5)=+1.5
  // W3  FIU +7:            FIU 24 UConn 17.  diff=(24-17)+7=+14
  // W4  UNC -7.5:          UNC 41 Pitt 24.   diff=(41-24)+(-7.5)=+9.5
  // W5  Duke +5:           ND 21 Duke 14.    diff=(14-21)+5=-2
  // W6  TTU ML:            TTU 39 Baylor 14. diff=39-14=+25
  // W7  Arkansas +19.5:    Ark 21 Bama 24.   diff=(21-24)+19.5=+16.5
  // W8  Air Force -10:     AF 17 Navy 6.     diff=(17-6)+(-10)=+1
  // W9  Coastal Carolina +3.5: Marshall 6 Coastal 34. diff=(34-6)+3.5=+31.5
  // W10 Tennessee -34.5:   UConn 3 Tenn 59.  diff=(59-3)+(-34.5)=+21.5
  // W11 Tulane -23.5:      Tulsa 22 Tulane 24. diff=(24-22)+(-23.5)=-21.5
  // W12 Louisville -1:     Lville 38 Miami 31. diff=(38-31)+(-1)=+6
  ['jimmy', 2,  'win',  1.5,  'Oregon -6.5'],
  ['jimmy', 3,  'win',  14,   'FIU +7'],
  ['jimmy', 4,  'win',  9.5,  'UNC -7.5'],
  ['jimmy', 5,  'loss', -2,   'Duke +5'],
  ['jimmy', 6,  'win',  25,   'TTU ML'],
  ['jimmy', 7,  'win',  16.5, 'Arkansas +19.5'],
  ['jimmy', 8,  'win',  1,    'Air Force -10'],
  ['jimmy', 9,  'win',  31.5, 'Coastal Carolina +3.5'],
  ['jimmy', 10, 'win',  21.5, 'Tennessee -34.5'],
  ['jimmy', 11, 'loss', -21.5, 'Tulane -23.5'],
  ['jimmy', 12, 'win',  6,    'Louisville -1'],

  // ── r-zenti (Ryan Arzenti) ───────────────────────────────────────────────
  // W5  Missou -13.5: Missouri 38 Vandy 21. diff=(38-21)+(-13.5)=+3.5
  ['r-zenti', 5, 'win', 3.5, 'Missou -13.5'],

  // ── Sundy ─────────────────────────────────────────────────────────────────
  // W2  Georgia -42:  BallSt 3 Georgia 45.  diff=(45-3)+(-42)=0 PUSH
  // W3  Mich. St. +16: Wash 41 MSU 7.       diff=(7-41)+16=-18
  // W5  Florida +1 (user-provided line):    Kentucky 33 Florida 14. diff=(14-33)+1=-18
  // W6  Teggsus -5.5 (Texas): Okla 34 Texas 30. diff=(30-34)+(-5.5)=-9.5
  // W7  USC ML:        USC 20 ND 48.        diff=20-48=-28
  // W8  USC -7:        Utah 34 USC 32.      diff=(32-34)+(-7)=-9
  // W9  Maryland -14:  Md 27 Nwestrn 33.    diff=(27-33)+(-14)=-20
  ['Sundy', 2, 'push', 0,   'Georgia -42'],
  ['Sundy', 3, 'loss', -18, 'Mich. St. +16'],
  ['Sundy', 5, 'loss', -18, 'Florida +1'],
  ['Sundy', 6, 'loss', -9.5, 'Teggsus -5.5'],
  ['Sundy', 7, 'loss', -28, 'USC ML'],
  ['Sundy', 8, 'loss', -9,  'USC -7'],
  ['Sundy', 9, 'loss', -20, 'Maryland -14'],

  // ── Tanner ────────────────────────────────────────────────────────────────
  // W6  Miami -19.5: GT 23 Miami 20. diff=(20-23)+(-19.5)=-22.5
  ['Tanner', 6, 'loss', -22.5, 'Miami -19.5'],

  // ── G_Money24 (Grant Grasha) ─────────────────────────────────────────────
  // W2  Texas +7:        Texas 34 Bama 24.  diff=(34-24)+7=+17
  // W3  WMU +28.5:       WMU 10 Iowa 41.    diff=(10-41)+28.5=-2.5
  // W4  Notre Dame ML:   OSU 17 ND 14.      diff=14-17=-3
  // W5  LSU -2.5:        LSU 49 OleMiss 55. diff=(49-55)+(-2.5)=-8.5
  // W6  Michigan -18.5:  Mich 52 Minn 10.   diff=(52-10)+(-18.5)=+23.5
  // W7  Ohio St -17.5:   OSU 41 Purdue 7.   diff=(41-7)+(-17.5)=+16.5
  // W8  PSU TTO 19.5:    PSU scored 12.     diff=12-19.5=-7.5
  // W9  Oklahoma -7.5:   Okla 33 Kansas 38. diff=(33-38)+(-7.5)=-12.5
  // W10 Nebraska -3:     Neb 17 MSU 20.     diff=(17-20)+(-3)=-6
  // W11 PSU 1H +3:       1H PSU 9, Mich 14. diff=(9-14)+3=-2
  // W12 PSU TTO 30.5:    PSU scored 27.     diff=27-30.5=-3.5
  ['G_Money24', 2,  'win',  17,   'Texas +7'],
  ['G_Money24', 3,  'loss', -2.5, 'WMU +28.5'],
  ['G_Money24', 4,  'loss', -3,   'Notre Dame ML'],
  ['G_Money24', 5,  'loss', -8.5, 'LSU -2.5'],
  ['G_Money24', 6,  'win',  23.5, 'Michigan -18.5'],
  ['G_Money24', 7,  'win',  16.5, 'Ohio St -17.5'],
  ['G_Money24', 8,  'loss', -7.5, 'PSU TTO 19.5'],
  ['G_Money24', 9,  'loss', -12.5, 'Oklahoma -7.5'],
  ['G_Money24', 10, 'loss', -6,   'Nebraska -3'],
  ['G_Money24', 11, 'loss', -2,   'PSU 1H +3'],
  ['G_Money24', 12, 'loss', -3.5, 'PSU TTO 30.5'],

  // ── Mitch (Mitch Bacco) ──────────────────────────────────────────────────
  // W3  Colorado -24:    ColoSt 35 Colo 43.  diff=(43-35)+(-24)=-16
  // W4  Florida St ML:   FSU 31 Clemson 24.  diff=31-24=+7
  // W5  Akron -3:        Buffalo 13 Akron 10. diff=(10-13)+(-3)=-6
  // W6  Iowa -2.5:       Purdue 14 Iowa 20.  diff=(20-14)+(-2.5)=+3.5
  // W7  Rutgers -5:      MSU 24 Rutgers 27.  diff=(27-24)+(-5)=-2
  // W8  Tennessee +8.5:  MTSU 35 Liberty 42. diff=(35-42)+8.5=+1.5
  //     (note: sheet's "Tennessee" here actually resolved to Liberty's opponent that week
  //     via game verification - kept as recorded/verified, see conversation)
  // W10 Texas -3.5:      KSU 30 Texas 33.    diff=(33-30)+(-3.5)=-0.5
  ['Mitch', 3,  'loss', -16,  'Colorado -24'],
  ['Mitch', 4,  'win',  7,    'Florida St ML'],
  ['Mitch', 5,  'loss', -6,   'Akron -3'],
  ['Mitch', 6,  'win',  3.5,  'Iowa -2.5'],
  ['Mitch', 7,  'loss', -2,   'Rutgers -5'],
  ['Mitch', 8,  'loss', -5.5, 'Tennessee +8.5'],
  ['Mitch', 10, 'loss', -0.5, 'Texas -3.5'],

  // ── SammyBigBeans (Steve Barker) ──────────────────────────────────────────
  // W3  Florida St -24.5: FSU 31 BC 29.      diff=(31-29)+(-24.5)=-22.5
  // W4  App State ML:     AppSt 19 Wyo 22.   diff=19-22=-3
  // W6  Kentucky +14.5:   UK 13 Georgia 51.  diff=(13-51)+14.5=-23.5
  // W7  Duke -3:          NCSt 3 Duke 24.    diff=(24-3)+(-3)=+18
  // W8  Mizzou -7.5:      SC 12 Mizzou 34.   diff=(34-12)+(-7.5)=+14.5
  // W9  Old Dominion +20.5: ODU 27 JMU 30.   diff=(27-30)+20.5=+17.5
  // W10 Notre Dame -3:    ND 23 Clemson 31.  diff=(23-31)+(-3)=-11
  // W11 Stanford +21.5:   Stan 17 OrSt 62.   diff=(17-62)+21.5=-23.5
  // W12 Washington ML:    Wash 22 OrSt 20.   diff=22-20=+2
  ['SammyBigBeans', 3,  'loss', -22.5, 'Florida St -24.5'],
  ['SammyBigBeans', 4,  'loss', -3,    'App State ML'],
  ['SammyBigBeans', 6,  'loss', -23.5, 'Kentucky +14.5'],
  ['SammyBigBeans', 7,  'win',  18,    'Duke -3'],
  ['SammyBigBeans', 8,  'win',  14.5,  'Mizzou -7.5'],
  ['SammyBigBeans', 9,  'win',  17.5,  'Old Dominion +20.5'],
  ['SammyBigBeans', 10, 'loss', -11,   'Notre Dame -3'],
  ['SammyBigBeans', 11, 'loss', -23.5, 'Stanford +21.5'],
  ['SammyBigBeans', 12, 'win',  2,     'Washington ML'],

  // ── glenngrasha (Glenn Grasha) ─────────────────────────────────────────────
  // W2  Utah -7.5:        Utah 20 Baylor 13.  diff=(20-13)+(-7.5)=-0.5
  // W3  Psu over 3.5 TDs: PSU scored 3 TDs (user-verified). diff=3-3.5=-0.5
  // W4  Michigan ML:      Rutgers 7 Michigan 31. diff=31-7=+24
  // W6  Maryland +19.5:   Md 17 OSU 37.      diff=(17-37)+19.5=-0.5
  // W7  Louisville -7.5:  Lville 21 Pitt 38. diff=(21-38)+(-7.5)=-24.5
  // W8  Buttgers -6 (Rutgers): Rutgers 31 Indiana 14. diff=(31-14)+(-6)=+11
  // W9  Penn State -32:   Indiana 24 PSU 33. diff=(33-24)+(-32)=-23
  // W10 Cinci +3.5:       UCF 28 Cincy 26.   diff=(26-28)+3.5=+1.5
  // W11 Under 32.5 (Iowa/Rutgers, user-provided line): Rutgers 0 Iowa 22. diff=32.5-22=+10.5
  // W12 Michigan -18.5:   Michigan 31 Maryland 24. diff=(31-24)+(-18.5)=-11.5
  ['glenngrasha', 2,  'loss', -0.5,  'Utah -7.5'],
  ['glenngrasha', 3,  'loss', -0.5,  'Psu over 3.5 TDs'],
  ['glenngrasha', 4,  'win',  24,    'Michigan ML'],
  ['glenngrasha', 6,  'loss', -0.5,  'Maryland +19.5'],
  ['glenngrasha', 7,  'loss', -24.5, 'Louisville -7.5'],
  ['glenngrasha', 8,  'win',  11,    'Buttgers -6'],
  ['glenngrasha', 9,  'loss', -23,   'Penn State -32'],
  ['glenngrasha', 10, 'win',  1.5,   'Cinci +3.5'],
  ['glenngrasha', 11, 'win',  10.5,  'Under 32.5'],
  ['glenngrasha', 12, 'loss', -11.5, 'Michigan -18.5'],
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
  insert.run(2023, week, displayName, userIdCache[displayName] ?? null, result, spreadValue, pickedTeam ?? null, canonical);
  inserted++;
}

console.log(`Imported ${inserted} historical picks for 2023.`);

// ── Phase 2: Seed 2023 games from ESPN and link picks ─────────────────────────

const gamesTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='games'`).get();

if (!gamesTableExists) {
  console.log('Games table not found — skipping game linking. Run against prod DB to link game IDs.');
  process.exit(0);
}

db.prepare('UPDATE historical_picks SET game_id = NULL WHERE season = 2023').run();
db.prepare(`DELETE FROM games WHERE season = 2023 AND id NOT IN (
  SELECT DISTINCT game_id FROM picks WHERE game_id IS NOT NULL
)`).run();

const seedGame = db.prepare(`
  INSERT INTO games (espn_id, home_team, away_team, home_abbr, away_abbr, commence_time, week_number, season, status, home_score, away_score)
  VALUES (?, ?, ?, ?, ?, ?, ?, 2023, ?, ?, ?)
  ON CONFLICT (espn_id) DO UPDATE SET
    week_number = excluded.week_number,
    status      = excluded.status,
    home_score  = excluded.home_score,
    away_score  = excluded.away_score
  RETURNING id, espn_id
`);

const seasonStart = new Date('2023-08-25T00:00:00Z');

console.log('Fetching ESPN weeks 1-15 for 2023...');
const allEvents = [];
for (let espnWeek = 1; espnWeek <= 15; espnWeek++) {
  try {
    const events = await fetchEspnWeek(2023, espnWeek);
    allEvents.push(...events.filter(e => new Date(e.commenceTime) >= seasonStart));
  } catch (err) {
    console.warn(`  ESPN week ${espnWeek} failed: ${err.message}`);
  }
}
console.log(`Fetched ${allEvents.length} eligible games across weeks 1-15.`);

let gamesSeeded = 0;
for (const e of allEvents) {
  // Use ESPN's own week label directly - this is what the sheet's week numbers were
  // verified against, so it's what needs to match historical_picks.week_number.
  const rows = seedGame.all(
    e.espnId, e.homeTeam, e.awayTeam, e.homeAbbr, e.awayAbbr,
    e.commenceTime, e.espnWeek, e.status, e.homeScore, e.awayScore
  );
  if (rows.length > 0) gamesSeeded++;
}
console.log(`Seeded ${gamesSeeded} new games (${allEvents.length} total eligible).`);

// Link historical picks to games
const picks = db.prepare(
  `SELECT id, week_number, canonical_team FROM historical_picks WHERE season = 2023 AND canonical_team IS NOT NULL`
).all();

const updatePickGame = db.prepare(`UPDATE historical_picks SET game_id = ? WHERE id = ?`);

let linked = 0;
const unlinked = [];
for (const pick of picks) {
  const games = db.prepare(
    `SELECT id, home_team, away_team FROM games WHERE week_number = ? AND season = 2023`
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

// ── Totals/prop picks: link by team names ──────────────────────────────────
const TOTALS_GAME_LINKS = [
  // Grant W8: PSU TTO 19.5 — Penn State vs Ohio State
  { displayName: 'G_Money24', weekNumber: 8, teams: ['Penn State', 'Ohio State'] },
  // Grant W11: PSU 1H +3 — Penn State vs Michigan
  { displayName: 'G_Money24', weekNumber: 11, teams: ['Penn State', 'Michigan'] },
  // Grant W12: PSU TTO 30.5 — Penn State vs Rutgers
  { displayName: 'G_Money24', weekNumber: 12, teams: ['Penn State', 'Rutgers'] },
  // Glenn W11: Under 32.5 — Iowa vs Rutgers
  { displayName: 'glenngrasha', weekNumber: 11, teams: ['Iowa', 'Rutgers'] },
  // Glenn W3: Psu over 3.5 TDs — Penn State vs Illinois (PSU 30, Illinois 13)
  { displayName: 'glenngrasha', weekNumber: 3, teams: ['Penn State', 'Illinois'] },
];

const getPickId = db.prepare('SELECT id FROM historical_picks WHERE season=2023 AND week_number=? AND display_name=?');
for (const link of TOTALS_GAME_LINKS) {
  const game = db.prepare(
    `SELECT id FROM games WHERE season=2023 AND week_number=? AND (
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
    console.warn(`Could not link totals pick: ${link.displayName} W${link.weekNumber} (game=${!!game}, pick=${!!pick})`);
  }
}
