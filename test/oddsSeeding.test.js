import { after, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { useTempDb } from './helpers/server.js';

const cleanupDb = useTempDb();

const event = {
  espnId: 'e1', homeTeam: 'Penn State Nittany Lions', awayTeam: 'Ohio State Buckeyes',
  homeAbbr: 'PSU', awayAbbr: 'OSU', commenceTime: '2099-10-10T16:00:00Z',
  status: 'scheduled', conference: 'Big Ten', homeRank: null, awayRank: null,
};

mock.module('../src/services/espn.js', {
  namedExports: {
    getActiveWeekGames: async () => ({ season: 2099, week: 6, events: [event] }),
    fetchLiveScores: async () => [],
  },
});

const { default: axios } = await import('axios');
const { initDb, query } = await import('../src/db/index.js');
const { ensureGamesSeeded } = await import('../src/services/schedule.js');

let oddsCalls = 0;
const realAdapter = axios.defaults.adapter;

await initDb();

beforeEach(() => {
  oddsCalls = 0;
  process.env.ODDS_API_KEY = 'test';
  query('DELETE FROM odds_quota');
  query('DELETE FROM games');
  // An empty slate (no DraftKings/FanDuel line) leaves the game unseeded,
  // like a buy game Vegas hasn't posted.
  axios.defaults.adapter = async config => {
    oddsCalls++;
    return { data: [], status: 200, statusText: 'OK', headers: {}, config };
  };
});

after(() => {
  axios.defaults.adapter = realAdapter;
  delete process.env.ODDS_API_KEY;
  cleanupDb();
});

test('seeding without fetchRealOdds never calls The Odds API', async () => {
  await ensureGamesSeeded({ fetchRealOdds: false });
  assert.equal(oddsCalls, 0);
});

test('seeding calls The Odds API once, then the throttle holds', async () => {
  await ensureGamesSeeded();
  await ensureGamesSeeded();
  assert.equal(oddsCalls, 1);
});

test('seeding retries once the throttle window has passed', async () => {
  await ensureGamesSeeded();
  query(`UPDATE odds_quota SET last_seed_attempt_at = datetime('now', '-12 hours') WHERE id = 1`);
  await ensureGamesSeeded();
  assert.equal(oddsCalls, 2);
});

test('seeding is still throttled 6h after an attempt', async () => {
  await ensureGamesSeeded();
  query(`UPDATE odds_quota SET last_seed_attempt_at = datetime('now', '-6 hours') WHERE id = 1`);
  await ensureGamesSeeded();
  assert.equal(oddsCalls, 1);
});
