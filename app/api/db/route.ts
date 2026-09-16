import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { verifyToken } from "@/lib/auth"
import { checkTablePermission, isSqlAllowed } from "@/lib/db-policy"
import type { UserRole } from "@/lib/types"

// Server-side data proxy. The browser calls this (via lib/turso-client.ts)
// instead of connecting to Turso directly. The DB token + JWT secret live only
// on the server.
//
// SECURITY: any authenticated user reaches this endpoint, so we enforce a
// server-side SQL policy (see lib/db-policy.ts). We do NOT allow arbitrary SQL.
// Allowed: single statements; SELECT/INSERT/UPDATE/DELETE on application data
// tables; writes to `profiles` restricted to the exact columns the app needs
// (password change, name/email edits on student/teacher management). Privilege
// escalation (UPDATE profiles SET role) and DDL are blocked.

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  const user = token ? await verifyToken(token) : null
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { sql?: string; args?: any[]; queries?: Array<{ sql: string; args?: any[] }> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const userRole = (user as any).role as UserRole

  // Batched execution: { queries: [{ sql, args }, ...] } runs every statement in
  // a single round trip. Each statement is validated with the same policy.
  if (Array.isArray(body.queries)) {
    if (body.queries.length === 0) {
      return NextResponse.json({ results: [] })
    }
    const results: Array<{ rows: any[] }> = []
    for (const q of body.queries) {
      if (!q || typeof q.sql !== "string" || !q.sql.trim()) {
        return NextResponse.json({ error: "Invalid query in batch" }, { status: 400 })
      }
      const check = isSqlAllowed(q.sql, userRole)
      if (!check.ok) {
        return NextResponse.json({ error: `Query rejected: ${check.reason}` }, { status: 403 })
      }
      const batchAllowed = await checkTablePermission(userRole, check.table ?? "", check.action ?? "view")
      if (!batchAllowed) {
        return NextResponse.json({ error: `Forbidden: insufficient permission for ${check.table ?? "unknown"} ${check.action ?? "view"}` }, { status: 403 })
      }
      const args = Array.isArray(q.args) ? q.args : []
      try {
        const rs = await turso.execute({ sql: q.sql, args })
        results.push({ rows: rs.rows as any[] })
      } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? "Query failed" }, { status: 500 })
      }
    }
    return NextResponse.json({ results })
  }

  const sql = body.sql
  const args = Array.isArray(body.args) ? body.args : []
  if (!sql || typeof sql !== "string") {
    return NextResponse.json({ error: "Missing sql" }, { status: 400 })
  }

  const check = isSqlAllowed(sql, userRole)
  if (!check.ok) {
    return NextResponse.json({ error: `Query rejected: ${check.reason}` }, { status: 403 })
  }

  // Permission check: verify the user's role has the required permission
  // for this table + action combination.
  const table = check.table ?? ""
  const action = check.action ?? "view"
  const allowed = await checkTablePermission(userRole, table, action)
  if (!allowed) {
    return NextResponse.json({ error: `Forbidden: insufficient permission for ${table} ${action}` }, { status: 403 })
  }

  try {
    const rs = await turso.execute({ sql, args })
    return NextResponse.json({ rows: rs.rows as any[] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Query failed" }, { status: 500 })
  }
}
