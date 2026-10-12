import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { createHash } from "crypto"
import { isSameOrigin, hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// POST /api/auth/reset/confirm  { token, newPassword }
//
// Verifies a single-use reset token (stored as a SHA-256 hash with an expiry),
// sets the new password and clears the token.

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: { token?: string; newPassword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""
  if (!token) return NextResponse.json({ error: "Reset token required" }, { status: 400 })
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 })
  }

  const rs = await turso.execute({
    sql: "select id, resetTokenExpiry from profiles where resetToken = ?",
    args: [hashToken(token)],
  })
  if (rs.rows.length === 0) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })
  }
  const row: any = rs.rows[0]
  const expiry = row.resetTokenExpiry ? new Date(row.resetTokenExpiry as string) : null
  if (!expiry || expiry.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })
  }

  const passwordHash = await hashPassword(newPassword)
  await turso.execute({
    sql: "update profiles set password = ?, resetToken = null, resetTokenExpiry = null where id = ?",
    args: [passwordHash, row.id as string],
  })

  await logAudit({ id: row.id as string, email: "", role: "STUDENT", firstName: "", lastName: "" }, "password.reset.completed", {
    targetType: "profile",
    targetId: row.id as string,
  })

  return NextResponse.json({ success: true })
}
