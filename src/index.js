import 'dotenv/config';
import app from './app.js';
import { initDb } from './db/index.js';
import { startScoreUpdater } from './jobs/scoreUpdater.js';
import { ensureGamesSeeded } from './services/schedule.js';
import { recordJobFailure, recordJobSuccess } from './services/healthState.js';

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initDb();
    startScoreUpdater();
    app.listen(PORT, () => console.log(`App running on port ${PORT}`));
    // Seed the active week on boot so a fresh deploy is immediately current.
    ensureGamesSeeded()
      .then(() => recordJobSuccess('seeding'))
      .catch(err => {
        recordJobFailure('seeding', err);
        console.error('Startup week-seed error:', err.message);
      });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
