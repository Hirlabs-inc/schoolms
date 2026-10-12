import "server-only"
import type { NextRequest } from "next/server"

// Process-wide rate limiter. The bucket store lives on globalThis so it is not
// re-created per Next.js server chunk. NOTE: this is per-process — behind PM2
// cluster / multiple instances use a shared store (Redis/Upstash) instead.

interface Bucket {
  count: number
  resetAt: number
}

declare global {
  // eslint-disable-next-line no-var
  var __trainifyRateBuckets: Map<string, Bucket> | undefined
}

function store(): Map<string, Bucket> {
  if (!globalThis.__trainifyRateBuckets) globalThis.__trainifyRateBuckets = new Map()
  return globalThis.__trainifyRateBuckets
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}

/** Check whether `key` is currently blocked (does not increment). */
export function checkLimit(key: string, max: number): { allowed: boolean; retryAfter?: number } {
  const rec = store().get(key)
  if (!rec || Date.now() > rec.resetAt) return { allowed: true }
  if (rec.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((rec.resetAt - Date.now()) / 1000) }
  }
  return { allowed: true }
}

/** Record one event against `key` (e.g. a failed login). */
export function registerHit(key: string, windowMs: number): void {
  const now = Date.now()
  const rec = store().get(key)
  if (rec && now <= rec.resetAt) rec.count += 1
  else store().set(key, { count: 1, resetAt: now + windowMs })
}

/** Clear a key (e.g. after a successful login). */
export function clearLimit(key: string): void {
  store().delete(key)
}
