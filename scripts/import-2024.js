#!/usr/bin/env node
// Import 2024 historical parlay stats into historical_picks table.
// Run: node scripts/import-2024.js

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

// ── ESPN helpers ─────────────────────────────────────────────────────────────

async function fetchEspnWeek(season, week) {
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
  'A&M':          'Texas A&M',
  'AF':           'Air Force',
  'App St':       'Appalachian State',
  'Army':         'Army',
  'ASU':          'Arizona State',
  'AZ':           'Arizona',
  'BGSU':         'Bowling Green',
  'Baylor':       'Baylor',
  'BC':           'Boston College',
  'Boise St':     'Boise State',
  'BYU':          'BYU',
  'Cal':          'California',
  'Clemson':      'Clemson',
  'CO':           'Colorado',
  'Cocks':        'South Carolina',
  'Colorado':     'Colorado',
  'CU':           'Colorado',
  'Duke':         'Duke',
  'EMU':          'Eastern Michigan',
  'Florida':      'Florida',
  'Georgia':      'Georgia',
  'GT':           'Georgia Tech',
  'IllSt':        'Illinois State',
  'Illini':       'Illinois',
  'Illinois':     'Illinois',
  'Indiana':      'Indiana',
  'Iowa':         'Iowa',
  'Iowa St':      'Iowa State',
  'IU':           'Indiana',
  'JMU':          'James Madison',
  'K State':      'Kansas State',
  'K state':      'Kansas State',
  'Kansas':       'Kansas',
  'Kent':         'Kent State',
  'Lib':          'Liberty',
  'Louisville':   'Louisville',
  'LSU':          'LSU',
  'Marshall':     'Marshall',
  'Maryland':     'Maryland',
  'Memphis':      'Memphis',
  'Miami':        'Miami',
  'Miami (FL)':   'Miami',
  'Miami (OH)':   'Miami (OH)',
  'Michigan':     'Michigan',
  'Minn':         'Minnesota',
  'Minnesota':    'Minnesota',
  'Missou':       'Missouri',
  'Mizz':         'Missouri',
  'Mizzou':       'Missouri',
  'MSU':          'Michigan State',
  'Navy':         'Navy',
  'Neb':          'Nebraska',
  'OkSt':         'Oklahoma State',
  'Oklahoma':     'Oklahoma',
  'Ole Miss':     'Ole Miss',
  'Oregon':       'Oregon',
  'Org':          'Oregon',
  'OrSt':         'Oregon State',
  'OSU':          'Ohio State',
  'PSU':          'Penn State',
  'Rut':          'Rutgers',
  'SC':           'South Carolina',
  'SDSU':         'San Diego State',
  'SJSU':         'San José State',
  'SMU':          'SMU',
  'TAMU':         'Texas A&M',
  'Tenn':         'Tennessee',
  'Texas':        'Texas',
  'Toledo':       'Toledo',
  'Troy':         'Troy',
  'Tulane':       'Tulane',
  'UCONN':        'UConn',
  'UGA':          'Georgia',
  'UK':           'Kentucky',
  'UNLV':         'UNLV',
  'USC':          'USC',
  'USF':          'South Florida',
  'Utah':         'Utah',
  'Vandy':        'Vanderbilt',
  'Virginia':     'Virginia',
  'Wash':         'Washington',
  'Washington':   'Washington',
  'WVU':          'West Virginia',
};

