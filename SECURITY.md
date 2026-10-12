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

## Recommendations — implemented

1. **Password reset is now complete and secure.** `POST /api/auth/reset` stores
   only a SHA-256 hash of a single-use token (1h expiry) and never returns it in
   production; the link is delivered via `PASSWORD_RESET_WEBHOOK`. New
   `POST /api/auth/reset/confirm` verifies the token + expiry, sets the password
   and clears the token. The `/update-password` page consumes `?token=`.
2. **JWT moved out of `localStorage`.** `/api/auth/login` sets an httpOnly,
   Secure (prod), SameSite=Lax cookie (`trainify_session`); `/api/auth/logout`
   clears it. The client keeps only a non-secret marker. Server routes resolve
   the session from the cookie (or a Bearer token for API clients).
3. **SMS key is server-only.** Renamed `NEXT_PUBLIC_TEXTBEE_API_KEY` →
   `TEXTBEE_API_KEY`; `lib/sms.ts` is now `server-only`.
4. **Shared rate limiter** (`lib/rate-limit.ts`, `globalThis`-backed) used by
   login (email+IP and IP-only) and password reset.
5. **Password policy:** minimum length raised to 10 across server validations.
6. **Raw reads narrowed:** non-managers may not `SELECT *` or read
   `password`/`resetToken` columns from `profiles` via `/api/db`.
7. **Audit log:** `audit_log` table + `lib/audit.ts`; records logins, user
   create/update/delete, permission changes and password resets.
8. **CSP** via `proxy.ts` (enforcing). Scripts allow `'unsafe-inline'` because
   Next prerenders pages statically (a per-request nonce can't be injected into
   static HTML); switch to a nonce policy if the app is made fully dynamic.
9. **Lateral escalation closed:** non-admins can only change their *own*
   password through the data proxy, and may not target ADMIN/MANAGER rows.
10. **Server-side seeder:** `/api/dev/seed` (404 in production) replaces the
    client-side bcrypt seeding.

## Further hardening (not yet done)
- Shared rate-limit store (Redis/Upstash) for multi-instance deployments.
- Real email delivery for password resets (currently a webhook hook).
- Breached-password check; optional 2FA for admins.
- Alerting on repeated login failures / admin changes.

## Historical findings (fixed)

**Critical**
1. Password-reset token disclosed in the API response (fixed).
2. Privilege escalation via the raw-SQL proxy — a non-admin could edit an ADMIN
   profile/password (fixed).

**High**
3. Demo seeder exposed in production (fixed).
4. Missing security headers (fixed).
5. Stored XSS in the printable receipt (fixed).

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
