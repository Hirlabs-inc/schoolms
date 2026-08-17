# Deploy (Docker + Traefik)

schoolms is a standard Next.js app (App Router) deployed as a Docker container behind
a Traefik reverse proxy (Coolify's `coolify-proxy` on the VPS) which issues Let's
Encrypt certs via the Cloudflare DNS-01 challenge. No static export / Netlify.

## Build the image
```
docker build -t schoolms:<tag> .
```

## Run (behind Traefik)
The container listens on `3000` (no host port — Traefik routes to it). Required env:
- `TURSO_URL`, `TURSO_TOKEN` — libSQL database (DB writes stay server-side)
- `JWT_SECRET` — signs/verifies login JWTs
- `PORT=3000`, `HOST=0.0.0.0`

Traefik labels (example for `trainify.hirlabs.com`):
```
traefik.enable=true
traefik.http.routers.https-0-<name>.entryPoints=https
traefik.http.routers.https-0-<name>.rule=Host(`trainify.hirlabs.com`) && PathPrefix(`/`)
traefik.http.routers.https-0-<name>.tls.certresolver=letsencrypt
traefik.http.routers.https-0-<name>.tls=true
traefik.http.services.https-0-<name>.loadbalancer.server.port=3000
traefik.http.routers.http-0-<name>.entryPoints=http
traefik.http.routers.http-0-<name>.middlewares=redirect-to-https
traefik.http.routers.http-0-<name>.rule=Host(`trainify.hirlabs.com`) && PathPrefix(`/`)
```
The container must be on the `coolify` network so Traefik can reach it.

## DNS
Add an A record for the subdomain (e.g. `trainify.hirlabs.com` -> VPS IP). Traefik's
Cloudflare DNS-01 resolver auto-issues the cert.

## Why not static export
`output: 'export'` is intentionally NOT used: the app has server API routes
(`app/api/db`, `app/api/auth/*`) that the client depends on for DB access and login.
Those run in the container, keeping the DB token + JWT secret server-side.
