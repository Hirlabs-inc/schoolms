/**
 * Role-Based Access Control (RBAC) for Trainify.
 *
 * Permissions map to concrete actions or page views. The admin can toggle
 * per-role grants from the /admin/permissions page. When a (role, permission)
 * pair has no explicit row in `role_permissions`, `DEFAULT_ROLE_PERMISSIONS`
 * is used as the fallback so the system is usable out-of-the-box.
 *
 * All DB access goes through the `turso` client (server-only) which mirrors
 * the libsql surface and transparently targets either Turso or Postgres.
 */

import "server-only"
import type { UserRole } from "./types"
import { turso } from "./turso"

// ---------------------------------------------------------------------------
// Permission definitions
// ---------------------------------------------------------------------------

/** Every permission the app knows about. */
export const ALL_PERMISSIONS = [
  // Dashboard
  { key: "view_dashboard",   label: "View Dashboard",        group: "General"  },
  // Students
  { key: "view_students",    label: "View Students",         group: "Students" },
  { key: "add_students",     label: "Add / Edit Students",   group: "Students" },
  { key: "delete_students",  label: "Delete Students",       group: "Students" },
  // Courses
  { key: "view_courses",     label: "View Courses",          group: "Courses"  },
  { key: "add_courses",      label: "Add / Edit Courses",    group: "Courses"  },
  { key: "delete_courses",   label: "Delete Courses",        group: "Courses"  },
  // Teachers
  { key: "view_teachers",    label: "View Teachers",         group: "Teachers" },
  { key: "add_teachers",     label: "Add / Edit Teachers",   group: "Teachers" },
  { key: "delete_teachers",  label: "Delete Teachers",       group: "Teachers" },
  // Fees / Finance
  { key: "view_fees",        label: "View Fees",             group: "Finance"  },
  { key: "manage_fees",      label: "Manage Fees",           group: "Finance"  },
  { key: "view_expenses",    label: "View Expenses",         group: "Finance"  },
  { key: "add_expenses",     label: "Add / Edit Expenses",   group: "Finance"  },
  { key: "view_income",      label: "View Income",           group: "Finance"  },
  { key: "add_income",       label: "Add / Edit Income",     group: "Finance"  },
  { key: "view_payroll",     label: "View Payroll",          group: "Finance"  },
  { key: "manage_payroll",   label: "Manage Payroll",        group: "Finance"  },
  // Reports
  { key: "view_reports",     label: "View Reports",          group: "Reports"  },
  // Users / Settings / Tools
  { key: "manage_users",     label: "Manage Users",          group: "Admin"    },
  { key: "view_backup",      label: "View Backup",           group: "Admin"    },
  { key: "manage_settings",  label: "Manage Settings",       group: "Admin"    },
  { key: "manage_permissions", label: "Manage Permissions",  group: "Admin"    },
  // Exams
  { key: "view_exams",       label: "View Exams",            group: "Academics"},
  { key: "add_exams",        label: "Add / Edit Exams",      group: "Academics"},
  { key: "view_results",     label: "View Exam Results",     group: "Academics"},
  { key: "add_results",      label: "Add / Edit Results",    group: "Academics"},
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]["key"]

// ---------------------------------------------------------------------------
// Defaults — applied when no explicit row exists for (role, permission).
// Mirrors the behaviour hardcoded in app/admin/layout.tsx + lib/api.ts.
// ---------------------------------------------------------------------------

