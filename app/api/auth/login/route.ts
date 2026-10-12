import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { verifyPassword, createToken, SESSION_COOKIE, sessionCookieOptions, isSameOrigin } from "@/lib/auth"
import { checkLimit, registerHit, clearLimit, clientIp } from "@/lib/rate-limit"
import { logAudit } from "@/lib/audit"

// POST /api/auth/login  { email, password }
//
// On success the JWT is set as an httpOnly session cookie (never returned to the
// browser), so XSS cannot read it. Rate limited by email+IP and by IP alone.

const MAX_ATTEMPTS = 5
const MAX_IP_ATTEMPTS = 20
const WINDOW_MS = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = (body.email ?? "").trim().toLowerCase()
  const password = body.password ?? ""

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
  }

  const ip = clientIp(req)
  const emailKey = `login:${email}|${ip}`
  const ipKey = `login-ip:${ip}`
  const emailLimit = checkLimit(emailKey, MAX_ATTEMPTS)
  const ipLimit = checkLimit(ipKey, MAX_IP_ATTEMPTS)
  if (!emailLimit.allowed || !ipLimit.allowed) {
    const retryAfter = Math.max(emailLimit.retryAfter ?? 0, ipLimit.retryAfter ?? 0) || 60
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const rs = await turso.execute({
    sql: "select id, email, password, role, firstName, lastName from profiles where email = ?",
    args: [email],
  })
  const row: any = rs.rows[0]
  const valid = row ? await verifyPassword(password, row.password as string) : false
  if (!valid) {
    registerHit(emailKey, WINDOW_MS)
    registerHit(ipKey, WINDOW_MS)
    await logAudit(null, "login.failed", { details: { email, ip } })
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  clearLimit(emailKey)
  clearLimit(ipKey)

  const user = {
    id: row.id as string,
    email: row.email as string,
    role: row.role as "ADMIN" | "TEACHER" | "STUDENT" | "SECRETARY" | "MANAGER",
    firstName: row.firstName as string,
    lastName: row.lastName as string,
  }
  const token = await createToken(user)
  await logAudit(user, "login.success", { details: { ip } })

  const res = NextResponse.json({ user })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  return res
}
