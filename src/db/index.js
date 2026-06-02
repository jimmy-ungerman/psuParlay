import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  console.log('Database initialized');
}

export default { query };
