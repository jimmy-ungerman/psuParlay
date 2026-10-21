import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guardNetwork, startServer, useTempDb } from './helpers/server.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const cleanupDb = useTempDb();

const { default: app } = await import('../src/app.js');
const { initDb, query } = await import('../src/db/index.js');
const { recordJobFailure, resetJobHealth } = await import('../src/services/healthState.js');

let server;
let network;

async function get(path) {
  const res = await fetch(`${server.baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
}

before(async () => {
  await initDb();
  network = await guardNetwork();
  server = await startServer(app);
});

after(async () => {
  await server.close();
  network.restore();
  assert.deepEqual(network.blocked, [], 'health endpoints must not make outbound requests');
  cleanupDb();
});

beforeEach(() => {
  resetJobHealth();
  query('DELETE FROM odds_quota');
  delete process.env.ODDS_API_KEY;
});

describe('liveness', () => {
  for (const path of ['/healthz', '/api/health']) {
    test(`GET ${path} returns 200 ok`, async () => {
      assert.deepEqual(await get(path), { status: 200, body: { status: 'ok' } });
    });
  }
});

describe('readiness', () => {
  test('GET /readyz returns 200 ok when the database answers', async () => {
    assert.deepEqual(await get('/readyz'), { status: 200, body: { status: 'ok' } });
  });
});

describe('GET /api/status', () => {
  afterEach(() => {
    delete process.env.ODDS_API_KEY;
  });

  test('reports a healthy pod', async () => {
    const { status, body } = await get('/api/status');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.version, pkg.version);
    assert.ok(Number.isInteger(body.uptimeSeconds) && body.uptimeSeconds >= 0);
    assert.deepEqual(body.checks.database, { ok: true });
    assert.deepEqual(Object.keys(body.checks.jobs).sort(), ['scores', 'seeding', 'spreads']);
  });

  test('reports mock odds with no quota row', async () => {
    const { body } = await get('/api/status');
    assert.deepEqual(body.checks.odds, { mode: 'mock', remaining: null, lastError: null });
  });

  test('reports live odds mode when ODDS_API_KEY is set', async () => {
    process.env.ODDS_API_KEY = 'test-key';
    const { body } = await get('/api/status');
    assert.equal(body.checks.odds.mode, 'live');
  });

  test('reports the stored quota and last odds error', async () => {
    query(
      `INSERT INTO odds_quota (id, remaining, used, last_cost, last_error_code, last_error_message, last_error_at)
       VALUES (1, 42, 458, 2, $1, $2, $3)`,
      ['OUT_OF_USAGE_CREDITS', 'Usage quota has been reached', '2026-10-17 15:00:00'],
    );
    const { status, body } = await get('/api/status');
    assert.equal(status, 200);
    assert.equal(body.checks.odds.remaining, 42);
    assert.deepEqual(body.checks.odds.lastError, {
      code: 'OUT_OF_USAGE_CREDITS',
      message: 'Usage quota has been reached',
      at: '2026-10-17 15:00:00',
    });
  });

  test('stays 200 but reports degraded when a job last failed', async () => {
    recordJobFailure('spreads', new Error('quota exhausted'));
    const { status, body } = await get('/api/status');
    assert.equal(status, 200);
    assert.equal(body.status, 'degraded');
    assert.equal(body.checks.jobs.spreads.lastError, 'quota exhausted');
  });
});
