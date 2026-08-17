# Static deploy (Next.js static export + Netlify Functions)

Hybrid approach chosen for secure static hosting:
- `next build` with `output: 'export'` emits a pure static **`out/`** folder (all pages).
- The 4 API routes run as **Netlify Functions** under `netlify/functions/` and are
  served at `/.netlify/functions/<name>`. `netlify.toml` redirects `/api/*` →
  those functions, so the existing client calls (`/api/db`, `/api/auth/login`, …)
  keep working unchanged. The Turso token + JWT secret stay **server-side**.

## Build (produces the uploadable folder)
```
npm run build      # -> out/  (static site)  + netlify/functions (serverless API)
```

## Deploy to Netlify
**Option 1 — Git connect (recommended):** import the repo at app.netlify.com. The
`netlify.toml` sets `command = "next build"`, `publish = "out"`, and the function
directory. Set these env vars in Site settings → Environment variables:
- `TURSO_URL`     — libSQL database URL
- `TURSO_TOKEN`  — libSQL auth token (DB writes) — NEVER expose to the client
- `JWT_SECRET`   — signs/verifies login JWTs

**Option 2 — Drag-drop the `out/` folder** to Netlify Drop. The static UI uploads;
the `/api/*` functions still run because Netlify serves `netlify/functions/` from
the connected repo. (For a pure folder-drop without Git, the functions won't deploy
— connect the repo or use the CLI for the API to work.)

**Option 3 — CLI:** `netlify deploy --prod` (builds via the config and publishes both
static assets and functions).

## How the API routes map
| Client calls            | Netlify Function                      |
|-------------------------|---------------------------------------|
| `POST /api/db`          | `netlify/functions/db.ts`             |
| `POST /api/auth/login`  | `netlify/functions/auth/login.ts`     |
| `GET  /api/auth/me`     | `netlify/functions/auth/me.ts`        |
| `POST /api/auth/reset`  | `netlify/functions/auth/reset.ts`     |

The redirect `[[redirects]] from="/api/*" to="/.netlify/functions/:splat" status=200`
forwards method, headers, and body, so auth/JWT flow is unchanged.

## Notes
- `app/api/*` was removed on purpose: `output: 'export'` cannot statically export
  Next API routes, so they live as Netlify Functions instead.
- `next.config.mjs` has `images.unoptimized: true` (required for static export) and
  `output: 'export'`.
- The SPA fallback (`/*` → `/index.html`, `force=false`) only triggers on missing
  paths; existing static files and `/.netlify/functions/*` are served directly.
- For local dev with the functions, use `netlify dev` (runs functions) rather than
  `next dev` (which no longer has the API routes).

## Environment variables (functions only — never in the client bundle)
| Var           | Used by            | Notes                          |
|---------------|--------------------|--------------------------------|
| `TURSO_URL`   | lib/turso.ts       | libSQL database URL            |
| `TURSO_TOKEN` | lib/turso.ts       | libSQL auth token (DB writes) |
| `JWT_SECRET`  | lib/auth.ts        | signs/verifies login JWTs      |
