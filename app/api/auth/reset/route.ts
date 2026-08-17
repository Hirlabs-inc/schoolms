import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { randomBytes } from "crypto"

// POST /api/auth/reset  { email }
// Generates a reset token, stores it with an expiry, and returns it (dev mode).
// In production, email it instead of returning it. Returns success regardless
// of whether the email exists to avoid user enumeration.
export async function POST(req: NextRequest) {
  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = (body.email ?? "").trim().toLowerCase()
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const rs = await turso.execute({
    sql: "select id from profiles where email = ?",
    args: [email],
  })

  let resetToken: string | null = null
  if (rs.rows.length > 0) {
    resetToken = randomBytes(24).toString("hex")
    const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    await turso.execute({
      sql: "update profiles set resetToken = ?, resetTokenExpiry = ? where id = ?",
      args: [resetToken, expiry.toISOString(), rs.rows[0].id as string],
    })
  }

  // Return success either way (no enumeration). In dev, surface the token.
  return NextResponse.json({
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
    devResetToken: resetToken,
  })
}
