# Deployment Guide — Trainify School Management System

## 1. Environment

Create `.env.local` on the server with:

```
TURSO_URL=libsql://your-instance.turso.io
TURSO_TOKEN=your-turso-auth-token
JWT_SECRET=<a long random string, e.g. openssl rand -base64 48>
# optional:
NEXT_PUBLIC_TEXTBEE_API_KEY=your-textbee-key
```

> ⚠️ `JWT_SECRET` is **mandatory in production**. The app refuses to start if it is missing
> when `NODE_ENV=production`. Generate a strong value and keep it secret.

> If you prefer a local database instead of Turso, set `TURSO_URL=file:./prod.db` and
> `TURSO_TOKEN=` (empty). Run `npm run db:push` / apply the SQL migrations in `*.sql`
> to initialize the schema.

## 2. Build & Run (Node)

```bash
npm install
npm run build
NODE_ENV=production npm run start
# serves on PORT (default 3000)
```

Run behind a reverse proxy (nginx / Caddy) with TLS:

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Real-IP $remote_addr;
}
```

For process supervision use `pm2`:

```bash
pm2 start "npm run start" --name trainify --env production
pm2 save
```

## 3. Docker (optional)

```bash
docker build -t trainify .
docker run -d --name trainify -p 3000:3000 \
  -e TURSO_URL=... -e TURSO_TOKEN=... -e JWT_SECRET=... \
  trainify
```

## 4. First Run / Seeding

- The app auto-creates the schema on first DB connection if using the bundled migrations.
- Create the first admin user via the seed route or directly in the DB (`profiles` with `role='ADMIN'`,
  hashed password).
- Log in and configure institution settings, courses, and teachers.

## 5. Security Checklist (pre-launch)

- [ ] `JWT_SECRET` set to a strong random value (not the dev default).
- [ ] `.env.local` is present on the server and **not** in git.
- [ ] Served over HTTPS (reverse proxy TLS).
- [ ] `NODE_ENV=production`.
- [ ] Database backups configured (Turso provides point-in-time backups).
- [ ] Rate limiting is acceptable; consider Redis-backed limiting for multi-instance.
