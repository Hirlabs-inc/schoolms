import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { verifyPassword, createToken, setStoredToken } from "@/lib/auth"

// POST /api/auth/login  { email, password }
export async function POST(req: NextRequest) {
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

  const rs = await turso.execute({
    sql: "select id, email, password, role, firstName, lastName from profiles where email = ?",
    args: [email],
  })
  if (rs.rows.length === 0) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }
  const row: any = rs.rows[0]
  const valid = await verifyPassword(password, row.password as string)
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  const user = {
    id: row.id as string,
    email: row.email as string,
    role: row.role as "ADMIN" | "TEACHER" | "STUDENT",
    firstName: row.firstName as string,
    lastName: row.lastName as string,
  }
  const token = await createToken(user)
  return NextResponse.json({ token, user })
}
