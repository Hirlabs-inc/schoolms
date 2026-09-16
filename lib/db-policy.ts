import "server-only"
import { turso } from "./turso"
import { DEFAULT_ROLE_PERMISSIONS } from "./permissions"
import type { UserRole } from "./types"

// Server-side data proxy policy. The browser reaches the DB only through
// /api/db, so we enforce a strict SQL allowlist + per-role permission checks
// here. This module is intentionally free of Next.js request/response types so
// it can be unit-tested directly.

export const ALLOWED_TABLES = new Set([
  "students",
  "fees",
  "payments",
  "courses",
  "teachers",
  "classes",
  "expenses",
  "income",
  "payroll_records",
  "teacher_commissions",
  "teacher_contracts",
  "enrollment_progress",
  "course_teachers",
  "institution_settings",
  // Legacy table kept only so student deletion can still clean it up.
  "exam_results",
  "attendance",
  "profiles",
  "role_permissions",
])

export type SqlAction = "view" | "add" | "update" | "delete"
/** A single permission key, or several where any one is sufficient. */
export type PermissionRequirement = string | string[]

// Maps table name → required permission(s) for each operation type.
export const TABLE_PERMISSION_MAP: Record<string, Record<SqlAction, PermissionRequirement>> = {
  students:              { view: "view_students",   add: "add_students",   update: "add_students",   delete: "delete_students"  },
  teachers:              { view: "view_teachers",   add: "add_teachers",   update: "add_teachers",   delete: "delete_teachers"  },
  courses:               { view: "view_courses",    add: "add_courses",    update: "add_courses",    delete: "delete_courses"   },
  classes:               { view: "view_courses",    add: "add_courses",    update: "add_courses",    delete: "delete_courses"   },
  // Legacy exam results: only touched when deleting a student.
  exam_results:          { view: "view_students",   add: "add_students",   update: "add_students",   delete: "delete_students"  },
  attendance:            { view: "view_attendance", add: "view_attendance", update: "view_attendance", delete: "view_attendance"  },
  fees:                  { view: "view_fees",       add: "manage_fees",    update: "manage_fees",    delete: "manage_fees"      },
  payments:              { view: "view_fees",       add: "manage_fees",    update: "manage_fees",    delete: "manage_fees"      },
  expenses:              { view: "view_expenses",   add: "add_expenses",   update: "add_expenses",   delete: "manage_fees"      },
  income:                { view: "view_income",     add: "add_income",     update: "add_income",     delete: "manage_fees"      },
  teacher_contracts:     { view: "view_payroll",    add: "manage_payroll", update: "manage_payroll", delete: "manage_payroll"    },
  payroll_records:       { view: "view_payroll",    add: "manage_payroll", update: "manage_payroll", delete: "manage_payroll"    },
  // Enrollment records are written by student management (add_students) and by
  // the progress page (add_results). Either permission is sufficient.
  enrollment_progress:   { view: "view_reports",    add: ["add_results", "add_students"], update: ["add_results", "add_students"], delete: ["view_reports", "add_students"] },
  course_teachers:       { view: "view_courses",    add: "add_courses",    update: "add_courses",    delete: "delete_courses"   },
  // Institution settings are read by the finance flows (registration fee / tax
  // rate), so roles that view students or fees may read them.
  institution_settings:  { view: ["manage_settings", "view_fees", "view_students"], add: "manage_settings", update: "manage_settings", delete: "manage_settings" },
  // Profile name/email is read to display students/teachers/payments, and
  // written while editing students/teachers. Role escalation stays blocked in
  // isSqlAllowed. Deleting a student also removes their login profile.
  profiles:              { view: ["manage_users", "view_students", "view_teachers", "view_fees", "view_payroll", "view_expenses", "view_income", "view_reports", "view_courses", "view_dashboard"], add: "manage_users", update: ["manage_users", "add_students", "add_teachers"], delete: ["manage_users", "delete_students"] },
  // Commissions are created/removed as part of enrollment and student cleanup.
  teacher_commissions:   { view: ["view_payroll", "view_students"], add: ["manage_payroll", "add_students"], update: "manage_payroll", delete: ["manage_payroll", "delete_students"] },
  role_permissions:      { view: "manage_permissions", add: "manage_permissions", update: "manage_permissions", delete: "manage_permissions" },
}

/**
 * Resolve whether a role has a single permission, merging DB overrides on top
 * of the hardcoded defaults. A `granted = false` row explicitly denies.
 */
export async function roleHasPermission(role: UserRole, permission: string): Promise<boolean> {
  const defaults = DEFAULT_ROLE_PERMISSIONS[role]
  const defaultGranted = Boolean(defaults?.[permission as keyof typeof defaults] ?? false)

  try {
    const rs = await turso.execute({
      sql: "select granted from role_permissions where role = ? and permission = ?",
      args: [role, permission],
    })
    if (rs.rows.length > 0) {
      const g = rs.rows[0] as { granted: boolean | number }
      return Boolean(g.granted) !== false
    }
  } catch {
    // Table doesn't exist yet — use defaults only.
  }

  return defaultGranted
}

/**
 * Server-side permission check: is `role` allowed to perform `action` on
 * `table`? ADMIN and MANAGER always pass. A requirement may list several
 * permissions, in which case any one of them grants access.
 */
export async function checkTablePermission(
  role: UserRole,
  table: string,
  action: SqlAction
): Promise<boolean> {
  if (role === "ADMIN" || role === "MANAGER") return true

  const permMap = TABLE_PERMISSION_MAP[table]
  if (!permMap) return true // Unmapped table — allow (shouldn't happen)

  const required = permMap[action]
  if (!required) return true // No mapping — allow by default
  const requiredPerms = Array.isArray(required) ? required : [required]

  for (const perm of requiredPerms) {
    if (await roleHasPermission(role, perm)) return true
  }
  return false
}

function normalize(sql: string): string {
  return sql
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/** Columns a non-admin role may update on `profiles`. */
const PROFILE_WRITABLE_COLUMNS = ["password", "firstname", "lastname", "email"]

export function isSqlAllowed(
  rawSql: string,
  role?: UserRole
): { ok: boolean; reason?: string; table?: string; action?: SqlAction } {
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
  let action: SqlAction
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

  // Privilege-escalation guard: never allow raw role changes on profiles for
  // non-admin roles. Admin and MANAGER can still change roles. Non-admin roles
  // may only touch the columns the app legitimately edits.
  const isAdmin = role === "ADMIN" || role === "MANAGER"
  if (table === "profiles" && firstWord === "update" && !isAdmin) {
    if (/\brole\b/.test(sql)) {
      return { ok: false, reason: "Role changes are not permitted via raw SQL" }
    }
    const m = sql.match(/\bset\s+(.+?)\s+where\b/)
    const setClause = m?.[1] ?? ""
    const columns = setClause
      .split(",")
      .map((c) => c.split("=")[0].trim().replace(/"/g, "").replace(/^[a-z_]+\./, ""))
      .filter(Boolean)
    if (!columns.length || !columns.every((c) => PROFILE_WRITABLE_COLUMNS.includes(c))) {
      return { ok: false, reason: "Only password/firstName/lastName/email updates allowed on profiles" }
    }
  }

  return { ok: true, table, action }
}
