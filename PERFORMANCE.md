# Performance Guide — Trainify School Management System

This app talks to Postgres through a single server route (`/api/db`) that every
client DB call goes through. That design is secure (the DB token never reaches
the browser) but it means **each client query is one HTTP request to the app
server, which then runs one or more SQL queries**. Slow production usually comes
from a combination of: many round-trips, missing indexes, and per-query overhead.

## Fixes already applied

| Change | Why it helps |
| --- | --- |
| Indexes on all hot columns (`studentid`, `courseid`, `feeid`, `teacherid`, …) in `scripts/schema.postgres.sql` | Postgres does **not** index foreign keys automatically; without these, `where studentId = ?` is a full table scan. Apply with `npm run db:migrate`. |
| Permission overrides loaded **once per request** in `/api/db` (`getRolePermissionOverrides` + `checkTablePermissionWithOverrides`) | Previously every SQL statement ran an extra `select … from role_permissions` query. |
| Postgres pool is a `globalThis` singleton with `max: 10` and timeouts | Next.js can load a module in several server chunks; without this you can open multiple pools and exhaust connections. |
| Payroll no longer recomputes all commissions on page load | Recompute is O(enrollments) HTTP round-trips. It now runs only on the explicit **Refresh** button. |

## Recommended next steps (in order of impact)

### 1. Apply the schema (indexes) on the server
```bash
npm run db:migrate
```
Idempotent — safe to run on an existing database.

### 2. Keep the app server and Postgres close
If `DATABASE_URL` points to a **remote** host, every query pays network latency
(and TLS). Host Postgres on the same machine/VPC as the app, or use a unix
socket (`postgresql://user:pw@/db?host=/var/run/postgresql`).

### 3. Reduce round-trips for bulk reads
`getItems()` already batches enrichment into a single `/api/db` request, but
several pages still make many sequential calls. Options:
- Combine related reads into one `turso.batch([...])` call.
- Move multi-step flows (enrollment + charge + commission) into a single server
  route so they are one round-trip instead of 5–10.

### 4. Server-side pagination
All list tables load the **entire** table and paginate in the browser. As data
grows this dominates load time. Recommended: add `limit`/`offset` (or keyset)
support to `getItems` and the `/api/db` route, and page on the server. Start
with the largest tables: `fees`, `payments`, `enrollment_progress`,
`teacher_commissions`, `attendance`.

### 5. Avoid `select *` on large tables
`getItems()` runs `select * from <table>`. Prefer explicit column lists for big
tables so you don't ship unused columns (e.g. notes/blobs) over the wire.

### 6. Cache what rarely changes
- `institution_settings`, `courses`, `teachers`, and `role_permissions` change
  infrequently. Cache them in the server process (short TTL) or on the client
  context to avoid refetching on every page.
- Commission summaries can be materialised into a small table and refreshed on
  write instead of aggregated on every view.

### 7. PM2 / Node
- Fork mode with 1 instance is the safe default. If you scale to
  `instances: "max"` + `exec_mode: "cluster"`, raise the Postgres `max_connections`
  (or add PgBouncer) and keep pool `max` modest per instance.
- Set `NODE_ENV=production` (already in `ecosystem.config.cjs`).
- Watch `pm2 monit` / `max_memory_restart` restarts — frequent restarts hide leaks.

### 8. Postgres tuning & visibility
- Enable `pg_stat_statements` and look at the slowest queries:
  ```sql
  create extension if not exists pg_stat_statements;
  select calls, mean_exec_time, query from pg_stat_statements order by mean_exec_time desc limit 20;
  ```
- Run `ANALYZE;` after bulk imports so the planner has statistics.
- Typical small-VPS starting points (tune to RAM): `shared_buffers = 25% RAM`,
  `effective_cache_size = 50–75% RAM`, `work_mem = 8–16MB`.

### 9. Front-end
- The commission "Refresh" action recomputes; it can take a while on large data
  sets. Keep it user-initiated (as now) and show a spinner.
- Avoid loading every dropdown (all students/courses) at once on large data
  sets — use a searchable/remote-loaded select.

## Quick checklist for "it's slow"
1. `npm run db:migrate` (indexes present?).
2. Is Postgres local to the app? (latency)
3. `pg_stat_statements` — find the top slow query.
4. How many `/api/db` requests does the page make? (Network tab) — batch them.
5. Are you loading full tables? (server-side pagination)
