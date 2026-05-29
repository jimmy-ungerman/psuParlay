import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import { startScoreUpdater } from './jobs/scoreUpdater.js';
import authRoutes from './routes/auth.js';
import inviteRoutes from './routes/invites.js';
import gameRoutes from './routes/games.js';
import pickRoutes from './routes/picks.js';
import leaderboardRoutes from './routes/leaderboard.js';
import reactionRoutes from './routes/reactions.js';
import commentRoutes from './routes/comments.js';
import userRoutes from './routes/users.js';
import statsRoutes from './routes/stats.js';
import pushRoutes from './routes/push.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/picks', pickRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/push', pushRoutes);

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

// Serve the built frontend
const distDir = join(__dirname, '../dist');
app.use(express.static(distDir));
app.get('*', (_, res) => res.sendFile(join(distDir, 'index.html')));

async function start() {
  try {
    await initDb();
    startScoreUpdater();
    app.listen(PORT, () => console.log(`App running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
