import client from 'prom-client';
import pool from '../db/index.js';
import { getJobHealth } from './healthState.js';
import { isMockMode } from './odds.js';

// Scraped from /metrics. Odds API state is read from the odds_quota table at
// scrape time, so it matches what the admin panel shows and survives restarts.
// Quota numbers and exception text stay off this unauthenticated endpoint; the
// error code (INVALID_KEY, OUT_OF_USAGE_CREDITS, ...) is enough to alert on.

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'psuparlay_' });

// SQLite CURRENT_TIMESTAMP is UTC without a zone suffix.
function toSeconds(ts) {
  if (!ts) return null;
  const ms = new Date(`${String(ts).replace(' ', 'T')}Z`).getTime();
  return Number.isNaN(ms) ? null : ms / 1000;
}

async function readOddsRow() {
  try {
    const { rows } = await pool.query(`SELECT updated_at, last_error_code, last_error_at FROM odds_quota WHERE id = 1`);
    return rows[0] ?? null;
  } catch (err) {
    console.error('Metrics: odds_quota read failed:', err.message);
    return null;
  }
}

new client.Gauge({
  name: 'psuparlay_odds_api_mock_mode',
  help: '1 when ODDS_API_KEY is unset and spreads are simulated',
  registers: [registry],
  collect() { this.set(isMockMode() ? 1 : 0); },
});

new client.Gauge({
  name: 'psuparlay_odds_api_last_call_ok',
  help: '0 when the most recent The Odds API call failed (bad key, quota exhausted, outage); 1 after a success',
  registers: [registry],
  async collect() {
    this.remove();
    if (isMockMode()) return;
    const row = await readOddsRow();
    this.set(row?.last_error_at ? 0 : 1);
  },
});

new client.Gauge({
  name: 'psuparlay_odds_api_last_error_info',
  help: 'Set to 1 with the Odds API error_code label while the last call is failing',
  labelNames: ['error_code'],
  registers: [registry],
  async collect() {
    this.reset();
    if (isMockMode()) return;
    const row = await readOddsRow();
    if (row?.last_error_at) this.set({ error_code: row.last_error_code ?? 'UNKNOWN' }, 1);
  },
});

new client.Gauge({
  name: 'psuparlay_odds_api_last_success_timestamp_seconds',
  help: 'Unix time of the last successful The Odds API call',
  registers: [registry],
  async collect() {
    this.remove();
    const seconds = toSeconds((await readOddsRow())?.updated_at);
    if (seconds != null) this.set(seconds);
  },
});

const jobTimestamp = (name, help, field) => new client.Gauge({
  name,
  help,
  labelNames: ['job'],
  registers: [registry],
  collect() {
    this.reset();
    for (const [job, state] of Object.entries(getJobHealth())) {
      if (state[field]) this.set({ job }, new Date(state[field]).getTime() / 1000);
    }
  },
});

jobTimestamp('psuparlay_job_last_success_timestamp_seconds', 'Unix time of the last successful run of a background job (per pod)', 'lastSuccessAt');
jobTimestamp('psuparlay_job_last_error_timestamp_seconds', 'Unix time of the last failed run of a background job (per pod)', 'lastErrorAt');
