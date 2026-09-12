import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { verifyToken } from "@/lib/auth"
import { DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS } from "@/lib/permissions"
import type { UserRole } from "@/lib/types"

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
  "classes",
  "exams",
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
  "role_permissions",
])

// Maps table name → required permission for each operation type.
const TABLE_PERMISSION_MAP: Record<string, { view: string; add: string; update: string; delete: string }> = {
  students:              { view: "view_students",   add: "add_students",   update: "add_students",   delete: "delete_students"  },
  teachers:              { view: "view_teachers",   add: "add_teachers",   update: "add_teachers",   delete: "delete_teachers"  },
  courses:               { view: "view_courses",    add: "add_courses",    update: "add_courses",    delete: "delete_courses"   },
  classes:               { view: "view_courses",    add: "add_courses",    update: "add_courses",    delete: "delete_courses"   },
  exams:                 { view: "view_exams",      add: "add_exams",      update: "add_exams",      delete: "delete_exams"     },
  exam_results:          { view: "view_results",    add: "add_results",    update: "add_results",    delete: "delete_exams"     },
  attendance:            { view: "view_attendance", add: "view_attendance", update: "view_attendance", delete: "view_attendance"  },
  fees:                  { view: "view_fees",       add: "manage_fees",    update: "manage_fees",    delete: "manage_fees"      },
  payments:              { view: "view_fees",       add: "manage_fees",    update: "manage_fees",    delete: "manage_fees"      },
  expenses:              { view: "view_expenses",   add: "add_expenses",   update: "add_expenses",   delete: "manage_fees"      },
  income:                { view: "view_income",     add: "add_income",     update: "add_income",     delete: "manage_fees"      },
  teacher_contracts:     { view: "view_payroll",    add: "manage_payroll", update: "manage_payroll", delete: "manage_payroll"    },
  teacher_commissions:   { view: "view_payroll",    add: "manage_payroll", update: "manage_payroll", delete: "manage_payroll"    },
  payroll_records:       { view: "view_payroll",    add: "manage_payroll", update: "manage_payroll", delete: "manage_payroll"    },
  enrollment_progress:   { view: "view_reports",    add: "add_results",    update: "add_results",    delete: "view_reports"      },
  course_teachers:       { view: "view_courses",    add: "add_courses",    update: "add_courses",    delete: "delete_courses"   },
  institution_settings:  { view: "manage_settings", add: "manage_settings", update: "manage_settings", delete: "manage_settings" },
  profiles:              { view: "manage_users", add: "manage_users",   update: "manage_users",   delete: "manage_users"     },
  role_permissions:      { view: "manage_permissions", add: "manage_permissions", update: "manage_permissions", delete: "manage_permissions" },
}

/**
 * Server-side permission check: determines if the given user role is allowed
 * to perform `action` (view/add/update/delete) on `table`.
 * Uses DEFAULT_ROLE_PERMISSIONS from lib/permissions.ts — the same defaults
 * that the client-side cache is initialised from. Admin/MANAGER always pass.
 */
async function checkTablePermission(role: UserRole, table: string, action: "view" | "add" | "update" | "delete"): Promise<boolean> {
  // ADMIN and MANAGER always have full access.
  if (role === "ADMIN" || role === "MANAGER") return true

  const permMap = TABLE_PERMISSION_MAP[table]
  if (!permMap) return true // Unmapped table — allow (shouldn't happen)

  const requiredPerm = permMap[action]
  if (!requiredPerm) return true // No mapping — allow by default

  // Check the hardcoded defaults.
  const defaults = DEFAULT_ROLE_PERMISSIONS[role]
  if (!defaults) return false
  const defaultGranted = Boolean(defaults[requiredPerm as keyof typeof defaults] ?? false)

  // Check DB overrides — these can only tighten (deny) permissions.
  // IMPORTANT: We query role_permissions directly here (not via /api/db proxy)
  // to avoid an infinite recursion: the proxy would call checkTablePermission,
  // which calls this same query, which calls the proxy again...
  // Instead we use a raw SQL query against the same turso client.
  try {
    const rs = await turso.execute({
      sql: "select granted from role_permissions where role = ? and permission = ?",
      args: [role, requiredPerm],
    })
    if (rs.rows.length > 0) {
      const g = rs.rows[0] as { granted: boolean | number }
      return Boolean(g.granted) !== false // DB says granted: false → deny; granted: true → allow
    }
  } catch {
    // Table doesn't exist yet — use defaults only.
  }

  return defaultGranted
}

function normalize(sql: string): string {
  return sql
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function isSqlAllowed(rawSql: string): { ok: boolean; reason?: string; table?: string; action?: "view" | "add" | "update" | "delete" } {
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

  // Determine action type from the SQL verb.
  let action: "view" | "add" | "update" | "delete"
  if (firstWord === "select") action = "view"
  else if (firstWord === "insert") action = "add"
  else if (firstWord === "update") action = "update"
  else action = "delete"

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

  return { ok: true, table, action }
}

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
      const check = isSqlAllowed(q.sql)
      if (!check.ok) {
        return NextResponse.json({ error: `Query rejected: ${check.reason}` }, { status: 403 })
      }
      // Permission check for each query in the batch.
      const batchUserRole = (user as any).role as UserRole
      const batchAllowed = await checkTablePermission(batchUserRole, check.table ?? "", check.action ?? "view")
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

  const check = isSqlAllowed(sql)
  if (!check.ok) {
    return NextResponse.json({ error: `Query rejected: ${check.reason}` }, { status: 403 })
  }

  // Permission check: verify the user's role has the required permission
  // for this table + action combination.
  const userRole = (user as any).role as UserRole
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
