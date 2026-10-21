import { after, before, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { startServer } from './helpers/server.js';

const db = { failing: false };
const odds = { quotaError: null };

mock.module(import.meta.resolve('../src/db/index.js'), {
  exports: {
    query() {
      if (db.failing) throw new Error('database is locked');
      return { rows: [{ 1: 1 }] };
    },
  },
});

mock.module(import.meta.resolve('../src/services/odds.js'), {
  exports: {
    isMockMode: () => true,
    async getOddsQuota() {
      if (odds.quotaError) throw odds.quotaError;
      return null;
    },
  },
});

const { liveness, readiness, status } = await import('../src/routes/health.js');
const { getJobHealth, resetJobHealth } = await import('../src/services/healthState.js');

const app = express();
app.get('/healthz', liveness);
app.get('/readyz', readiness);
app.get('/api/status', status);

let server;

async function get(path) {
  const res = await fetch(`${server.baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
}

before(async () => {
  server = await startServer(app);
});

after(async () => {
  await server.close();
});

beforeEach(() => {
  resetJobHealth();
  db.failing = false;
  odds.quotaError = null;
});

describe('when the database query fails', () => {
  beforeEach(() => {
    db.failing = true;
  });

  test('GET /healthz stays 200 so the pod is not restarted', async () => {
    assert.deepEqual(await get('/healthz'), { status: 200, body: { status: 'ok' } });
  });

  test('GET /readyz returns 503 down', async () => {
    assert.deepEqual(await get('/readyz'), { status: 503, body: { status: 'down' } });
  });

  test('GET /api/status returns 503 with the database error and job state', async () => {
    const { status, body } = await get('/api/status');
    assert.equal(status, 503);
    assert.equal(body.status, 'down');
    assert.deepEqual(body.checks.database, { ok: false, error: 'database is locked' });
    assert.equal(body.checks.odds, null);
    assert.deepEqual(body.checks.jobs, getJobHealth());
  });
});

describe('when reading the odds quota fails', () => {
  test('GET /api/status returns 503 and reports it as a database failure', async () => {
    odds.quotaError = new Error('no such table: odds_quota');
    const { status, body } = await get('/api/status');
    assert.equal(status, 503);
    assert.equal(body.status, 'down');
    assert.deepEqual(body.checks.database, { ok: false, error: 'no such table: odds_quota' });
    assert.equal(body.checks.odds, null);
  });

  test('GET /readyz is unaffected', async () => {
    odds.quotaError = new Error('no such table: odds_quota');
    assert.deepEqual(await get('/readyz'), { status: 200, body: { status: 'ok' } });
  });
});
