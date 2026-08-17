# Static deploy (prerendered pages + serverless API functions)

The app is already structured for a static deploy: every page is prerendered as
static content, and the 4 API routes (`/api/db`, `/api/auth/login`,
`/api/auth/me`, `/api/auth/reset`) run as serverless functions. No `output:
'export'` is used — that would delete the API routes. The browser reaches the
database only through `/api/db`, so the Turso token and JWT secret stay server-side.

## What the build produces
- `next build` marks all 17 pages as `○ (Static)` and all 4 API routes as
  `ƒ (Dynamic)`. Netlify/Vercel serve the pages from a CDN and the API routes as
  functions automatically.

## Option A — Netlify (zero-config with the plugin)
1. `netlify.toml` is committed (uses `@netlify/plugin-nextjs`).
2. Connect the repo at app.netlify.com → "Add new site" → import.
3. Build command: `next build` (auto from netlify.toml). Publish: `.next` (plugin-managed).
4. Set these **Function environment variables** (Site settings → Environment variables):
   - `TURSO_URL`        — your Turso database URL
   - `TURSO_TOKEN`     — your Turso auth token (DB writes) — NEVER expose to the client
   - `JWT_SECRET`      — secret used to sign login JWTs
5. Deploy. The UI is static; `/api/*` are functions.

## Option B — Vercel
1. `vercel.json` pins `framework: nextjs` (Vercel auto-detects Next.js regardless).
2. Import the repo at vercel.com. Build: `next build`, Output: `.next`.
3. Set the same Project Environment Variables: `TURSO_URL`, `TURSO_TOKEN`, `JWT_SECRET`.
4. Deploy.

## Option C — any static host (GitHub Pages / S3 / Cloudflare Pages static) — INSECRE
This requires `output: 'export'` PLUS moving the data layer fully client-side
(connecting to Turso directly from the browser with the token in the bundle).
That exposes the DB token to anyone via DevTools, letting them run arbitrary SQL.
Only acceptable for demo/non-sensitive data. Not configured here by default.

## Environment variables (all server-side / functions only)
| Var           | Used by            | Notes                                  |
|---------------|--------------------|----------------------------------------|
| `TURSO_URL`   | lib/turso.ts       | libSQL database URL                    |
| `TURSO_TOKEN` | lib/turso.ts       | libSQL auth token (DB writes)          |
| `JWT_SECRET`  | lib/auth.ts        | signs/verifies login JWTs              |

`.env.local` is git-ignored and must NOT be committed. Provide these via the
host's environment-variable UI, not in the repo.

## Local static preview
```
npm run build
npx serve .next   # or `npx superstatic .next` — pages are static; API routes need a function runtime
```
For a fully local check of the API routes, run `npm run dev` instead.
