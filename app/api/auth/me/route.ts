import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { verifyToken } from "@/lib/auth"

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
