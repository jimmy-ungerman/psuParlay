import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/index.js';
import { getOddsQuota, isMockMode } from '../services/odds.js';
import { getJobHealth, jobsDegraded } from '../services/healthState.js';

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8')
);

// Probes must stay fast and must not call ESPN or The Odds API. A dead
// external feed should not restart the pod or spend odds credits.

function checkDatabase() {
  try {
    query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function liveness(_req, res) {
  res.json({ status: 'ok' });
}

export function readiness(_req, res) {
  const database = checkDatabase();
  if (!database.ok) return res.status(503).json({ status: 'down' });
  res.json({ status: 'ok' });
}

export async function status(_req, res) {
  const database = checkDatabase();
  const jobs = getJobHealth();
  const version = pkg.version;
  const uptimeSeconds = Math.floor(process.uptime());

  if (!database.ok) {
    return res.status(503).json({
      status: 'down',
      version,
      uptimeSeconds,
      checks: { database, odds: null, jobs },
    });
  }

  let quota;
  try {
    quota = await getOddsQuota();
  } catch (err) {
    return res.status(503).json({
      status: 'down',
      version,
      uptimeSeconds,
      checks: {
        database: { ok: false, error: err.message },
        odds: null,
        jobs,
      },
    });
  }

  res.json({
    status: jobsDegraded() ? 'degraded' : 'ok',
    version,
    uptimeSeconds,
    checks: {
      database,
      odds: {
        mode: isMockMode() ? 'mock' : 'live',
        remaining: quota?.remaining ?? null,
        lastError: quota?.lastError ?? null,
      },
      jobs,
    },
  });
}
