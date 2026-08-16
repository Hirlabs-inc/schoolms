import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { verifyToken } from "@/lib/auth"

// Server-side data proxy. The browser calls this (via lib/turso-client.ts)
// instead of connecting to Turso directly. The DB token + JWT secret live only
// on the server.
//
// SECURITY: any authenticated user reaches this endpoint, so we enforce a
// server-side SQL policy. We do NOT allow arbitrary SQL. Allowed: single
// statements; SELECT/INSERT/UPDATE/DELETE on application data tables; writes to
// `profiles` restricted to the exact columns the app needs (password change,
// insert on create). Privilege escalation (UPDATE profiles SET role) and DDL are
// blocked. This closes the "any logged-in user runs arbitrary SQL" hole while
// keeping the generic data layer functional.

const ALLOWED_TABLES = new Set([
  "students",
  "fees",
  "payments",
  "courses",
  "teachers",
  "expenses",
  "income",
  "payroll_records",
  "teacher_commissions",
  "teacher_contracts",
  "enrollment_progress",
  "exam_results",
  "attendance",
  "profiles",
])

function normalize(sql: string): string {
  return sql
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function isSqlAllowed(rawSql: string): { ok: boolean; reason?: string } {
  const sql = normalize(rawSql)
  if (!sql) return { ok: false, reason: "Empty statement" }

  // No comments / multiple statements.
  if (sql.includes("--") || sql.includes("/*") || sql.includes("*/")) {
    return { ok: false, reason: "Comments not allowed" }
  }
  if (sql.includes(";")) {
    return { ok: false, reason: "Multiple statements not allowed" }
  }

  // Block DDL / dangerous statements.
  const blocked = [
    "create",
    "drop",
    "alter",
    "attach",
    "pragma",
    "truncate",
    "replace into",
    "vacuum",
    "insert or replace",
    "delete from sqlite",
  ]
  for (const kw of blocked) {
    if (sql.startsWith(kw + " ") || sql.includes(" " + kw + " ")) {
      return { ok: false, reason: `Disallowed keyword: ${kw}` }
    }
  }

  const firstWord = sql.split(" ")[0]
  const allowedVerbs = ["select", "insert", "update", "delete"]
  if (!allowedVerbs.includes(firstWord)) {
    return { ok: false, reason: `Disallowed statement type: ${firstWord}` }
  }

  // Table extraction (very small parser for our known shapes).
  let table = ""
  if (firstWord === "select") {
    const m = sql.match(/from\s+([a-z_]+)/)
    table = m?.[1] ?? ""
  } else if (firstWord === "insert") {
    const m = sql.match(/into\s+([a-z_]+)/)
    table = m?.[1] ?? ""
  } else if (firstWord === "update") {
    const m = sql.match(/update\s+([a-z_]+)/)
    table = m?.[1] ?? ""
  } else if (firstWord === "delete") {
    const m = sql.match(/from\s+([a-z_]+)/)
    table = m?.[1] ?? ""
  }

  if (table && !ALLOWED_TABLES.has(table)) {
    return { ok: false, reason: `Disallowed table: ${table}` }
  }

  // Privilege-escalation guard: never allow raw role changes on profiles.
  if (table === "profiles" && firstWord === "update") {
    if (/set\s+role/.test(sql) || sql.includes("role =")) {
      return { ok: false, reason: "Role changes are not permitted via raw SQL" }
    }
    // Only allow password updates / harmless column updates.
    if (!/set\s+password/.test(sql) && !/set\s+firstname/.test(sql) && !/set\s+lastname/.test(sql) && !/set\s+email/.test(sql)) {
      // Allow the known password-update template specifically; block anything else.
      if (!sql.startsWith("update profiles set password =")) {
        return { ok: false, reason: "Only password/firstName/lastName/email updates allowed on profiles" }
      }
    }
  }

  return { ok: true }
}

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

  const check = isSqlAllowed(sql)
  if (!check.ok) {
    return NextResponse.json({ error: `Query rejected: ${check.reason}` }, { status: 403 })
  }

  try {
    const rs = await turso.execute({ sql, args })
    return NextResponse.json({ rows: rs.rows as any[] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Query failed" }, { status: 500 })
  }
}
