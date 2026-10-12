import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { randomBytes, createHash } from "crypto"
import { isSameOrigin } from "@/lib/auth"
import { checkLimit, registerHit, clientIp } from "@/lib/rate-limit"
import { logAudit } from "@/lib/audit"

// POST /api/auth/reset  { email }
//
// Generates a single-use reset token, stores only its SHA-256 hash + expiry, and
// delivers the link via PASSWORD_RESET_WEBHOOK (if configured). The token is
// NEVER returned in production. Always responds with success to avoid account
// enumeration.

const WINDOW_MS = 15 * 60 * 1000

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = (body.email ?? "").trim().toLowerCase()
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const ip = clientIp(req)
  const ipKey = `reset-ip:${ip}`
  if (!checkLimit(ipKey, 10).allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }
  registerHit(ipKey, WINDOW_MS)

  const rs = await turso.execute({
    sql: "select id from profiles where email = ?",
    args: [email],
  })

  const isProd = process.env.NODE_ENV === "production"
  let devToken: string | null = null

  if (rs.rows.length > 0) {
    const rawToken = randomBytes(32).toString("hex")
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
    await turso.execute({
      sql: "update profiles set resetToken = ?, resetTokenExpiry = ? where id = ?",
      args: [hashToken(rawToken), expiry, rs.rows[0].id as string],
    })

    const baseUrl = process.env.APP_URL || req.nextUrl.origin
    const resetUrl = `${baseUrl}/update-password?token=${rawToken}`
    const webhook = process.env.PASSWORD_RESET_WEBHOOK
    if (webhook) {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, resetUrl }),
        })
      } catch {
        // delivery failure must not leak whether the account exists
      }
    } else if (!isProd) {
      console.warn(`[auth] password reset link (dev): ${resetUrl}`)
    }

    if (!isProd) devToken = rawToken
    await logAudit(null, "password.reset.requested", { details: { email } })
  }

  return NextResponse.json({
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
    ...(devToken ? { devResetToken: devToken } : {}),
  })
}
