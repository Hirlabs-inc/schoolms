#!/usr/bin/env bash
# deploy-pm2.sh — build the latest code and (re)start the app under PM2.
#
# Usage (on the server, from the project directory):
#   ./deploy-pm2.sh
#
# Assumes: node + npm + pm2 installed, and .env.local present with
# DATABASE_URL (or TURSO_URL/TURSO_TOKEN) and JWT_SECRET.
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="trainify"

echo "▶ Installing dependencies..."
npm ci

# Load DATABASE_URL from .env.local so the schema migration can run.
if [ -z "${DATABASE_URL:-}" ] && [ -f .env.local ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- || true)"
  export DATABASE_URL
fi

if [ -n "${DATABASE_URL:-}" ]; then
  echo "▶ Applying database schema (idempotent)..."
  node scripts/migrate-postgres.mjs
fi

echo "▶ Building..."
npm run build

echo "▶ Starting/reloading under PM2..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "✔ Deployed. Check status with: pm2 status"
