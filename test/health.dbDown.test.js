import { after, before, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { startServer } from './helpers/server.js';

const db = { failing: false };

mock.module(import.meta.resolve('../src/db/index.js'), {
  exports: {
    query() {
      if (db.failing) throw new Error('database is locked');
      return { rows: [{ 1: 1 }] };
    },
  },
});

const { liveness, readiness, status } = await import('../src/routes/health.js');
const { resetJobHealth } = await import('../src/services/healthState.js');

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

  test('GET /api/status returns 503 without the database error text', async () => {
    const { status, body } = await get('/api/status');
    assert.equal(status, 503);
    assert.equal(body.status, 'down');
    assert.deepEqual(body.checks.database, { ok: false });
    assert.equal(body.checks.odds, undefined);
    assert.deepEqual(Object.keys(body.checks.jobs).sort(), ['scores', 'seeding', 'spreads']);
    for (const job of Object.values(body.checks.jobs)) {
      assert.deepEqual(Object.keys(job).sort(), ['lastErrorAt', 'lastSuccessAt']);
    }
    assert.equal(JSON.stringify(body).includes('database is locked'), false);
  });
});