function _defaults(): Record<UserRole, Record<Permission, boolean>> {
  const base: Record<Permission, boolean> = Object.fromEntries(
    ALL_PERMISSIONS.map((p) => [p.key, true])
  ) as Record<Permission, boolean>

  const admin: Record<Permission, boolean> = { ...base } // full access

  const manager: Record<Permission, boolean> = { ...base }

  const secretary: Record<Permission, boolean> = {
    ...base,
    view_dashboard:       true,
    view_students:        true,
    add_students:         true,
    delete_students:      false,
    view_courses:         true,
    add_courses:          false,
    delete_courses:       false,
    view_teachers:        false,
    add_teachers:         false,
    delete_teachers:      false,
    view_fees:            true,
    manage_fees:          false,
    view_expenses:        true,
    add_expenses:         false,
    view_income:          true,
    add_income:           false,
    view_payroll:         true,
    manage_payroll:       false,
    view_reports:         true,
    manage_users:         false,
    view_backup:          false,
    manage_settings:      false,
    manage_permissions:   false,
    view_exams:           true,
    add_exams:            false,
    view_results:         true,
    add_results:          false,
  }

  // TEACHER and STUDENT get only what their layouts currently expose.
  const teacher: Record<Permission, boolean> = Object.fromEntries(
    ALL_PERMISSIONS.map((p) => [p.key, false])
  ) as Record<Permission, boolean>

  const student: Record<Permission, boolean> = { ...teacher }

  return {
    ADMIN: admin,
    MANAGER: manager,
    SECRETARY: secretary,
    TEACHER: teacher,
    STUDENT: student,
  }
}

export const DEFAULT_ROLE_PERMISSIONS = _defaults()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Roles that can use the admin area at all. */
export const ADMIN_ROLES: UserRole[] = ["ADMIN", "MANAGER", "SECRETARY"]

/**
 * Returns the effective permission set for a role by merging the DB
 * (`role_permissions` table) on top of the hardcoded defaults.
 * A row with `granted = false` explicitly denies even a default-true perm.
 */
export async function getRolePermissions(role: UserRole): Promise<Set<Permission>> {
  const perms = new Set<Permission>()
  const defaults = DEFAULT_ROLE_PERMISSIONS[role]

  // Start from defaults.
  for (const p of ALL_PERMISSIONS) {
    if (defaults[p.key as Permission]) perms.add(p.key as Permission)
  }

  // Apply DB overrides.
  try {
    const rs = await turso.execute({
      sql: "select permission, granted from role_permissions where role = ?",
      args: [role],
    })
    for (const row of rs.rows as Array<{ permission: string; granted: boolean | number }>) {
      const key = row.permission as Permission
      if (!ALL_PERMISSIONS.some((p) => p.key === key)) continue
      if (row.granted) {
        perms.add(key)
      } else {
        perms.delete(key)
      }
    }
  } catch (e) {
    // If the table doesn't exist yet (fresh Postgres / first deploy),
    // fall back to defaults.
    void e
  }

  return perms
}

/** True when `role` has the given permission (DB overrides + defaults). */
export async function hasPermission(role: UserRole, permission: Permission): Promise<boolean> {
  const perms = await getRolePermissions(role)
  return perms.has(permission)
}

/** Bulk fetch for all roles — used by the permissions UI. */
export async function getAllRolePermissions(): Promise<
  Array<{ role: UserRole; permission: Permission; granted: boolean }>
> {
  const result: Array<{ role: UserRole; permission: Permission; granted: boolean }> = []

  for (const role of [...ADMIN_ROLES, "TEACHER", "STUDENT"] as UserRole[]) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role]
    for (const p of ALL_PERMISSIONS) {
      const key = p.key as Permission
      // Start with the default.
      let granted = defaults[key] ?? false

      try {
        const rs = await turso.execute({
          sql: "select granted from role_permissions where role = ? and permission = ?",
          args: [role, key],
        })
        if (rs.rows.length > 0) {
          const g = rs.rows[0] as { granted: boolean | number }
          granted = Boolean(g.granted)
        }
      } catch {
        // table may not exist yet; use default.
      }

      result.push({ role, permission: key, granted })
    }
  }

  return result
}

/** Set (or unset) a single permission for a role. */
export async function setRolePermission(
  role: UserRole,
  permission: Permission,
  granted: boolean
): Promise<void> {
  await turso.execute({
    sql: "insert into role_permissions (role, permission, granted) values (?, ?, ?) on conflict (role, permission) do update set granted = excluded.granted",
    args: [role, permission, granted ? 1 : 0],
  })
}

/** Reset a role's permissions to defaults (delete all explicit overrides). */
export async function resetRolePermissions(role: UserRole): Promise<void> {
  await turso.execute({
    sql: "delete from role_permissions where role = ?",
    args: [role],
  })
}
