# PSU Parlay

A weekly college football parlay tracker for a group of friends. Everyone picks one game against the spread each week, the picks get combined into a parlay, and the group lives and dies together.

Built around Penn State football — with a group consensus vote each week on whether to add PSU to the parlay.

## How It Works

Each week:

1. **Pick your game** — everyone claims one college football game against the spread. First to pick a game locks it; no two people can be on the same game.
2. **Vote on PSU** — the group votes whether to add the Penn State game as a shared consensus pick. If a majority votes yes, it's added to the parlay for everyone.
3. **Picks lock at 11:30 AM ET Saturday** — after that, no changes.
4. **Watch the chaos unfold** — live scores update automatically. Wins, losses, and pushes are tracked on the parlay card.
5. **Check the standings** — season-long leaderboard tracks each person's record.

## Features

- **First-to-claim picks** — one game per person per week, locked once selected
- **Live line movement** — spreads update every 4 hours from The Odds API; the parlay card shows what you picked at vs. the current line
- **PSU consensus vote** — majority vote adds Penn State as a group pick; if consensus is reached, any existing pick on that game is automatically cleared
- **Real-time scores** — ESPN scores pulled every 15 minutes during game day
- **Reactions & trash talk** — emoji reactions on picks, plus a weekly comment thread
- **Leaderboard & history** — season standings and full historical record

## Setup

### Prerequisites

- Node.js 22+
- A free API key from [the-odds-api.com](https://the-odds-api.com) (optional — mock spreads used if omitted)

### Local Development

```bash
# Install dependencies
npm install

# Copy env file and configure
cp .env.example .env

# Start dev server (hot reload)
npm run dev
```

The frontend runs on `http://localhost:5173`, proxying `/api` to Express on `:3001`.

### Environment Variables

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret for signing auth cookies — change this in production |
| `ODDS_API_KEY` | The Odds API key for real spreads; leave empty for mock mode |
| `DB_PATH` | Path to SQLite database (default: `./data/psuparlay.db`) |
| `PORT` | Express port (default: `3001`) |

### Production

```bash
npm run build   # builds frontend to dist/
npm start       # serves everything from Express
```

### First Run

The first user to register becomes the admin. Everyone else needs an invite link — admins can generate these from the Admin panel.

## Stack

- **Backend:** Node.js + Express, SQLite (WAL mode)
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Auth:** JWT in httpOnly cookies, invite-only registration
- **Scores:** ESPN unofficial scoreboard API
- **Spreads:** [The Odds API](https://the-odds-api.com)
