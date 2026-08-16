import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { verifyToken } from "@/lib/auth"

// Server-side data proxy. The browser calls this (via lib/turso-client.ts)
// instead of connecting to Turso directly. The DB token + JWT secret live only
// on the server.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  const user = token ? await verifyToken(token) : null
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { sql?: string; args?: any[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const sql = body.sql
  const args = Array.isArray(body.args) ? body.args : []
  if (!sql || typeof sql !== "string") {
    return NextResponse.json({ error: "Missing sql" }, { status: 400 })
  }

  // Disallow multiple statements to reduce injection/abuse surface.
  if (sql.split(";").filter((s) => s.trim().length > 0).length > 1) {
    return NextResponse.json({ error: "Multiple statements not allowed" }, { status: 400 })
  }

  try {
    const rs = await turso.execute({ sql, args })
    return NextResponse.json({ rows: rs.rows as any[] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Query failed" }, { status: 500 })
  }
}
