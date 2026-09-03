import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { verifyToken, verifyPassword, hashPassword } from "@/lib/auth"

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t === "" ? null : t
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// GET /api/auth/me  (Authorization: Bearer <token>)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await verifyToken(token)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rs = await turso.execute({
    sql: "select id, email, role, firstName, lastName from profiles where id = ?",
    args: [user.id],
  })
  if (rs.rows.length === 0) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const row: any = rs.rows[0]
  return NextResponse.json({
    user: {
      id: row.id as string,
      email: row.email as string,
      role: row.role as "ADMIN" | "TEACHER" | "STUDENT",
      firstName: row.firstName as string,
      lastName: row.lastName as string,
    },
  })
}

// PATCH /api/auth/me  { firstName?, lastName?, email?, currentPassword?, newPassword? }
// Self-service: a logged-in user updates their OWN profile. Changing the email
// or password requires the current password.
export async function PATCH(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const actor = await verifyToken(token)
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const firstName = clean(body.firstName)
  const lastName = clean(body.lastName)
  const rawEmail = clean(body.email)
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

  const wantsName = body.firstName !== undefined || body.lastName !== undefined
  const wantsEmail = rawEmail !== null
  const wantsPassword = body.newPassword !== undefined && newPassword !== ""

  if (!wantsName && !wantsEmail && !wantsPassword) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }
  if (firstName === null || lastName === null) {
    return NextResponse.json({ error: "First and last name are required" }, { status: 400 })
  }

  // Pull the current record (including hash) to enforce the current-password check.
  const rs = await turso.execute({
    sql: "select id, email, password, role from profiles where id = ?",
    args: [actor.id],
  })
  if (rs.rows.length === 0) return NextResponse.json({ error: "Account not found" }, { status: 404 })
  const row: any = rs.rows[0]

  let email = row.email as string
  if (wantsEmail) {
    email = (rawEmail as string).toLowerCase()
    if (!isEmail(email)) return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    if (email !== row.email) {
      const dup = await turso.execute({
        sql: "select id from profiles where email = ? and id != ?",
        args: [email, actor.id],
      })
      if (dup.rows.length > 0) return NextResponse.json({ error: "That email is already in use" }, { status: 409 })
    }
  }

  if (newPassword && newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  }

  // Changing credentials requires the current password.
  if (wantsPassword || (wantsEmail && email !== row.email)) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 })
    }
    const valid = await verifyPassword(currentPassword, row.password as string)
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }
  }

  const updates: Record<string, any> = {}
  if (body.firstName !== undefined) updates.firstname = firstName
  if (body.lastName !== undefined) updates.lastname = lastName
  if (wantsEmail) updates.email = email
  if (wantsPassword) updates.password = await hashPassword(newPassword)

  const cols = Object.keys(updates)
  if (cols.length) {
    const setSql = cols.map((c) => `${c} = ?`).join(", ")
    await turso.execute({
      sql: `update profiles set ${setSql} where id = ?`,
      args: [...cols.map((c) => updates[c]), actor.id],
    })
  }

  return NextResponse.json({
    success: true,
    user: {
      id: actor.id,
      email,
      role: row.role,
      firstName: updates.firstname ?? actor.firstName,
      lastName: updates.lastname ?? actor.lastName,
    },
  })
}
