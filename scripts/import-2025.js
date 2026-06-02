#!/usr/bin/env node
// Import 2025 historical parlay stats into historical_picks table.
// Run: node scripts/import-2025.js

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

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
  'Pitt':      'Pittsburgh',
  'Rice':      'Rice',
  'SC':        'South Carolina',
  'SDSU':      'San Diego State',
  'SMU':       'SMU',
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
  UNIQUE(season, week_number, display_name)
)`);
const hpCols = db.prepare(`PRAGMA table_info(historical_picks)`).all();
if (!hpCols.some(c => c.name === 'picked_team')) {
  db.exec(`ALTER TABLE historical_picks ADD COLUMN picked_team TEXT`);
}
if (!hpCols.some(c => c.name === 'canonical_team')) {
  db.exec(`ALTER TABLE historical_picks ADD COLUMN canonical_team TEXT`);
}

// CSV display name → registered username (null = unregistered)
const USERNAME_MAP = {
  'Kevin':        'Jobin69',
  'Jimmy':        'jimmy',
  'Tim':          'Boxmaster69420',
  'Grant Grasha': 'GMoney2458',
  'Steve Barker': 'SammyBigBeans',
  'Glenn Grasha': 'Glennjamin',
  'Ryan Arzenti': null,
  'Sundy':        null,
  'Tanner':       null,
  'Mitch Bacco':  null,
  'Jon':          null,
};

// Hardcoded 2025 data: [displayName, week, result, spreadValue, pickedTeam]
const DATA = [
  // Kevin
  ['Kevin', 1,  'win',  27.5,  'Utah -5.5'],
  ['Kevin', 2,  'loss', -10.5, 'UTSA -3.5'],
  ['Kevin', 3,  'loss', -8.5,  'Auburn -24.5'],
  ['Kevin', 4,  'win',  9.5,   'JMU -8.5'],
  ['Kevin', 5,  'loss', -4.5,  'Marshall -1.5'],
  ['Kevin', 6,  'loss', -10.5, 'Rice -4.5'],
  ['Kevin', 7,  'loss', -3.5,  'UNLV -6.5'],
  ['Kevin', 8,  'win',  3.5,   'Army +10.5'],
  ['Kevin', 9,  'win',  19.5,  'SDSU -3.5'],
  ['Kevin', 10, 'win',  6.5,   'Colorado +4'],
  ['Kevin', 11, 'win',  11.5,  'Coastal -7.5'],

  // Jimmy
  ['Jimmy', 1,  'win',  5.5,   'OSU -1.5'],
  ['Jimmy', 2,  'loss', -2.5,  'Ole Miss -9.5'],
  ['Jimmy', 3,  'win',  6.5,   'GT +3.5'],
  ['Jimmy', 4,  'win',  8.5,   'Memphis +7.5'],
  ['Jimmy', 5,  'loss', -3.5,  'Indiana -8.5'],
  ['Jimmy', 6,  'win',  9.5,   'Illinois -7.5'],
  ['Jimmy', 7,  'win',  0.5,   'Missou +3.5'],
  ['Jimmy', 8,  'loss', -7.5,  'Tenn +9.5'],
  ['Jimmy', 9,  'win',  4.5,   'Vandy -2.5'],
  ['Jimmy', 10, 'win',  0.5,   'Vandy +3.5'],
  ['Jimmy', 11, 'win',  11.5,  'Bama -10.5'],

  // Ryan Arzenti (unregistered)
  ['Ryan Arzenti', 1,  'win',  6,     'SC -7'],
  ['Ryan Arzenti', 2,  'win',  38.5,  'Oregon -27.5'],
  ['Ryan Arzenti', 3,  'loss', -4.5,  'USC -20.5'],
  ['Ryan Arzenti', 4,  'win',  0.5,   'Oklahoma -6.5'],
  ['Ryan Arzenti', 5,  'win',  19.5,  'Iowa St -5.5'],
  ['Ryan Arzenti', 7,  'win',  33.5,  'Iowa -3.5'],
  ['Ryan Arzenti', 8,  'win',  5.5,   'Vandy -1.5'],
  ['Ryan Arzenti', 9,  'win',  0.5,   'Nwestrn +7.5'],
  ['Ryan Arzenti', 10, 'loss', -10,   'Indiana -21'],

  // Sundy (unregistered)
  ['Sundy', 2,  'loss', -2,    'Lehigh -20'],
  ['Sundy', 3,  'loss', -1.5,  'Kennesaw -15.5'],
  ['Sundy', 4,  'win',  5.5,   'Lehigh -11.5'],
  ['Sundy', 5,  'loss', -1.5,  'Vandy -21.5'],
  ['Sundy', 6,  'loss', -0.5,  'ND -21.5'],
  ['Sundy', 7,  'win',  32.5,  'UCLA +7.5'],
  ['Sundy', 8,  'win',  33.5,  'JMU -2.5'],
  ['Sundy', 9,  'win',  29.5,  'Iowa -8.5'],
  ['Sundy', 10, 'win',  9.5,   null],

  // Tim
  ['Tim', 1,  'win',  5.5,   'Ten -13.5'],
  ['Tim', 2,  'win',  8.5,   'Memphis -13.5'],
  ['Tim', 3,  'win',  17.5,  'Memphis -3.5'],
  ['Tim', 4,  'win',  23.5,  'Ole Miss -11.5'],
  ['Tim', 5,  'win',  15.5,  'Memphis -13.5'],
  ['Tim', 6,  'win',  34.5,  'UConn -6.5'],
  ['Tim', 7,  'loss', -15.5, 'Toledo -10.5'],
  ['Tim', 8,  'win',  13.5,  'UCONN -1.5'],
  ['Tim', 9,  'win',  17.5,  'Cincy -3.5'],
  ['Tim', 10, 'loss', -13.5, 'UCONN -11.5'],
  ['Tim', 11, 'win',  4.5,   'Wash -10.5'],

  // Tanner (unregistered)
  ['Tanner', 2,  'loss', -7.5,  'PSU -41.5'],
  ['Tanner', 3,  'win',  0.5,   'Tenn +3.5'],
  ['Tanner', 4,  'win',  27.5,  'Texas Tech +3.5'],
  ['Tanner', 5,  'loss', -9.5,  'PSU -3.5'],
  ['Tanner', 7,  'loss', -6.5,  'Auburn +3.5'],
  ['Tanner', 9,  'win',  13.5,  'Ole Miss +5.5'],
  ['Tanner', 10, 'win',  7,     'O55.5 Ole/SC'],
  ['Tanner', 11, 'win',  6,     'Stan/UNC U42.5'],

  // Grant Grasha
  ['Grant Grasha', 1,  'win',  18.5,  'Oregon -27.5'],
  ['Grant Grasha', 2,  'loss', -0.5,  'Iowa St -3.5'],
  ['Grant Grasha', 3,  'loss', -4.5,  'Oregon -26.5'],
  ['Grant Grasha', 4,  'win',  27.5,  'Maryland +10.5'],
  ['Grant Grasha', 5,  'win',  3.5,   'Ole Miss -1.5'],
  ['Grant Grasha', 6,  'win',  2,     'Maryland +6'],
  ['Grant Grasha', 7,  'win',  15.5,  'USC -2.5'],
  ['Grant Grasha', 8,  'win',  6.5,   'BYU +3.5'],
  ['Grant Grasha', 9,  'loss', -3,    'Bama -10'],
  ['Grant Grasha', 10, 'loss', -11.5, 'Georgia -6.5'],
  ['Grant Grasha', 11, 'loss', -1.5,  'Duke -8.5'],

  // Mitch Bacco (unregistered)
  ['Mitch Bacco', 2,  'loss', -20.5, 'K State -17.5'],
  ['Mitch Bacco', 3,  'loss', -7.5,  'ND -6.5'],
  ['Mitch Bacco', 5,  'loss', -7.5,  'Kansas -4.5'],
  ['Mitch Bacco', 6,  'win',  2.5,   'AppState -1.5'],
  ['Mitch Bacco', 8,  'loss', -1.5,  'AF -4.5'],
  ['Mitch Bacco', 9,  'loss', -14.5, 'AzST -6.5'],
  ['Mitch Bacco', 10, 'win',  0.5,   'Minn -3.5'],
  ['Mitch Bacco', 11, 'loss', -30.5, 'WVU -6.5'],

  // Steve Barker
  ['Steve Barker', 1,  'win',  32.5,  'Iowa St -15.5'],
  ['Steve Barker', 2,  'win',  23.5,  'Illinois -2.5'],
  ['Steve Barker', 3,  'loss', -19.5, 'USF +17.5'],
  ['Steve Barker', 4,  'win',  11.5,  'Miami -7.5'],
  ['Steve Barker', 5,  'win',  9.5,   'OSU -8.5'],
  ['Steve Barker', 6,  'loss', -6.5,  'Iowa St +1.5'],
  ['Steve Barker', 7,  'loss', -14.5, 'OK +2.5'],
  ['Steve Barker', 8,  'win',  12.5,  'GT +3.5'],
  ['Steve Barker', 9,  'win',  19.5,  'BYU +2.5'],
  ['Steve Barker', 10, 'loss', -10.5, 'ECU -4.5'],
  ['Steve Barker', 11, 'loss', -1,    'VA -6.5'],

  // Glenn Grasha
  ['Glenn Grasha', 1,  'loss', -28,   'Bama -14'],
  ['Glenn Grasha', 2,  'loss', -5.5,  'SMU -2.5'],
  ['Glenn Grasha', 3,  'win',  11,    'Illinois -27.5'],
  ['Glenn Grasha', 4,  'win',  17.5,  'UCF -7.5'],
  ['Glenn Grasha', 5,  'loss', -8.5,  'UCF +5.5'],
  ['Glenn Grasha', 6,  'win',  23.5,  'NWestern -11.5'],
  ['Glenn Grasha', 7,  'win',  17.5,  'Clem -13.5'],
  ['Glenn Grasha', 8,  'loss', -4.5,  'A&M -7.5'],
  ['Glenn Grasha', 9,  'loss', -17.5, 'Oregon -31.5'],
  ['Glenn Grasha', 10, 'win',  0.5,   'Pitt -14'],
  ['Glenn Grasha', 11, 'loss', -9,    'Vandy -6.5'],

  // Jon (unregistered)
  ['Jon', 1,  'loss', -1.5,  'UK -9.5'],
  ['Jon', 2,  'win',  5.5,   'Mizzou -5.5'],
  ['Jon', 3,  'loss', 0.5,   'OSU -29.5'],
  ['Jon', 5,  'win',  4.5,   'Lville -3.5'],
  ['Jon', 10, 'loss', -4.5,  'Oregon -6.5'],
  ['Jon', 11, 'loss', -11.5, 'Oregon -6.5'],
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

// Pre-resolve user IDs
const userIdCache = {};
const warned = new Set();
for (const displayName of Object.keys(USERNAME_MAP)) {
  const username = USERNAME_MAP[displayName];
  if (!username) { userIdCache[displayName] = null; continue; }
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (row) {
    userIdCache[displayName] = row.id;
  } else {
    userIdCache[displayName] = null;
    if (!warned.has(username)) {
      console.warn(`Warning: username '${username}' not found in DB (for ${displayName})`);
      warned.add(username);
    }
  }
}

let inserted = 0;
const unknownAbbrevs = new Set();
for (const [displayName, week, result, spreadValue, pickedTeam] of DATA) {
  const canonical = pickedTeam ? canonicalize(pickedTeam) : null;
  if (pickedTeam && !canonical) {
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