function parseAbbrev(pickedTeam) {
  if (!pickedTeam) return null;
  return pickedTeam.replace(/\s*[+-][\d.]+$/, '').trim();
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

db.prepare('DELETE FROM historical_picks WHERE season = 2024').run();
console.log('Cleared existing 2024 historical picks.');

// Hardcoded 2024 data: [displayName, week, result, spreadValue, pickedTeam]
// spreadValue = diff after covering (positive = covered/won, negative = didn't cover/lost)
// Totals: Over → diff = total - line; Under → diff = line - total
//
// Game results verified from ESPN API (scores accurate as of 2024 season completion).
const DATA = [
  // ── Jobin69 (Kevin) ──────────────────────────────────────────────────────
  // W1  OkSt -9:    OkSt 44 SDSU 20.  diff=(44-20)+(-9)=+15
  // W2  SJSU +3.5:  AF 7 SJSU 17.     diff=(17-7)+3.5=+13.5
  // W3  SDSU/Cal U48: Cal 31 SDSU 10. total=41 <48 Under ✓ diff=48-41=7
  // W4  Wash -11.5: Wash 24 NU 5.     diff=(24-5)+(-11.5)=+7.5
  // W5  Utah -8.5:  Utah 10 AZ 23.    diff=(10-23)+(-8.5)=-21.5
  // W6  Marshall -3: Marshall 52 AppSt 37. diff=(52-37)+(-3)=+12
  // W7  EMU +2.5:   EMU 14 MiamiOH 38. diff=(14-38)+2.5=-21.5
  // W8  SMU -16.5:  Stanf 10 SMU 40.  diff=(40-10)+(-16.5)=+13.5
  // W10 Baylor -3:  Baylor 37 TCU 34. diff=(37-34)+(-3)=0 PUSH
  // W11 SC -6:      Vandy 7 SC 28.    diff=(28-7)+(-6)=+15
  // W12 ASU +7.5:   KSt 14 ASU 24.   diff=(24-14)+7.5=+17.5
  // W13 K State -8.5: KSt 41 Cincy 15. diff=(41-15)+(-8.5)=+17.5
  // W14 USF -5.5:   Rice 35 USF 28.  diff=(28-35)+(-5.5)=-12.5
  ['Jobin69', 1,  'win',  15,    'OkSt -9'],
  ['Jobin69', 2,  'win',  13.5,  'SJSU +3.5'],
  ['Jobin69', 3,  'win',  7,     'Under 48'],
  ['Jobin69', 4,  'win',  7.5,   'Wash -11.5'],
  ['Jobin69', 5,  'loss', -21.5, 'Utah -8.5'],
  ['Jobin69', 6,  'win',  12,    'Marshall -3'],
  ['Jobin69', 7,  'loss', -21.5, 'EMU +2.5'],
  ['Jobin69', 8,  'win',  13.5,  'SMU -16.5'],
  ['Jobin69', 10, 'push', 0,     'Baylor -3'],
  ['Jobin69', 11, 'win',  15,    'SC -6'],
  ['Jobin69', 12, 'win',  17.5,  'ASU +7.5'],
  ['Jobin69', 13, 'win',  17.5,  'K State -8.5'],
  ['Jobin69', 14, 'loss', -12.5, 'USF -5.5'],

  // ── jimmy ─────────────────────────────────────────────────────────────────
  // W1  PSU -8.5:   WVU 12 PSU 34.   diff=(34-12)+(-8.5)=+13.5
  // W2  App St +17.5: Clem 66 AppSt 20. diff=(20-66)+17.5=-28.5
  // W3  OrSt +17:   Oregon 49 OrSt 14. diff=(14-49)+17=-18
  // W4  OSU -39.5:  OSU 49 Marshall 14. diff=(49-14)+(-39.5)=-4.5
  // W5  PSU -17.5:  PSU 21 Ill 7.    diff=(21-7)+(-17.5)=-3.5
  // W6  Navy/AF O36.5: AF 7 Navy 34. total=41>36.5 Over ✓ diff=41-36.5=+4.5
  // W7  AF +6.5:    NM 52 AF 37.     diff=(37-52)+6.5=-8.5
  // W8  Miami -4.5: Lou 45 Miami 52. diff=(52-45)+(-4.5)=+2.5
  // W9  MSU +4.5:   Mich 24 MSU 17.  diff=(17-24)+4.5=-2.5
  // W10 Indiana -7.5: MSU 10 IU 47.  diff=(47-10)+(-7.5)=+29.5
  // W11 Army -5.5:  NTex 3 Army 14.  diff=(14-3)+(-5.5)=+5.5
  // W12 Illinois -2: Ill 38 MSU 16.  diff=(38-16)+(-2)=+20
  // W13 Illini +2:  Rut 31 Ill 38.   diff=(38-31)+2=+9
  // W14 Michigan +20: OSU 10 Mich 13. diff=(13-10)+20=+23
  ['jimmy', 1,  'win',  13.5,  'PSU -8.5'],
  ['jimmy', 2,  'loss', -28.5, 'App St +17.5'],
  ['jimmy', 3,  'loss', -18,   'OrSt +17'],
  ['jimmy', 4,  'loss', -4.5,  'OSU -39.5'],
  ['jimmy', 5,  'loss', -3.5,  'PSU -17.5'],
  ['jimmy', 6,  'win',  4.5,   'Over 36.5'],
  ['jimmy', 7,  'loss', -8.5,  'AF +6.5'],
  ['jimmy', 8,  'win',  2.5,   'Miami -4.5'],
  ['jimmy', 9,  'loss', -2.5,  'MSU +4.5'],
  ['jimmy', 10, 'win',  29.5,  'Indiana -7.5'],
  ['jimmy', 11, 'win',  5.5,   'Army -5.5'],
  ['jimmy', 12, 'win',  20,    'Illinois -2'],
  ['jimmy', 13, 'win',  9,     'Illini +2'],
  ['jimmy', 14, 'win',  23,    'Michigan +20'],

  // ── Ryan Arzenti ──────────────────────────────────────────────────────────
  // W2  GT -3:      Syr 31 GT 28.    diff=(28-31)+(-3)=-6
  // W3  WVU -2:     Pitt 38 WVU 34.  diff=(34-38)+(-2)=-6
  // W4  Colorado -1: Colo 38 Baylor 31. diff=(38-31)+(-1)=+6
  // W5  Kansas -2:  Ill 23 Kansas 17. diff=(17-23)+(-2)=-8
  // W12 USC -7:     USC 28 Neb 20.   diff=(28-20)+(-7)=+1
  ['Ryan Arzenti', 2,  'loss', -6,  'GT -3'],
  ['Ryan Arzenti', 3,  'loss', -6,  'WVU -2'],
  ['Ryan Arzenti', 4,  'win',  6,   'Colorado -1'],
  ['Ryan Arzenti', 5,  'loss', -8,  'Kansas -2'],
  ['Ryan Arzenti', 12, 'win',  1,   'USC -7'],

  // ── Sundy ─────────────────────────────────────────────────────────────────
  // W1  UGA -13.5:  UGA 34 Clem 3.   diff=(34-3)+(-13.5)=+17.5
  // W2  Iowa -3:    Iowa 40 IllSt 0.  diff=(40-0)+(-3)=+37
  // W4  LSU -21:    LSU 34 UCLA 17.  diff=(34-17)+(-21)=-4
  // W5  JMU -19:    UNC 50 JMU 70.   diff=(70-50)+(-19)=+1
  // W6  Rut/Neb O39.5: Neb 14 Rut 7. total=21<39.5 Over ✗ diff=21-39.5=-18.5
  // W8  CO/AZ U57.5: AZ 7 Colo 34.  total=41<57.5 Under ✓ diff=57.5-41=+16.5
  // W9  Wash/Indiana O54.5: IU 31 Wash 17. total=48<54.5 Over ✗ diff=48-54.5=-6.5
  // W10 Org/Mich O44.5: Mich 17 Oregon 38. total=55>44.5 Over ✓ diff=55-44.5=+10.5
  ['Sundy', 1,  'win',  17.5,  'UGA -13.5'],
  ['Sundy', 2,  'win',  37,    'Iowa -3'],
  ['Sundy', 4,  'loss', -4,    'LSU -21'],
  ['Sundy', 5,  'win',  1,     'JMU -19'],
  ['Sundy', 6,  'loss', -18.5, 'Over 39.5'],
  ['Sundy', 8,  'win',  16.5,  'Under 57.5'],
  ['Sundy', 9,  'loss', -6.5,  'Over 54.5'],
  ['Sundy', 10, 'win',  10.5,  'Over 44.5'],

  // ── Boxmaster69420 (Tim) ──────────────────────────────────────────────────
  // W2  Navy -12.5: Navy 38 Temple 11. diff=(38-11)+(-12.5)=+14.5
  // W3  Minn -14.5: Minn 27 Nev 0.   diff=(27-0)+(-14.5)=+12.5
  // W4  Duke -14.5: MTSU 17 Duke 45. diff=(45-17)+(-14.5)=+13.5
  // W5  Memphis -25.5: Mem 24 MTSU 7. diff=(24-7)+(-25.5)=-8.5
  // W6  Toledo -6.5: Toledo 30 MiamiOH 20. diff=(30-20)+(-6.5)=+3.5
  // W7  Vandy/UK O44.5: UK 13 Vandy 20. total=33<44.5 Over ✗ diff=33-44.5=-11.5
  // W8  Iowa -6.5:  MSU 32 Iowa 20.  diff=(20-32)+(-6.5)=-18.5
  // W9  UCONN -6.5: UConn 17 Rice 10. diff=(17-10)+(-6.5)=+0.5
  // W10 Ole Miss -7.5: Ark 31 OM 63. diff=(63-31)+(-7.5)=+24.5
  // W11 Lib -10.5:  MTSU 17 Lib 37.  diff=(37-17)+(-10.5)=+9.5
  // W12 Memphis -15.5: Mem 53 UAB 18. diff=(53-18)+(-15.5)=+19.5
  // W13 Cal -14.5:  Cal 24 Stan 21.  diff=(24-21)+(-14.5)=-11.5
  // W14 BYU -13.5:  BYU 30 Hou 18.  diff=(30-18)+(-13.5)=-1.5
  ['Boxmaster69420', 2,  'win',  14.5,  'Navy -12.5'],
  ['Boxmaster69420', 3,  'win',  12.5,  'Minn -14.5'],
  ['Boxmaster69420', 4,  'win',  13.5,  'Duke -14.5'],
  ['Boxmaster69420', 5,  'loss', -8.5,  'Memphis -25.5'],
  ['Boxmaster69420', 6,  'win',  3.5,   'Toledo -6.5'],
  ['Boxmaster69420', 7,  'loss', -11.5, 'Over 44.5'],
  ['Boxmaster69420', 8,  'loss', -18.5, 'Iowa -6.5'],
  ['Boxmaster69420', 9,  'win',  0.5,   'UCONN -6.5'],
  ['Boxmaster69420', 10, 'win',  24.5,  'Ole Miss -7.5'],
  ['Boxmaster69420', 11, 'win',  9.5,   'Lib -10.5'],
  ['Boxmaster69420', 12, 'win',  19.5,  'Memphis -15.5'],
  ['Boxmaster69420', 13, 'loss', -11.5, 'Cal -14.5'],
  ['Boxmaster69420', 14, 'loss', -1.5,  'BYU -13.5'],

  // ── Tanner ────────────────────────────────────────────────────────────────
  // W1  Miami (FL) -2.5: Fla 17 Miami 41. diff=(41-17)+(-2.5)=+21.5
  // W2  Texas -7:   Mich 12 Texas 31. diff=(31-12)+(-7)=+12
  // W13 Tenn +8.5:  Tenn 56 UTEP 0.  diff=(56-0)+8.5=+64.5
  ['Tanner', 1,  'win',  21.5,  'Miami (FL) -2.5'],
  ['Tanner', 2,  'win',  12,    'Texas -7'],
  ['Tanner', 13, 'win',  64.5,  'Tenn +8.5'],

  // ── GMoney2458 (Grant Grasha) ─────────────────────────────────────────────
  // W1  Iowa/IllSt U39.5: Iowa 40 IllSt 0. total=40>39.5 Under ✗ diff=39.5-40=-0.5
  // W2  Tulane +8.5: Tulane 27 KSt 34. diff=(27-34)+8.5=+1.5
  // W3  BC/Mizz U54: Mizzou 27 BC 21. total=48<54 Under ✓ diff=54-48=+6
  // W4  Miami -16.5: USF 15 Miami 50. diff=(50-15)+(-16.5)=+18.5
  // W5  Tulane -4.5: Tulane 45 USF 10. diff=(45-10)+(-4.5)=+30.5
  // W6  Cocks +9.5: SC 3 OM 27.      diff=(3-27)+9.5=-14.5
  // W7  Clemson -20.5: WF 14 Clem 49. diff=(49-14)+(-20.5)=+14.5
  // W8  Indiana/Neb O49.5: IU 56 Neb 7. total=63>49.5 Over ✓ diff=63-49.5=+13.5
  // W9  PSU -6.5:   Wisc 13 PSU 28.  diff=(28-13)+(-6.5)=+8.5
  // W10 Clemson -10: Clem 21 Lou 33. diff=(21-33)+(-10)=-22
  // W11 Georgia -1.5: OM 28 UGA 10.  diff=(10-28)+(-1.5)=-19.5
  // W12 Tulane -7.5: Navy 0 Tulane 35. diff=(35-0)+(-7.5)=+27.5
  // W13 IUOSU U52.5: OSU 38 IU 15.  total=53>52.5 Under ✗ diff=52.5-53=-0.5
  // W14 TAMU +4.5:  TAMU 7 Texas 17. diff=(7-17)+4.5=-5.5
  ['GMoney2458', 1,  'loss', -0.5,  'Under 39.5'],
  ['GMoney2458', 2,  'win',  1.5,   'Tulane +8.5'],
  ['GMoney2458', 3,  'win',  6,     'Under 54'],
  ['GMoney2458', 4,  'win',  18.5,  'Miami -16.5'],
  ['GMoney2458', 5,  'win',  30.5,  'Tulane -4.5'],
  ['GMoney2458', 6,  'loss', -14.5, 'Cocks +9.5'],
  ['GMoney2458', 7,  'win',  14.5,  'Clemson -20.5'],
  ['GMoney2458', 8,  'win',  13.5,  'Over 49.5'],
  ['GMoney2458', 9,  'win',  8.5,   'PSU -6.5'],
  ['GMoney2458', 10, 'loss', -22,   'Clemson -10'],
  ['GMoney2458', 11, 'loss', -19.5, 'Georgia -1.5'],
  ['GMoney2458', 12, 'win',  27.5,  'Tulane -7.5'],
  ['GMoney2458', 13, 'loss', -0.5,  'Under 52.5'],
  ['GMoney2458', 14, 'loss', -5.5,  'TAMU +4.5'],

  // ── Mitch Bacco ───────────────────────────────────────────────────────────
  // W1  Troy -8.5:  Troy 26 Nev 28.  diff=(26-28)+(-8.5)=-10.5
  // W2  Maryland -9.5: Md 24 MSU 27. diff=(24-27)+(-9.5)=-12.5
  // W3  SC +6:      SC 33 LSU 36.    diff=(33-36)+6=+3
  // W4  Army -6.5:  Army 37 Rice 14. diff=(37-14)+(-6.5)=+16.5
  // W5  Louisville +6.5: ND 31 Lou 24. diff=(24-31)+6.5=-0.5
  // W7  Army/UAB O55.5: Army 44 UAB 10. total=54<55.5 Over ✗ diff=54-55.5=-1.5
  // W8  Florida +1.5: Fla 48 UK 20.  diff=(48-20)+1.5=+29.5
  // W10 Iowa -2.5:  Iowa 42 Wisc 10. diff=(42-10)+(-2.5)=+29.5
  // W11 Duke +3.5:  NCSt 19 Duke 29. diff=(29-19)+3.5=+13.5
  // W12 WVU: no spread listed — skipped
  // W13 UCONN +10.5: Syr 31 UConn 24. diff=(24-31)+10.5=+3.5
  // W14 BC -3.5:    BC 34 Pitt 23.  diff=(34-23)+(-3.5)=+7.5
  ['Mitch Bacco', 1,  'loss', -10.5, 'Troy -8.5'],
  ['Mitch Bacco', 2,  'loss', -12.5, 'Maryland -9.5'],
  ['Mitch Bacco', 3,  'win',  3,     'SC +6'],
  ['Mitch Bacco', 4,  'win',  16.5,  'Army -6.5'],
  ['Mitch Bacco', 5,  'loss', -0.5,  'Louisville +6.5'],
  ['Mitch Bacco', 7,  'loss', -1.5,  'Over 55.5'],
  ['Mitch Bacco', 8,  'win',  29.5,  'Florida +1.5'],
  ['Mitch Bacco', 10, 'win',  29.5,  'Iowa -2.5'],
  ['Mitch Bacco', 11, 'win',  13.5,  'Duke +3.5'],
  ['Mitch Bacco', 13, 'win',  3.5,   'UCONN +10.5'],
  ['Mitch Bacco', 14, 'win',  7.5,   'BC -3.5'],

  // ── SammyBigBeans (Steve Barker) ──────────────────────────────────────────
  // W1  Miami (OH) +2.5: NU 13 MiamiOH 6. diff=(6-13)+2.5=-4.5
  // W2  Kansas -4:  Ill 23 Kansas 17. diff=(17-23)+(-4)=-10
  // W3  Tenn -49.5: Tenn 71 KSt 0.   diff=(71-0)+(-49.5)=+21.5
  // W4  Minnesota +2.5: Minn 14 Iowa 31. diff=(14-31)+2.5=-14.5
  // W5  Navy -3.5:  UAB 18 Navy 41.  diff=(41-18)+(-3.5)=+19.5
  // W6  Mizzou +2.5: TAMU 41 Mizzou 10. diff=(10-41)+2.5=-28.5
  // W7  OrSt -3.5:  Nev 42 OrSt 37. diff=(37-42)+(-3.5)=-8.5
  // W8  LSU -2.5:   Ark 10 LSU 34.  diff=(34-10)+(-2.5)=+21.5
  // W9  BYU +2.5:   UCF 24 BYU 37.  diff=(37-24)+2.5=+15.5
  // W10 Illinois +3.5: Ill 17 Minn 25. diff=(17-25)+3.5=-4.5
  // W11 BYU -2.5:   Utah 21 BYU 22. diff=(22-21)+(-2.5)=-1.5
  // W12 BYU -2.5:   BYU 13 Kansas 17. diff=(13-17)+(-2.5)=-6.5
  // W13 UK +19.5:   Texas 31 UK 14. diff=(14-31)+19.5=+2.5
  // W14 Oklahoma +5.5: LSU 37 Okla 17. diff=(17-37)+5.5=-14.5
  ['SammyBigBeans', 1,  'loss', -4.5,  'Miami (OH) +2.5'],
  ['SammyBigBeans', 2,  'loss', -10,   'Kansas -4'],
  ['SammyBigBeans', 3,  'win',  21.5,  'Tenn -49.5'],
  ['SammyBigBeans', 4,  'loss', -14.5, 'Minnesota +2.5'],
  ['SammyBigBeans', 5,  'win',  19.5,  'Navy -3.5'],
  ['SammyBigBeans', 6,  'loss', -28.5, 'Mizzou +2.5'],
  ['SammyBigBeans', 7,  'loss', -8.5,  'OrSt -3.5'],
  ['SammyBigBeans', 8,  'win',  21.5,  'LSU -2.5'],
  ['SammyBigBeans', 9,  'win',  15.5,  'BYU +2.5'],
  ['SammyBigBeans', 10, 'loss', -4.5,  'Illinois +3.5'],
  ['SammyBigBeans', 11, 'loss', -1.5,  'BYU -2.5'],
  ['SammyBigBeans', 12, 'loss', -6.5,  'BYU -2.5'],
  ['SammyBigBeans', 13, 'win',  2.5,   'UK +19.5'],
  ['SammyBigBeans', 14, 'loss', -14.5, 'Oklahoma +5.5'],

  // ── Glennjamin (Glenn Grasha) ─────────────────────────────────────────────
  // W1  Kent +24:   Pitt 55 Kent 24.  diff=(24-55)+24=-7
  // W2  Washington -24.5: Wash 30 EMU 9. diff=(30-9)+(-24.5)=-3.5
  // W3  Texas -35:  Texas 56 UTSA 7. diff=(56-7)+(-35)=+14
  // W4  BGSU +23:   TAMU 26 BGSU 20. diff=(20-26)+23=+17
  // W5  USC -14.5:  USC 38 Wisc 21.  diff=(38-21)+(-14.5)=+2.5
  // W6  Indiana -13.5: NU 24 IU 41.  diff=(41-24)+(-13.5)=+3.5
  // W7  Iowa St -3: WVU 16 IASt 28.  diff=(28-16)+(-3)=+9
  // W8  K State -3: WVU 18 KSt 45.   diff=(45-18)+(-3)=+24
  // W9  Illinois +22.5: Oregon 38 Ill 9. diff=(9-38)+22.5=-6.5
  // W10 A&M -3:     SC 44 TAMU 20.  diff=(20-44)+(-3)=-27
  // W11 Miami -9.5: GT 28 Miami 23.  diff=(23-28)+(-9.5)=-14.5
  // W12 Oregon -13.5: Wisc 13 Oregon 16. diff=(16-13)+(-13.5)=-10.5
  // W13 USC -4.5:   UCLA 13 USC 19.  diff=(19-13)+(-4.5)=+1.5
  // W14 IU -29:     IU 66 Purdue 0.  diff=(66-0)+(-29)=+37
  ['Glennjamin', 1,  'loss', -7,    'Kent +24'],
  ['Glennjamin', 2,  'loss', -3.5,  'Washington -24.5'],
  ['Glennjamin', 3,  'win',  14,    'Texas -35'],
  ['Glennjamin', 4,  'win',  17,    'BGSU +23'],
  ['Glennjamin', 5,  'win',  2.5,   'USC -14.5'],
  ['Glennjamin', 6,  'win',  3.5,   'Indiana -13.5'],
  ['Glennjamin', 7,  'win',  9,     'Iowa St -3'],
  ['Glennjamin', 8,  'win',  24,    'K State -3'],
  ['Glennjamin', 9,  'loss', -6.5,  'Illinois +22.5'],
  ['Glennjamin', 10, 'loss', -27,   'A&M -3'],
  ['Glennjamin', 11, 'loss', -14.5, 'Miami -9.5'],
  ['Glennjamin', 12, 'loss', -10.5, 'Oregon -13.5'],
  ['Glennjamin', 13, 'win',  1.5,   'USC -4.5'],
  ['Glennjamin', 14, 'win',  37,    'IU -29'],

  // ── Jon ───────────────────────────────────────────────────────────────────
  // W12 Boise St -14.5: SJSU 21 Boise 42 (away). diff=(42-21)+(-14.5)=+6.5
  // W13 CU -2.5:    Kansas 37 Colo 21 (away). diff=(21-37)+(-2.5)=-18.5
  // W14 UNLV -17.5: UNLV 38 Nev 14.  diff=(38-14)+(-17.5)=+6.5
  ['Jon', 12, 'win',  6.5,   'Boise St -14.5'],
  ['Jon', 13, 'loss', -18.5, 'CU -2.5'],
  ['Jon', 14, 'win',  6.5,   'UNLV -17.5'],
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
  insert.run(2024, week, displayName, userIdCache[displayName] ?? null, result, spreadValue, pickedTeam ?? null, canonical);
  inserted++;
}

console.log(`Imported ${inserted} historical picks for 2024.`);

// ── Phase 2: Seed 2024 games from ESPN and link picks ─────────────────────────

const gamesTableExists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='games'`).get();

if (!gamesTableExists) {
  console.log('Games table not found — skipping game linking. Run against prod DB to link game IDs.');
  process.exit(0);
}

db.prepare('UPDATE historical_picks SET game_id = NULL WHERE season = 2024').run();
db.prepare(`DELETE FROM games WHERE season = 2024 AND id NOT IN (
  SELECT DISTINCT game_id FROM picks WHERE game_id IS NOT NULL
)`).run();

const seedGame = db.prepare(`
  INSERT INTO games (espn_id, home_team, away_team, home_abbr, away_abbr, commence_time, week_number, season, status, home_score, away_score)
  VALUES (?, ?, ?, ?, ?, ?, ?, 2024, ?, ?, ?)
  ON CONFLICT (espn_id) DO UPDATE SET
    week_number = excluded.week_number,
    status      = excluded.status,
    home_score  = excluded.home_score,
    away_score  = excluded.away_score
  RETURNING id, espn_id
`);

// Aug 24 2024: Navy vs Notre Dame played in Ireland (ESPN week 1 but before our season).
// Setting seasonStart to Aug 28 excludes that game so week 1 starts Aug 31.
const seasonStart = new Date('2024-08-28T00:00:00Z');

function getWeekSaturday(commenceTime) {
  const et = new Date(new Date(commenceTime).getTime() - 4 * 60 * 60 * 1000);
  const day = et.getUTCDay();
  const daysOffset = day === 0 ? -1 : day === 1 ? -2 : (6 - day);
  const sat = new Date(et);
  sat.setUTCDate(et.getUTCDate() + daysOffset);
  return sat.toISOString().slice(0, 10);
}

console.log('Fetching ESPN weeks 1-15 for 2024...');
const allEvents = [];
for (let espnWeek = 1; espnWeek <= 15; espnWeek++) {
  try {
    const events = await fetchEspnWeek(2024, espnWeek);
    allEvents.push(...events.filter(e => new Date(e.commenceTime) >= seasonStart));
  } catch (err) {
    console.warn(`  ESPN week ${espnWeek} failed: ${err.message}`);
  }
}

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

// Link historical picks to games
const picks = db.prepare(
  `SELECT id, week_number, canonical_team FROM historical_picks WHERE season = 2024 AND canonical_team IS NOT NULL`
).all();

const updatePickGame = db.prepare(`UPDATE historical_picks SET game_id = ? WHERE id = ?`);

let linked = 0;
const unlinked = [];
for (const pick of picks) {
  const games = db.prepare(
    `SELECT id, home_team, away_team FROM games WHERE week_number = ? AND season = 2024`
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

// ── Totals picks: link by team names ─────────────────────────────────────────
const TOTALS_GAME_LINKS = [
  // Kevin W3: Under 48 — San Diego State vs California
  { displayName: 'Jobin69', weekNumber: 3, teams: ['San Diego State', 'California'] },
  // Jimmy W6: Over 36.5 — Navy vs Air Force
  { displayName: 'jimmy', weekNumber: 6, teams: ['Navy', 'Air Force'] },
  // Sundy W6: Over 39.5 — Nebraska vs Rutgers
  { displayName: 'Sundy', weekNumber: 6, teams: ['Nebraska', 'Rutgers'] },
  // Sundy W8: Under 57.5 — Arizona vs Colorado
  { displayName: 'Sundy', weekNumber: 8, teams: ['Arizona', 'Colorado'] },
  // Sundy W9: Over 54.5 — Indiana vs Washington
  { displayName: 'Sundy', weekNumber: 9, teams: ['Indiana', 'Washington'] },
  // Sundy W10: Over 44.5 — Michigan vs Oregon
  { displayName: 'Sundy', weekNumber: 10, teams: ['Michigan', 'Oregon'] },
  // Tim W7: Over 44.5 — Kentucky vs Vanderbilt
  { displayName: 'Boxmaster69420', weekNumber: 7, teams: ['Kentucky', 'Vanderbilt'] },
  // Grant W1: Under 39.5 — Iowa vs Illinois State
  { displayName: 'GMoney2458', weekNumber: 1, teams: ['Iowa', 'Illinois State'] },
  // Grant W3: Under 54 — Boston College vs Missouri
  { displayName: 'GMoney2458', weekNumber: 3, teams: ['Boston College', 'Missouri'] },
  // Grant W8: Over 49.5 — Indiana vs Nebraska
  { displayName: 'GMoney2458', weekNumber: 8, teams: ['Indiana', 'Nebraska'] },
  // Grant W13: Under 52.5 — Ohio State vs Indiana (IUOSU)
  { displayName: 'GMoney2458', weekNumber: 13, teams: ['Ohio State', 'Indiana'] },
  // Mitch W7: Over 55.5 — Army vs UAB
  { displayName: 'Mitch Bacco', weekNumber: 7, teams: ['Army', 'UAB'] },
];

const getPickId = db.prepare('SELECT id FROM historical_picks WHERE season=2024 AND week_number=? AND display_name=?');
for (const link of TOTALS_GAME_LINKS) {
  const game = db.prepare(
    `SELECT id FROM games WHERE season=2024 AND week_number=? AND (
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
