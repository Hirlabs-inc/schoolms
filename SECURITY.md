# Security Audit — Trainify School Management System

Date: 2026-09 · Scope: application code, API routes, auth/RBAC and DB proxy.

## Architecture / trust model
- The browser never talks to the database directly. Every DB call goes through
  `POST /api/db`, which **verifies the JWT**, applies a **SQL allow-list**
  (`lib/db-policy.ts`) and a **per-table/action permission check** (role
  defaults overridden by the `role_permissions` table).
- Client-side checks (`AuthGuard`, `usePermissions`, the sidebar) are UX only —
  the server is the enforcement point. This is correct.
- Auth is a signed JWT (HS256, 7-day expiry) issued by `/api/auth/login`.

## Findings

### Critical — fixed

**1. Password-reset token disclosed in the API response**
`POST /api/auth/reset` returned `devResetToken` in the JSON body for **any**
email. Anyone could request a reset for a victim's address and receive the token
→ account takeover.
Fix: the token is only returned when `NODE_ENV !== "production"`. (See
"Remaining work" — the reset flow itself is still incomplete.)

**2. Privilege escalation via the raw-SQL proxy**
`/api/db` allowed roles with `add_students`/`add_teachers` to run
`UPDATE profiles SET password = ? WHERE id = ?` (and email/name). Because the
target row was not restricted, a secretary could set a new password on an
**ADMIN** row and take over the account.
Fix: for non-admin actors, an `UPDATE profiles` whose target id belongs to an
`ADMIN`/`MANAGER` row is rejected (403).

### High — fixed

**3. Demo seeder exposed in production**
`/seed` creates accounts with known passwords (`admin@school.edu` / `admin123`,
…). The page now refuses to run when `NODE_ENV=production` and shows a notice.
Also: remove/rotate those demo accounts in production.

**4. Missing security headers**
Added via `next.config.mjs`: `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (camera/mic/geo off), `Strict-Transport-Security`.

**5. Stored XSS in the printable receipt**
`handlePrintReceipt` wrote student names and payment notes into a **same-origin**
popup via `document.write` without escaping → script injection that can read the
JWT from `localStorage`. Values are now HTML-escaped (`escapeHtml`).

## Remaining work / recommendations

Ordered by risk.

1. **Finish or remove the password reset.** The token is generated and stored
   (`profiles.resetToken` / `resetTokenExpiry`) but never consumed — the
   `/update-password` page resets the *current session's* password instead. If
   you keep it: add a `POST /api/auth/reset/[token]` that verifies the token +
   expiry, is single-use, and emails the link (never returns it).
2. **Move the JWT out of `localStorage`.** Any XSS can read it. Prefer an
   httpOnly + Secure + SameSite=Lax cookie set by `/api/auth/login`, and a
   `/api/auth/logout`. (While tokens live in `localStorage`, XSS = full account
   compromise.)
3. **Server-only SMS key.** `NEXT_PUBLIC_TEXTBEE_API_KEY` is compiled into the
   client bundle. It is currently unused (so not yet exposed), but rename it to
   `TEXTBEE_API_KEY` and only read it from a server route. Update `.env.example`
   / `DEPLOYMENT.md`.
4. **Rate limiting is per-process.** The login limiter is an in-memory `Map`
   keyed by email+IP; behind PM2 cluster or multiple instances it is bypassable
   and unbounded (memory growth). Use Redis/Upstash and also limit by IP alone.
5. **Password policy.** Minimum is 6 characters with no complexity or breach
   checks. Enforce length ≥ 10 and consider a breached-password check.
6. **Narrow raw reads.** A role with `view_students` can `SELECT * FROM profiles`
   (all names/emails/roles) through `/api/db`. Consider column/row restrictions
   or dedicated, narrowly-scoped read endpoints for the enrichment queries.
7. **Admin audit log.** No record of who changed roles/permissions, reset
   passwords, or edited finances. Add an append-only audit table.
8. **Content-Security-Policy.** Not set (Next injects inline scripts). Add a
   nonce-based CSP at the reverse proxy.
9. **Account lockout / alerting.** Add lockout or alerting on repeated failed
   logins and on admin-account changes.
10. **Client-side hashing.** `bcryptjs` is bundled for the `/seed` page. Hashing
    belongs on the server; the seeder should call an API route.

## Good practices already in place
- Parameterized SQL everywhere; no string interpolation of user input into SQL.
- Passwords hashed with bcrypt (cost 10); `current password` required to change
  email/password via `/api/auth/me`.
- Role defaults + DB overrides; `role_permissions` has no default-admin backdoor.
- Last-admin protection (can't demote/delete the final admin), self-role and
  self-delete guards, ADMIN-only management of ADMIN accounts.
- `JWT_SECRET` required in production; secrets kept server-side.
- No `eval`/`new Function`/`child_process`; the only `dangerouslySetInnerHTML`
  is a static chart style tag.

## Dependency audit
`npm audit` went from 1 critical / 15 high / 3 moderate to 1 dev-only chain
(Next.js upgraded to 16.4.0; see the deps commit).
