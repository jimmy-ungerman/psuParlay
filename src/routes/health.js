import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/index.js';
import { getJobHealth, jobsDegraded } from '../services/healthState.js';

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')
);

// Probes must stay fast and must not call ESPN or The Odds API. A dead
// external feed should not restart the pod or spend odds credits.
//
// This listener is unauthenticated. Odds mode, remaining credits, vendor
// errors, and exception text stay off it. Quota is admin-only on
// GET /api/games/odds-quota. Failures are logged on the server.

function checkDatabase() {
  try {
    query('SELECT 1');
    return { ok: true };
  } catch (err) {
    console.error('Database health check failed:', err.message);
    return { ok: false };
  }
}

// Timestamps say which job is behind. The exception string stays in logs.
function publicJobs() {
  const jobs = {};
  for (const [name, job] of Object.entries(getJobHealth())) {
    jobs[name] = { lastSuccessAt: job.lastSuccessAt, lastErrorAt: job.lastErrorAt };
  }
  return jobs;
}

export function liveness(_req, res) {
  res.json({ status: 'ok' });
}

export function readiness(_req, res) {
  const database = checkDatabase();
  if (!database.ok) return res.status(503).json({ status: 'down' });
  res.json({ status: 'ok' });
}

export function status(_req, res) {
  const database = checkDatabase();
  const jobs = publicJobs();
  const version = pkg.version;
  const uptimeSeconds = Math.floor(process.uptime());

  if (!database.ok) {
    return res.status(503).json({
      status: 'down',
      version,
      uptimeSeconds,
      checks: { database, jobs },
    });
  }

  res.json({
    status: jobsDegraded() ? 'degraded' : 'ok',
    version,
    uptimeSeconds,
    checks: { database, jobs },
  });
}
