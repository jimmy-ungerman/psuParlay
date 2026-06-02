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

// Ensure table exists (runs before app starts)
db.exec(`CREATE TABLE IF NOT EXISTS historical_picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  result TEXT NOT NULL,
  spread_value REAL NOT NULL,
  UNIQUE(season, week_number, display_name)
)`);

// CSV display name → registered username (null = unregistered)
const USERNAME_MAP = {
  'Kevin':       'Jobin69',
  'Jimmy':       'jimmy',
  'Tim':         'Boxmaster69420',
  'Grant Grasha': 'GMoney2458',
  'Steve Barker': 'SammyBigBeans',
  'Glenn Grasha': 'Glennjamin',
  // Unregistered — stored by display_name only
  'Ryan Arzenti': null,
  'Sundy':        null,
  'Tanner':       null,
  'Mitch Bacco':  null,
  'Jon':          null,
};

// Hardcoded 2025 data: [displayName, week, result, spreadValue]
// null spreadValue weeks = did not participate that week
const DATA = [
  // Kevin
  ['Kevin', 1,  'win',  27.5],
  ['Kevin', 2,  'loss', -10.5],
  ['Kevin', 3,  'loss', -8.5],
  ['Kevin', 4,  'win',  9.5],
  ['Kevin', 5,  'loss', -4.5],
  ['Kevin', 6,  'loss', -10.5],
  ['Kevin', 7,  'loss', -3.5],
  ['Kevin', 8,  'win',  3.5],
  ['Kevin', 9,  'win',  19.5],
  ['Kevin', 10, 'win',  6.5],
  ['Kevin', 11, 'win',  11.5],

  // Jimmy
  ['Jimmy', 1,  'win',  5.5],
  ['Jimmy', 2,  'loss', -2.5],
  ['Jimmy', 3,  'win',  6.5],
  ['Jimmy', 4,  'win',  8.5],
  ['Jimmy', 5,  'loss', -3.5],
  ['Jimmy', 6,  'win',  9.5],
  ['Jimmy', 7,  'win',  0.5],
  ['Jimmy', 8,  'loss', -7.5],
  ['Jimmy', 9,  'win',  4.5],
  ['Jimmy', 10, 'win',  0.5],
  ['Jimmy', 11, 'win',  11.5],

  // Ryan Arzenti (unregistered)
  ['Ryan Arzenti', 1,  'win',  6],
  ['Ryan Arzenti', 2,  'win',  38.5],
  ['Ryan Arzenti', 3,  'loss', -4.5],
  ['Ryan Arzenti', 4,  'win',  0.5],
  ['Ryan Arzenti', 5,  'win',  19.5],
  ['Ryan Arzenti', 7,  'win',  33.5],
  ['Ryan Arzenti', 8,  'win',  5.5],
  ['Ryan Arzenti', 9,  'win',  0.5],
  ['Ryan Arzenti', 10, 'loss', -10],

  // Sundy (unregistered)
  ['Sundy', 2,  'loss', -2],
  ['Sundy', 3,  'loss', -1.5],
  ['Sundy', 4,  'win',  5.5],
  ['Sundy', 5,  'loss', -1.5],
  ['Sundy', 6,  'loss', -0.5],
  ['Sundy', 7,  'win',  32.5],
  ['Sundy', 8,  'win',  33.5],
  ['Sundy', 9,  'win',  29.5],
  ['Sundy', 10, 'win',  9.5],

  // Tim
  ['Tim', 1,  'win',  5.5],
  ['Tim', 2,  'win',  8.5],
  ['Tim', 3,  'win',  17.5],
  ['Tim', 4,  'win',  23.5],
  ['Tim', 5,  'win',  15.5],
  ['Tim', 6,  'win',  34.5],
  ['Tim', 7,  'loss', -15.5],
  ['Tim', 8,  'win',  13.5],
  ['Tim', 9,  'win',  17.5],
  ['Tim', 10, 'loss', -13.5],
  ['Tim', 11, 'win',  4.5],

  // Tanner (unregistered)
  ['Tanner', 2,  'loss', -7.5],
  ['Tanner', 3,  'win',  0.5],
  ['Tanner', 4,  'win',  27.5],
  ['Tanner', 5,  'loss', -9.5],
  ['Tanner', 7,  'loss', -6.5],
  ['Tanner', 9,  'win',  13.5],
  ['Tanner', 10, 'win',  7],
  ['Tanner', 11, 'win',  6],

  // Grant Grasha
  ['Grant Grasha', 1,  'win',  18.5],
  ['Grant Grasha', 2,  'loss', -0.5],
  ['Grant Grasha', 3,  'loss', -4.5],
  ['Grant Grasha', 4,  'win',  27.5],
  ['Grant Grasha', 5,  'win',  3.5],
  ['Grant Grasha', 6,  'win',  2],
  ['Grant Grasha', 7,  'win',  15.5],
  ['Grant Grasha', 8,  'win',  6.5],
  ['Grant Grasha', 9,  'loss', -3],
  ['Grant Grasha', 10, 'loss', -11.5],
  ['Grant Grasha', 11, 'loss', -1.5],

  // Mitch Bacco (unregistered)
  ['Mitch Bacco', 2,  'loss', -20.5],
  ['Mitch Bacco', 3,  'loss', -7.5],
  ['Mitch Bacco', 5,  'loss', -7.5],
  ['Mitch Bacco', 6,  'win',  2.5],
  ['Mitch Bacco', 8,  'loss', -1.5],
  ['Mitch Bacco', 9,  'loss', -14.5],
  ['Mitch Bacco', 10, 'win',  0.5],
  ['Mitch Bacco', 11, 'loss', -30.5],

  // Steve Barker
  ['Steve Barker', 1,  'win',  32.5],
  ['Steve Barker', 2,  'win',  23.5],
  ['Steve Barker', 3,  'loss', -19.5],
  ['Steve Barker', 4,  'win',  11.5],
  ['Steve Barker', 5,  'win',  9.5],
  ['Steve Barker', 6,  'loss', -6.5],
  ['Steve Barker', 7,  'loss', -14.5],
  ['Steve Barker', 8,  'win',  12.5],
  ['Steve Barker', 9,  'win',  19.5],
  ['Steve Barker', 10, 'loss', -10.5],
  ['Steve Barker', 11, 'loss', -1],

  // Glenn Grasha
  ['Glenn Grasha', 1,  'loss', -28],
  ['Glenn Grasha', 2,  'loss', -5.5],
  ['Glenn Grasha', 3,  'win',  11],
  ['Glenn Grasha', 4,  'win',  17.5],
  ['Glenn Grasha', 5,  'loss', -8.5],
  ['Glenn Grasha', 6,  'win',  23.5],
  ['Glenn Grasha', 7,  'win',  17.5],
  ['Glenn Grasha', 8,  'loss', -4.5],
  ['Glenn Grasha', 9,  'loss', -17.5],
  ['Glenn Grasha', 10, 'win',  0.5],
  ['Glenn Grasha', 11, 'loss', -9],

  // Jon (unregistered)
  ['Jon', 1,  'loss', -1.5],
  ['Jon', 2,  'win',  5.5],
  ['Jon', 3,  'loss', 0.5],
  ['Jon', 5,  'win',  4.5],
  ['Jon', 10, 'loss', -4.5],
  ['Jon', 11, 'loss', -11.5],
];

const insert = db.prepare(`
  INSERT INTO historical_picks (season, week_number, display_name, user_id, result, spread_value)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT (season, week_number, display_name) DO UPDATE SET
    result = excluded.result,
    spread_value = excluded.spread_value,
    user_id = excluded.user_id
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
for (const [displayName, week, result, spreadValue] of DATA) {
  insert.run(2025, week, displayName, userIdCache[displayName] ?? null, result, spreadValue);
  inserted++;
}

console.log(`Imported ${inserted} historical picks for 2025.`);
