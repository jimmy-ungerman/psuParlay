import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || './data/psuparlay.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Thin wrapper that mimics the pg pool.query({ rows }) interface.
// Translates $1/$2/... positional params to SQLite's ? style.
export function query(sql, params = []) {
  const normalized = sql.replace(/\$(\d+)/g, '@p$1');
  const namedParams = {};
  params.forEach((val, i) => { namedParams[`p${i + 1}`] = val; });
  const stmt = db.prepare(normalized);
  const isRead = /^\s*SELECT\b/i.test(normalized) || /\bRETURNING\b/i.test(normalized);
  if (isRead) {
    const rows = stmt.all(namedParams);
    return { rows };
  }
  stmt.run(namedParams);
  return { rows: [] };
}

export async function initDb() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  // Migrations for columns added after initial schema
  const cols = db.prepare(`PRAGMA table_info(games)`).all();
  if (!cols.some(c => c.name === 'conference')) {
    db.exec(`ALTER TABLE games ADD COLUMN conference TEXT`);
  }

  // Remove week 0 games (before September of their season year)
  db.exec(`DELETE FROM games WHERE strftime('%m', commence_time) < '09'`);

  // Seed default admin user if configured and no users exist yet
  const seedUsername = process.env.SEED_ADMIN_USERNAME;
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (seedUsername && seedPassword) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(seedUsername);
    if (!existing) {
      const hash = await bcrypt.hash(seedPassword, 12);
      db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)').run(seedUsername, hash);
      console.log(`Seeded admin user: ${seedUsername}`);
    }
  }

  console.log('Database initialized');
}

export default { query };
