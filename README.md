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

### Kubernetes probes

Unauthenticated endpoints on the Express port (default `3001`). They do not call ESPN or The Odds API.

- `GET /healthz` and `GET /api/health` — liveness. `200` when the process can respond.
- `GET /readyz` — readiness. `200` when SQLite answers, `503` when it does not.
- `GET /api/status` — pod status. `503` only when the database check fails. `200` with `"status": "degraded"` when the last score update, spread refresh, or week seed failed. Job timestamps only; odds quota and exception text stay off this route.

```yaml
livenessProbe:
  httpGet: { path: /healthz, port: 3001 }
  periodSeconds: 20
readinessProbe:
  httpGet: { path: /readyz, port: 3001 }
  periodSeconds: 10
```

Use `/api/status` from a port-forward. It is not a probe that should restart the pod.

### Prometheus metrics

`GET /metrics` on the Express port, unauthenticated like the probes. It does not call ESPN or The Odds API. Odds API state is read from the `odds_quota` table at scrape time. Quota numbers and exception text are not exposed.

| Metric | Meaning |
| --- | --- |
| `psuparlay_odds_api_last_call_ok` | `0` while the most recent Odds API call is failing (bad key, quota exhausted, outage), `1` after a success. Absent in mock mode. |
| `psuparlay_odds_api_last_error_info{error_code}` | `1` with the Odds API error code (e.g. `INVALID_KEY`, `OUT_OF_USAGE_CREDITS`) while failing. |
| `psuparlay_odds_api_last_success_timestamp_seconds` | Unix time of the last successful call. |
| `psuparlay_odds_api_mock_mode` | `1` when `ODDS_API_KEY` is unset. |
| `psuparlay_job_last_{success,error}_timestamp_seconds{job}` | Per-pod background job timestamps. |

Example alert:

```yaml
- alert: OddsApiFailing
  expr: psuparlay_odds_api_last_call_ok == 0
  for: 5m
  labels: { severity: warning }
  annotations:
    summary: "Odds API calls failing ({{ $labels.error_code }})"
- alert: OddsApiMockModeInProd
  expr: psuparlay_odds_api_mock_mode == 1
  for: 15m
```

The call only happens every few hours, so the alert stays firing until the next successful refresh (or an admin manual refresh) clears the error.

### First Run

The first user to register becomes the admin. Everyone else needs an invite link — admins can generate these from the Admin panel.

## Stack

- **Backend:** Node.js + Express, SQLite (WAL mode)
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Auth:** JWT in httpOnly cookies, invite-only registration
- **Scores:** ESPN unofficial scoreboard API
- **Spreads:** [The Odds API](https://the-odds-api.com)
