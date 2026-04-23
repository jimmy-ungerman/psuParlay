import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true, // required for cookies
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

async function start() {
  try {
    await initDb();
    startScoreUpdater();
    app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
