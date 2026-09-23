#!/usr/bin/env node
// One-off repair for games that never got their final score (they dropped off
// ESPN's default scoreboard before the score updater caught them).
//
// For each unfinished game in the target week that has a pick:
//   1. pull the real final from ESPN
//   2. mark the game complete and re-grade its pending picks off the game's
//      current home_spread/total (frozen since the pick deadline by
//      scoreUpdater's pickStillOpen gate — see src/services/results.js)
//
// Dry-run by default. Pass --commit to write.
//
//   node scripts/repair-picks.js --season 2026 --week 1
//   node scripts/repair-picks.js --season 2026 --week 1 --commit

import { DatabaseSync } from 'node:sqlite';
import { calculateResult } from '../src/services/results.js';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const season = parseInt(getArg('season', '2026'));
const week = parseInt(getArg('week', '1'));
const commit = args.includes('--commit');
const DB_PATH = process.env.DB_PATH || './data/psuparlay.db';

const ESPN_SUMMARY =
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=';

async function fetchFinal(espnId) {
  const res = await fetch(`${ESPN_SUMMARY}${espnId}`);
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = await res.json();
  const comp = data.header?.competitions?.[0];
  const home = comp?.competitors?.find(c => c.homeAway === 'home');
  const away = comp?.competitors?.find(c => c.homeAway === 'away');
  return {
    status: comp?.status?.type?.name,
    complete: comp?.status?.type?.name === 'STATUS_FINAL',
    homeScore: home?.score != null ? parseInt(home.score) : null,
    awayScore: away?.score != null ? parseInt(away.score) : null,
  };
}

const db = new DatabaseSync(DB_PATH);
const q = (sql, ...p) => db.prepare(sql).all(...p);

const games = q(
  `SELECT g.* FROM games g
   WHERE g.season = ? AND g.week_number = ? AND g.status != 'complete'
     AND EXISTS (SELECT 1 FROM picks p WHERE p.game_id = g.id)
   ORDER BY g.commence_time`,
  season, week
);

console.log(`\nRepair target: ${season} week ${week} — ${games.length} unfinished picked game(s)`);
console.log(`Database: ${DB_PATH}`);
console.log(`Mode: ${commit ? 'COMMIT' : 'dry run (pass --commit to write)'}\n`);

const gameUpdates = [];
const pickUpdates = [];

for (const game of games) {
  const label = `${game.away_team} @ ${game.home_team}`;
  let final;
  try {
    final = await fetchFinal(game.espn_id);
  } catch (err) {
    console.log(`  ✗ ${label} — ESPN lookup failed (${err.message}), skipping`);
    continue;
  }
  if (!final.complete || final.homeScore == null) {
    console.log(`  … ${label} — ESPN status ${final.status}, not final yet, skipping`);
    continue;
  }

  const picks = q(`SELECT * FROM picks WHERE game_id = ?`, game.id);

  const newGame = {
    ...game,
    status: 'complete',
    home_score: final.homeScore,
    away_score: final.awayScore,
  };

  gameUpdates.push(newGame);

  console.log(`  ✓ ${label} — Final ${final.awayScore}-${final.homeScore}`);

  for (const pick of picks) {
    if (pick.result !== 'pending') continue;
    const result = calculateResult(pick, newGame);
    pickUpdates.push({ id: pick.id, result, pick, game: newGame });
    const who = q(`SELECT username FROM users WHERE id = ?`, pick.user_id)[0]?.username ?? `user ${pick.user_id}`;
    console.log(`      ${who}: ${pick.picked_team} — ${result.toUpperCase()}`);
  }
}

console.log(
  `\n${gameUpdates.length} game(s) to complete, ${pickUpdates.length} pick(s) to grade.`
);

if (!commit) {
  console.log('\nDry run — nothing written. Re-run with --commit to apply.\n');
  process.exit(0);
}

db.exec('BEGIN');
try {
  const gStmt = db.prepare(
    `UPDATE games SET status = 'complete', home_score = ?, away_score = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  );
  for (const g of gameUpdates) {
    gStmt.run(g.home_score, g.away_score, g.id);
  }
  const pStmt = db.prepare(`UPDATE picks SET result = ? WHERE id = ?`);
  for (const u of pickUpdates) {
    if (u.result !== 'pending') pStmt.run(u.result, u.id);
  }
  db.exec('COMMIT');
  console.log('\n✓ Committed.\n');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('\n✗ Rolled back:', err.message, '\n');
  process.exit(1);
}
