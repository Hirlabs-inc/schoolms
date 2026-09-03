#!/usr/bin/env bash
# deploy.sh — deploy the latest trainify image to this VPS.
# Run manually or from CI. Container gets env from the coolify app .env file.
set -euo pipefail

REGISTRY='ghcr.io'
IMAGE='ghcr.io/hirlabs-inc/schoolms:trainify-latest'
CONTAINER='trainify-schoolms'
ENV_FILE='/data/coolify/applications/trainify-schoolms/.env'
PORT='3006'

log() { echo "[2026-09-03 12:00:10] "; }

log "▶ Pulling latest image..."\ndocker pull ""

log "▶ Stopping + removing old container..."\ndocker stop "" 2>/dev/null || true
docker rm   "" 2>/dev/null || true

log "▶ Starting new container on port ..."\ndocker run -d   --name ""   --network coolify   --restart unless-stopped   -p ":3000"   --env-file ""   ""

sleep 4

log "▶ Recent logs:"\ndocker logs "" --tail 8

if curl -sf http://localhost:/ > /dev/null 2>&1; then
  log "✔ OK — trainify live on port "\nelse
  log "⚠ WARNING — health check failed, check logs with: docker logs "\n  exit 1\nfi
