// Run once to create the initial admin user:
//   node seed-admin.js <username> <password>
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { initDb, query } from './src/db/index.js';

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error('Usage: node seed-admin.js <username> <password>');
  process.exit(1);
}

await initDb();

const { rows } = query('SELECT COUNT(*) as count FROM users');
if (rows[0].count > 0) {
  console.error('Users already exist — register normally or delete data/psuparlay.db to start fresh.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
query('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)', [username, hash]);
console.log(`Admin user "${username}" created.`);
