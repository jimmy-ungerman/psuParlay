# Bugbot review rules

This is a small invite-only college football pick tracker. Flag behavior bugs. Ignore formatting, naming, and missing tests unless a change breaks an existing test.

## Auth

- Flag a new or changed route that reads or writes user data without `requireAuth`.
- Flag admin actions (invites, password reset, odds refresh, odds quota, link-admin) that are not behind `requireAdmin`.
- Login, register, invite validation, `/healthz`, `/readyz`, `/api/health`, and `/api/status` are public on purpose. Do not flag those for missing auth.
- Auth is a JWT in an httpOnly cookie. Do not ask for Authorization headers or localStorage tokens.

## Picks and grading

- A user gets one pick per week. The game is first-to-claim. Picks must be Saturday games and must lock at 11:30 AM ET via `getPickDeadline`.
- Grade and display the line from `games.home_spread` or `games.total` through `currentLine`. Do not suggest storing the line on the pick again. `spread_at_pick` was removed on purpose.
- Spreads and totals must stop updating once the pick deadline has passed. Flag a change that writes `home_spread` or `total` for a game whose deadline is already over.

## External APIs and probes

- `/healthz`, `/readyz`, `/api/health`, and `/api/status` must not call ESPN or The Odds API. A failed external feed must not fail liveness, and must not fail readiness except for the SQLite `SELECT 1` check.
- Flag a new The Odds API call. The free tier is 500 credits a month. Seeding is throttled. The admin refresh route is the only on-demand call.
- Do not flag mock mode. An empty `ODDS_API_KEY` is a supported configuration.

## Data

- SQL goes through `query()` in `src/db/index.js` with `$1` placeholders. Flag string-concatenated SQL.
- Schema changes belong in `src/db/index.js` startup migrations. Flag a change that edits `schema.sql` and assumes existing databases will pick it up. `CREATE TABLE IF NOT EXISTS` does not add columns.
- Do not log passwords, password hashes, JWTs, or `ODDS_API_KEY`.
