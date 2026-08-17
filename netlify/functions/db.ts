// Netlify Function: /api/db  (POST)
// Server-side data proxy. Mirrors app/api/db/route.ts. The browser reaches this
// via the /api/* -> /.netlify/functions/:splat redirect in netlify.toml.
// DB token + JWT secret stay server-side (never shipped to the client).
import { turso } from "../../../lib/turso"
import { verifyToken } from "../../../lib/auth"

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
  "course_teachers",
  "institution_settings",
  "exam_results",
  "attendance",
  "profiles",
])

function normalize(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase()
}

function isSqlAllowed(rawSql: string): { ok: boolean; reason?: string } {
  const sql = normalize(rawSql)
  if (!sql) return { ok: false, reason: "Empty statement" }
  if (sql.includes("--") || sql.includes("/*") || sql.includes("*/")) {
    return { ok: false, reason: "Comments not allowed" }
  }
  if (sql.includes(";")) {
    return { ok: false, reason: "Multiple statements not allowed" }
  }
  const blocked = [
    "create", "drop", "alter", "attach", "pragma", "truncate",
    "replace into", "vacuum", "insert or replace", "delete from sqlite",
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
  let table = ""
  if (firstWord === "select") {
    const m = sql.match(/from\s+([a-z_]+)/); table = m?.[1] ?? ""
  } else if (firstWord === "insert") {
    const m = sql.match(/into\s+([a-z_]+)/); table = m?.[1] ?? ""
  } else if (firstWord === "update") {
    const m = sql.match(/update\s+([a-z_]+)/); table = m?.[1] ?? ""
  } else if (firstWord === "delete") {
    const m = sql.match(/from\s+([a-z_]+)/); table = m?.[1] ?? ""
  }
  if (table && !ALLOWED_TABLES.has(table)) {
    return { ok: false, reason: `Disallowed table: ${table}` }
  }
  if (table === "profiles" && firstWord === "update") {
    if (/set\s+role/.test(sql) || sql.includes("role =")) {
      return { ok: false, reason: "Role changes are not permitted via raw SQL" }
    }
    if (!/set\s+password/.test(sql) && !/set\s+firstname/.test(sql) && !/set\s+lastname/.test(sql) && !/set\s+email/.test(sql)) {
      if (!sql.startsWith("update profiles set password =")) {
        return { ok: false, reason: "Only password/firstName/lastName/email updates allowed on profiles" }
      }
    }
  }
  return { ok: true }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } })
  }
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null
  const user = token ? await verifyToken(token) : null
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }
  let body: { sql?: string; args?: any[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
  const sql = body.sql
  const args = Array.isArray(body.args) ? body.args : []
  if (!sql || typeof sql !== "string") {
    return new Response(JSON.stringify({ error: "Missing sql" }), { status: 400, headers: { "Content-Type": "application/json" } })
  }
  const check = isSqlAllowed(sql)
  if (!check.ok) {
    return new Response(JSON.stringify({ error: `Query rejected: ${check.reason}` }), { status: 403, headers: { "Content-Type": "application/json" } })
  }
  try {
    const rs = await turso.execute({ sql, args })
    return new Response(JSON.stringify({ rows: rs.rows as any[] }), { status: 200, headers: { "Content-Type": "application/json" } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Query failed" }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
}
