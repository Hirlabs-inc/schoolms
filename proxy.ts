import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Enforcing Content-Security-Policy for every response (Next 16 "proxy").
//
// NOTE: we intentionally do NOT use a nonce + 'strict-dynamic'. Next.js
// prerenders pages statically, and a per-request nonce cannot be injected into
// static HTML — enforcing it would block Next's own inline bootstrap scripts and
// blank the app. `script-src 'self' 'unsafe-inline'` keeps the app working while
// still restricting script/style/connect origins, blocking objects, framing and
// cross-site form posts. If you later make the app fully dynamic, switch to a
// nonce-based policy.
export function proxy(_req: NextRequest) {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")

  const res = NextResponse.next()
  res.headers.set("Content-Security-Policy", csp)
  return res
}

export const config = {
  // Run on pages (skip static assets / images).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
