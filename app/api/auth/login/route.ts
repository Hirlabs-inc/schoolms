import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { verifyPassword, createToken } from "@/lib/auth"

// POST /api/auth/login  { email, password }

// Simple in-memory brute-force protection (per process). Keyed by email+IP.
// Blocks after 5 failed attempts for 15 minutes. For multi-instance deploys,
// replace with Redis/upstash.
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function rateKey(email: string, ip: string): string {
  return `${email.toLowerCase()}|${ip}`
}

function checkRateLimit(key: string): { allowed: boolean; retryAfter?: number } {
  const rec = attempts.get(key)
  if (!rec) return { allowed: true }
  if (Date.now() > rec.resetAt) {
    attempts.delete(key)
    return { allowed: true }
  }
  if (rec.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.ceil((rec.resetAt - Date.now()) / 1000) }
  }
  return { allowed: true }
}

function registerFailure(key: string) {
  const now = Date.now()
  const rec = attempts.get(key)
  if (rec && now <= rec.resetAt) {
    rec.count += 1
  } else {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
  }
}

function registerSuccess(key: string) {
  attempts.delete(key)
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = (body.email ?? "").trim().toLowerCase()
  const password = body.password ?? ""

  // Input validation.
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
  }

  const key = rateKey(email, clientIp(req))
  const limit = checkRateLimit(key)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 60) } }
    )
  }

  const rs = await turso.execute({
    sql: "select id, email, password, role, firstName, lastName from profiles where email = ?",
    args: [email],
  })
  if (rs.rows.length === 0) {
    registerFailure(key)
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }
  const row: any = rs.rows[0]
  const valid = await verifyPassword(password, row.password as string)
  if (!valid) {
    registerFailure(key)
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  registerSuccess(key)
  const user = {
    id: row.id as string,
    email: row.email as string,
    role: row.role as "ADMIN" | "TEACHER" | "STUDENT" | "SECRETARY" | "MANAGER",
    firstName: row.firstName as string,
    lastName: row.lastName as string,
  }
  const token = await createToken(user)
  return NextResponse.json({ token, user })
}
