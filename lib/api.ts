import { turso } from "./turso-client"
import { hashPassword, verifyPassword, getStoredToken, setStoredToken, clearStoredToken } from "./auth-client"
import type {
  UserRole, IncomeCategory, ExpenseCategory, Payment, Fee, TeacherCommissionSummary,
  FeeType, LedgerEntry, LedgerEntryType, StudentLedger,
} from "./types"

// --- Auth (client talks to server route handlers; secrets stay server-side) ---

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    let msg = "Invalid email or password"
    try { const j = await res.json(); if (j?.error) msg = j.error } catch {}
    throw new Error(msg)
  }
  const data = await res.json()
  setStoredToken(data.token)
  if (data.user) {
    try { localStorage.setItem("currentUser", JSON.stringify(data.user)) } catch {}
  }
  return data.user
}

export async function logout() {
  clearStoredToken()
}

export async function getCurrentUser() {
  const token = getStoredToken()
  if (!token) return null
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) { clearStoredToken(); return null }
    const data = await res.json()
    return data.user
  } catch {
    clearStoredToken()
    return null
  }
}

export async function updatePassword(newPassword: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Not authenticated")
  const hash = await hashPassword(newPassword)
  await turso.execute({ sql: "update profiles set password = ? where id = ?", args: [hash, user.id] })
  return true
}

// --- Admin user management (staff accounts) ---
// Talks to the dedicated /api/admin/users endpoints which enforce role rules
// and cascading deletes server-side (bypasses the generic /api/db SQL policy).

async function apiRequest<T = any>(path: string, method: string, body?: any): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let data: any = {}
  try {
    data = await res.json()
  } catch {
    // non-JSON response — fall through to status-based error
  }
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }
  return data as T
}

export function adminCreateUser(input: Record<string, any>) {
  return apiRequest("/api/admin/users", "POST", input)
}

export function adminUpdateUser(id: string, patch: Record<string, any>) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(id)}`, "PATCH", patch)
}

export function adminDeleteUser(id: string) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(id)}`, "DELETE")
}

// --- Permissions management ---
export async function fetchRolePermissions(role: string) {
  const token = getStoredToken()
  const res = await fetch(`/api/admin/permissions/${role}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
  return res.json() as Promise<{ role: string; permissions: Array<{ permission: string; label: string; group: string; granted: boolean }> }>
}

export async function saveRolePermissions(role: string, updates: Array<{ permission: string; granted: boolean }>) {
  const token = getStoredToken()
  const res = await fetch("/api/admin/permissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ updates: updates.map((u) => ({ role, ...u })) }),
  })
  if (!res.ok) throw new Error(`Save failed: ${res.status}`)
  return res.json()
}

export async function resetRolePermissions(role: string) {
  const token = getStoredToken()
  const res = await fetch(`/api/admin/permissions/${role}`, {
    method: "DELETE",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`)
  return res.json()
}

// Self-service profile update for the logged-in user (name/email/password).
export async function updateMyProfile(input: {
  firstName?: string
  lastName?: string
  email?: string
  currentPassword?: string
  newPassword?: string
}): Promise<{ success: boolean; user: any }> {
  return apiRequest("/api/auth/me", "PATCH", input)
}

// --- Generic CRUD ---

const TABLE_MAP: Record<string, string> = {
  users: "profiles",
  students: "students",
  teachers: "teachers",
  classes: "classes",
  courses: "courses",
  attendance: "attendance",
  fees: "fees",
  payments: "payments",
  expenses: "expenses",
  income: "income",
  teacherContracts: "teacher_contracts",
  payrollRecords: "payroll_records",
  enrollmentProgress: "enrollment_progress",
  courseTeachers: "course_teachers",
  institutionSettings: "institution_settings",
  profiles: "profiles",
}

type CrudAction = "view" | "add" | "update" | "delete"
type PermissionRequirement = string | string[]

/**
 * Maps (tableKey, action) → permission key(s). An array means "any of these
 * permissions is sufficient". Used by CRUD functions to enforce per-action RBAC.
 */
const KEY_PERMISSION_MAP: Record<string, Record<CrudAction, PermissionRequirement>> = {
  students:         { view: "view_students",   add: "add_students",   update: "add_students",   delete: "delete_students"  },
  teachers:         { view: "view_teachers",   add: "add_teachers",   update: "add_teachers",   delete: "delete_teachers"  },
  courses:          { view: "view_courses",    add: "add_courses",    update: "add_courses",    delete: "delete_courses"   },
  attendance:       { view: "view_attendance", add: "view_attendance", update: "view_attendance", delete: "view_attendance"},
  fees:             { view: "view_fees",       add: "manage_fees",    update: "manage_fees",    delete: "manage_fees"      },
  payments:         { view: "view_fees",       add: "manage_fees",    update: "manage_fees",    delete: "manage_fees"      },
  expenses:         { view: "view_expenses",   add: "add_expenses",   update: "add_expenses",   delete: "manage_fees"      },
  income:           { view: "view_income",     add: "add_income",     update: "add_income",     delete: "manage_fees"      },
  teacherContracts: { view: "view_payroll",    add: "manage_payroll", update: "manage_payroll", delete: "manage_payroll"    },
  payrollRecords:   { view: "view_payroll",    add: "manage_payroll", update: "manage_payroll", delete: "manage_payroll"    },
  // Enrollment records are created as part of student management (add_students)
  // and maintained on the progress page (add_results). Either grants access.
  enrollmentProgress: { view: "view_reports", add: ["add_results", "add_students"], update: ["add_results", "add_students"], delete: ["view_reports", "add_students"] },
  courseTeachers:   { view: "view_courses",    add: "add_courses",    update: "add_courses",    delete: "delete_courses"   },
  institutionSettings: { view: "manage_settings", add: "manage_settings", update: "manage_settings", delete: "manage_settings" },
  users:            { view: "manage_users",    add: "manage_users",   update: "manage_users",   delete: "manage_users"     },
  // Profile name/email edits are part of the student/teacher management flows,
  // so any role that can add students or teachers may perform them (the server
  // still blocks role escalation).
  profiles:         { view: "manage_users",    add: "manage_users",   update: ["manage_users", "add_students", "add_teachers"], delete: "manage_users" },
}

/**
 * In-memory permission cache so we don't hit the API on every CRUD call.
 * Refreshed when the user changes or when explicitly cleared.
 */
let _permCache: Map<string, boolean> | null = null
let _permCacheRole: string | null = null

async function checkKeyPermission(key: string, action: "view" | "add" | "update" | "delete"): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error("Authentication required")
  // ADMIN always has all permissions.
  if (user.role === "ADMIN") return

  const permMap = KEY_PERMISSION_MAP[key]
  if (!permMap) return // Unknown key — no permission gate (legacy behaviour)

  const required = permMap[action]
  if (!required) return // No mapping — allow by default
  const requiredPerms = Array.isArray(required) ? required : [required]

  // Lazily build the cache from the permissions API.
  // The API merges DB overrides on top of DEFAULT_ROLE_PERMISSIONS.
  if (_permCacheRole !== user.role || !_permCache) {
    const res = await fetch(`/api/admin/permissions/${user.role}`, {
      headers: { Authorization: `Bearer ${getStoredToken() || ""}` },
    })
    if (res.ok) {
      const data = await res.json()
      // The endpoint returns { role, permissions: [...] }, but tolerate a bare
      // array too so an older/newer server shape never breaks CRUD.
      const list: Array<{ permission: string; granted: boolean }> = Array.isArray(data)
        ? data
        : (data?.permissions ?? [])
      _permCache = new Map(list.map((p) => [p.permission, p.granted]))
    } else {
      // If the API fails, fall back to deny-all for non-admin roles.
      _permCache = new Map()
    }
    _permCacheRole = user.role
  }

  const granted = requiredPerms.some((p) => _permCache!.get(p))
  if (!granted) {
    throw new Error(`Forbidden: missing permission '${requiredPerms.join("' or '")}'`)
  }
}

/** Clear the in-memory permission cache so the next CRUD call re-fetches. */
export function clearPermissionCache() {
  _permCache = null
  _permCacheRole = null
}

function isAuthenticated() {
  return !!getStoredToken()
}

function requireAuth() {
  if (!isAuthenticated()) throw new Error("Authentication required")
}

export async function requireRole(roles: string[]) {
  const u = await getCurrentUser()
  if (!u || !roles.includes(u.role)) throw new Error("Forbidden: insufficient role")
  return u
}

export const canManageFinance = (u: any) => u && ["ADMIN", "MANAGER", "SECRETARY"].includes(u.role)
export const canManageSettings = (u: any) => u && ["ADMIN", "MANAGER"].includes(u.role)
export const isAdmin = (u: any) => u && u.role === "ADMIN"

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((v): v is string => !!v)))
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ")
}

function indexRows(rows: any[]): Map<string, any> {
  const m = new Map<string, any>()
  for (const r of rows) m.set(r.id, r)
  return m
}

export async function getItems<T>(key: string): Promise<T[]> {
  requireAuth()
  await checkKeyPermission(key, "view")
  const table = TABLE_MAP[key]
  if (!table) throw new Error(`Unknown key: ${key}`)

  // Fetch the table once, then batch all lookups (profiles, courses, ...) into a
  // single HTTP round trip using IN clauses. This avoids the previous N+1
  // pattern where every row triggered its own round trip (the cause of the slow
  // page loads).
  const rs = await turso.execute(`select * from ${table}`)
  const rows = rs.rows as any[]

  if (key === "students") {
    const profileIds = uniqueIds(rows.map((r) => r.profileId || r.id))
    const courseIds = uniqueIds(rows.map((r) => r.courseId))
    const batchQueries: Array<{ sql: string; args: any[] }> = []
    if (profileIds.length) {
      batchQueries.push({
        sql: `select id, firstName, lastName, email from profiles where id in (${placeholders(profileIds.length)})`,
        args: profileIds,
      })
    }
    if (courseIds.length) {
      batchQueries.push({
        sql: `select id, name from courses where id in (${placeholders(courseIds.length)})`,
        args: courseIds,
      })
    }
    const results = batchQueries.length ? await turso.batch(batchQueries) : []
    const profileMap = indexRows(results[0]?.rows ?? [])
    const courseMap = indexRows(results[1]?.rows ?? [])
    return rows.map((row) => {
      const p = profileMap.get(row.profileId || row.id)
      const c = row.courseId ? courseMap.get(row.courseId) : null
      return {
        ...row,
        firstName: row.firstName || p?.firstName || null,
        lastName: row.lastName || p?.lastName || null,
        email: row.email || p?.email || null,
        courseName: c?.name,
      }
    }) as T[]
  }

  if (key === "teachers") {
    const ids = uniqueIds(rows.map((r) => r.id))
    const batchQueries: Array<{ sql: string; args: any[] }> = []
    if (ids.length) {
      batchQueries.push({
        sql: `select id, firstName, lastName, email from profiles where id in (${placeholders(ids.length)})`,
        args: ids,
      })
    }
    const results = batchQueries.length ? await turso.batch(batchQueries) : []
    const profileMap = indexRows(results[0]?.rows ?? [])
    return rows.map((row) => {
      const p = profileMap.get(row.id)
      return {
        ...row,
        firstName: row.firstName || p?.firstName || null,
        lastName: row.lastName || p?.lastName || null,
        email: row.email || p?.email || null,
      }
    }) as T[]
  }

  if (key === "payments") {
    // Resolve each studentId -> profileId (students.profileId, falling back to
    // the student id itself for legacy login students).
    const studentIds = uniqueIds(rows.map((r) => r.studentId))
    let studentProfileMap = new Map<string, string>()
    if (studentIds.length) {
      const stuRs = await turso.execute({
        sql: `select id, profileId from students where id in (${placeholders(studentIds.length)})`,
        args: studentIds,
      })
      studentProfileMap = new Map(
        (stuRs.rows as any[]).map((r) => [r.id, r.profileId])
      )
    }
    const profileIds = uniqueIds(
      rows.map((r) => (r.studentId ? studentProfileMap.get(r.studentId) || r.studentId : null))
    )
    const batchQueries: Array<{ sql: string; args: any[] }> = []
    if (profileIds.length) {
      batchQueries.push({
        sql: `select id, firstName, lastName, email from profiles where id in (${placeholders(profileIds.length)})`,
        args: profileIds,
      })
    }
    const results = batchQueries.length ? await turso.batch(batchQueries) : []
    const profileMap = indexRows(results[0]?.rows ?? [])
    return rows.map((row) => {
      if (!row.studentId) {
        return { ...row, firstName: null, lastName: null, email: row.email || null }
      }
      const pId = studentProfileMap.get(row.studentId) || row.studentId
      const p = profileMap.get(pId)
      return {
        ...row,
        firstName: p?.firstName ?? null,
        lastName: p?.lastName ?? null,
        email: p?.email ?? row.email ?? null,
      }
    }) as T[]
  }

  if (key === "fees") {
    const courseIds = uniqueIds(rows.map((r) => r.courseId))
    const studentIds = uniqueIds(rows.map((r) => r.studentId))
    const batchQueries: Array<{ sql: string; args: any[] }> = []
    let courseIdx = -1
    let studentIdx = -1
    if (courseIds.length) {
      courseIdx = batchQueries.length
      batchQueries.push({
        sql: `select id, name from courses where id in (${placeholders(courseIds.length)})`,
        args: courseIds,
      })
    }
    if (studentIds.length) {
      studentIdx = batchQueries.length
      batchQueries.push({
        sql: `select id, profileId, firstName, lastName, email from students where id in (${placeholders(studentIds.length)})`,
        args: studentIds,
      })
    }
    const results = batchQueries.length ? await turso.batch(batchQueries) : []
    const courseMap = courseIdx >= 0 ? indexRows(results[courseIdx]?.rows ?? []) : new Map<string, any>()
    const studentRows = studentIdx >= 0 ? (results[studentIdx]?.rows ?? []) : []
    const studentMap = indexRows(studentRows)

    // Fall back to profiles for legacy students whose name columns are empty
    // (login students may store their profile under the student id itself).
    const profileIds = uniqueIds([
      ...studentRows.map((s: any) => s.profileId || s.id),
      ...studentIds,
    ])
    let profileMap = new Map<string, any>()
    if (profileIds.length) {
      const prs = await turso.execute({
        sql: `select id, firstName, lastName, email from profiles where id in (${placeholders(profileIds.length)})`,
        args: profileIds,
      })
      profileMap = indexRows(prs.rows)
    }

    return rows.map((row) => {
      const s = studentMap.get(row.studentId)
      const p = profileMap.get(s?.profileId || row.studentId)
      return {
        ...row,
        courseName: row.courseId ? courseMap.get(row.courseId)?.name : undefined,
        firstName: s?.firstName || p?.firstName || null,
        lastName: s?.lastName || p?.lastName || null,
        email: s?.email || p?.email || null,
      }
    }) as T[]
  }

  if (key === "expenses" || key === "income") {
    const ids = uniqueIds(rows.map((r) => r.createdBy))
    const batchQueries: Array<{ sql: string; args: any[] }> = []
    if (ids.length) {
      batchQueries.push({
        sql: `select id, firstName, lastName from profiles where id in (${placeholders(ids.length)})`,
        args: ids,
      })
    }
    const results = batchQueries.length ? await turso.batch(batchQueries) : []
    const profileMap = indexRows(results[0]?.rows ?? [])
    return rows.map((row) => {
      const p = row.createdBy ? profileMap.get(row.createdBy) : null
      return { ...row, firstName: p?.firstName, lastName: p?.lastName }
    }) as T[]
  }

  if (key === "teacherContracts" || key === "payrollRecords") {
    const ids = uniqueIds(rows.map((r) => r.teacherId))
    const batchQueries: Array<{ sql: string; args: any[] }> = []
    if (ids.length) {
      batchQueries.push({
        sql: `select id, firstName, lastName from profiles where id in (${placeholders(ids.length)})`,
        args: ids,
      })
    }
    const results = batchQueries.length ? await turso.batch(batchQueries) : []
    const profileMap = indexRows(results[0]?.rows ?? [])
    return rows.map((row) => {
      const p = profileMap.get(row.teacherId)
      return {
        ...row,
        teacherName: p ? `${p.firstName} ${p.lastName}` : "Unknown",
      }
    }) as T[]
  }

  if (key === "enrollmentProgress") {
    const studentIds = uniqueIds(rows.map((r) => r.studentId))
    const courseIds = uniqueIds(rows.map((r) => r.courseId))
    const batchQueries: Array<{ sql: string; args: any[] }> = []
    let studentIdx = -1
    let courseIdx = -1
    if (studentIds.length) {
      studentIdx = batchQueries.length
      batchQueries.push({
        sql: `select id, profileId, firstName, lastName from students where id in (${placeholders(studentIds.length)})`,
        args: studentIds,
      })
    }
    if (courseIds.length) {
      courseIdx = batchQueries.length
      batchQueries.push({
        sql: `select id, name from courses where id in (${placeholders(courseIds.length)})`,
        args: courseIds,
      })
    }
    const results = batchQueries.length ? await turso.batch(batchQueries) : []
    const studentRows = studentIdx >= 0 ? (results[studentIdx]?.rows ?? []) : []
    const studentMap = indexRows(studentRows)
    const courseMap = courseIdx >= 0 ? indexRows(results[courseIdx]?.rows ?? []) : new Map<string, any>()

    // Fall back to profiles for legacy students whose name columns are empty.
    const profileIds = uniqueIds([
      ...studentRows.map((s: any) => s.profileId || s.id),
      ...studentIds,
    ])
    let profileMap = new Map<string, any>()
    if (profileIds.length) {
      const prs = await turso.execute({
        sql: `select id, firstName, lastName from profiles where id in (${placeholders(profileIds.length)})`,
        args: profileIds,
      })
      profileMap = indexRows(prs.rows)
    }

    return rows.map((row) => {
      const s = studentMap.get(row.studentId)
      const p = profileMap.get(s?.profileId || row.studentId)
      const c = courseMap.get(row.courseId)
      const name = `${s?.firstName || p?.firstName || ""} ${s?.lastName || p?.lastName || ""}`.trim()
      return {
        ...row,
        studentName: name || "Unknown",
        courseName: c?.name || "Unknown",
      }
    }) as T[]
  }

  return rows as T[]
}

export async function addItem<T extends Record<string, any>>(key: string, item: T): Promise<T> {
  requireAuth()
  await checkKeyPermission(key, "add")
  const table = TABLE_MAP[key]
  if (!table) throw new Error(`Unknown key: ${key}`)

  const data = { ...item, id: item.id || crypto.randomUUID() }
  const cols = Object.keys(data)
  const vals = Object.values(data)
  const placeholderStr = cols.map(() => "?").join(", ")

  await turso.execute({
    sql: `insert into ${table} (${cols.map(c => `"${c}"`).join(", ")}) values (${placeholderStr})`,
    args: vals,
  })

  if (key === "payments" && (data as any).studentId) {
    await recomputeFeeForStudent((data as any).studentId)
  }
  // Keep teacher commissions live when a course charge is assigned/edited.
  if (key === "fees" && (data as any).studentId) {
    try { await recomputeCommissionsForStudent((data as any).studentId) } catch { /* ignore */ }
  }
  // A manually added enrollment should earn commission too.
  if (key === "enrollmentProgress" && (data as any).studentId && (data as any).courseId) {
    try { await computeCommissionForEnrollment((data as any).studentId, (data as any).courseId) } catch { /* ignore */ }
  }

  return data as T
}

export async function updateItem<T>(key: string, id: string, updates: Partial<T>): Promise<T> {
  requireAuth()
  await checkKeyPermission(key, "update")
  const table = TABLE_MAP[key]
  if (!table) throw new Error(`Unknown key: ${key}`)

  const cols = Object.keys(updates)
  const vals = Object.values(updates)
  const setClause = cols.map(c => `"${c}" = ?`).join(", ")

  // Fee balances depend on payment amounts, so keep them in sync on edits.
  let studentId: string | undefined
  if (key === "payments") {
    const existing = await turso.execute({
      sql: "select studentId from payments where id = ?",
      args: [id],
    })
    studentId = existing.rows[0]?.studentId
  }

  const rs = await turso.execute({
    sql: `update ${table} set ${setClause} where id = ? returning *`,
    args: [...vals, id],
  })

  if (rs.rows.length === 0) throw new Error(`Record not found in ${table} with id ${id}`)

  if (key === "payments" && studentId) {
    await recomputeFeeForStudent(studentId)
  }
  // Keep teacher commissions live when a course charge is edited.
  if (key === "fees") {
    const sid = (rs.rows[0] as any)?.studentId
    if (sid) { try { await recomputeCommissionsForStudent(sid) } catch { /* ignore */ } }
  }
  // Course fee/rate changes affect every enrolled student's commission.
  if (key === "courses") {
    try { await recomputeCommissionsForCourse(id) } catch { /* ignore */ }
  }

  return rs.rows[0] as T
}

export async function upsertItem<T extends Record<string, any>>(key: string, item: T): Promise<T> {
  requireAuth()
  const table = TABLE_MAP[key]
  if (!table) throw new Error(`Unknown key: ${key}`)

  const data = { ...item, id: item.id || crypto.randomUUID() }

  const existing = await turso.execute({ sql: `select id from ${table} where id = ?`, args: [data.id] })

  if (existing.rows.length > 0) {
    return updateItem(key, data.id!, data as any)
  } else {
    return addItem(key, data)
  }
}

export async function deleteItem(key: string, id: string): Promise<void> {
  requireAuth()
  await checkKeyPermission(key, "delete")
  const table = TABLE_MAP[key]
  if (!table) throw new Error(`Unknown key: ${key}`)

  // Fee balances depend on payment amounts, so keep them in sync on deletes.
  if (key === "payments") {
    const existing = await turso.execute({
      sql: "select studentId from payments where id = ?",
      args: [id],
    })
    const studentId = existing.rows[0]?.studentId
    await turso.execute({ sql: `delete from ${table} where id = ?`, args: [id] })
    if (studentId) await recomputeFeeForStudent(studentId)
    return
  }

  await turso.execute({ sql: `delete from ${table} where id = ?`, args: [id] })
}

// Cascade delete a student and all linked records
export async function deleteStudent(id: string): Promise<void> {
  requireAuth()
  await checkKeyPermission("students", "delete")
  // Delete in order: child records first, then the student, then the profile
  // 1. Delete exam results for this student
  await turso.execute({ sql: "delete from exam_results where \"studentId\" = ?", args: [id] })
  // 2. Delete attendance records for this student
  await turso.execute({ sql: "delete from attendance where \"studentId\" = ?", args: [id] })
  // 3. Delete enrollment progress records
  await turso.execute({ sql: "delete from enrollment_progress where \"studentId\" = ?", args: [id] })
  // 3b. Delete teacher commissions earned from this student's enrollments
  await turso.execute({ sql: "delete from teacher_commissions where \"studentId\" = ?", args: [id] })
  // 4. Delete payments linked to this student's fees (capture receipts first so
  //    we can remove the corresponding income records)
  const payRs = await turso.execute({ sql: "select receiptNumber from payments where \"studentId\" = ?", args: [id] })
  const receipts = uniqueIds((payRs.rows as any[]).map((r) => r.receiptNumber))
  await turso.execute({ sql: "delete from payments where \"studentId\" = ?", args: [id] })
  // 5. Delete income records generated from this student's fee payments
  if (receipts.length) {
    await turso.execute({
      sql: `delete from income where receiptNumber in (${placeholders(receipts.length)})`,
      args: receipts,
    })
  }
  // 6. Delete fees for this student
  await turso.execute({ sql: "delete from fees where \"studentId\" = ?", args: [id] })
  // 7. Delete the student record
  await turso.execute({ sql: "delete from students where id = ?", args: [id] })
  // 8. Delete the user profile
  await turso.execute({ sql: "delete from profiles where id = ?", args: [id] })
}

export async function resetPassword(email: string) {
  const rs = await turso.execute({ sql: "select id from profiles where email = ?", args: [email] })
  if (rs.rows.length === 0) throw new Error("No account found with that email")
  return true
}

// --- Specific Logic ---

export async function createUser(userData: any) {
  await requireRole(["ADMIN"])

  const createLoginAccount = userData.createLoginAccount !== undefined ? !!userData.createLoginAccount : true
  let userId = crypto.randomUUID()

  if (createLoginAccount) {
    const passwordHash = await hashPassword(userData.password)

    await turso.execute({
      sql: "insert into profiles (id, email, password, role, firstName, lastName) values (?, ?, ?, ?, ?, ?)",
      args: [userId, userData.email, passwordHash, userData.role, userData.firstName, userData.lastName],
    })
  }

  if (userData.role === "STUDENT") {
    if (!createLoginAccount) {
      userId = crypto.randomUUID()
      await turso.execute({
        sql: "insert into students (id, profileId, email, studentNumber, enrollmentYear, classId, academicYear, parentPhone, courseId, phone, gender, admissionDate, expectedCompletionDate, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          userId, null, userData.email || null, userData.studentNumber || generateStudentNumber(), new Date().getFullYear(),
          userData.classId || null, userData.academicYear || 1, userData.parentPhone || null,
          userData.courseId || null, userData.phone || null, userData.gender || null,
          userData.admissionDate || null, userData.expectedCompletionDate || null, userData.status || "ACTIVE",
        ],
      })
    } else {
      await turso.execute({
        sql: "insert into students (id, profileId, email, studentNumber, enrollmentYear, classId, academicYear, parentPhone, courseId, phone, gender, admissionDate, expectedCompletionDate, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          userId, userId, userData.email || null, userData.studentNumber || generateStudentNumber(), new Date().getFullYear(),
          userData.classId || null, userData.academicYear || 1, userData.parentPhone || null,
          userData.courseId || null, userData.phone || null, userData.gender || null,
          userData.admissionDate || null, userData.expectedCompletionDate || null, userData.status || "ACTIVE",
        ],
      })
    }
    // Enroll in every selected course (creates the enrollment, its charge and
    // teacher commission) and charge the one-off registration fee if configured.
    const courseIds = uniqueIds(
      Array.isArray(userData.courseIds) && userData.courseIds.length
        ? userData.courseIds
        : userData.courseId
          ? [userData.courseId]
          : []
    )
    await syncStudentEnrollments(userId, courseIds, { dueDate: userData.dueDate, discountByCourse: userData.discountByCourse })
  } else if (userData.role === "TEACHER") {
    await turso.execute({
      sql: "insert into teachers (id, staffId, department, specialization, firstName, lastName) values (?, ?, ?, ?, ?, ?)",
      args: [userId, userData.staffId || "TCH" + Math.floor(Math.random() * 1000), userData.department || null, userData.specialization || null, userData.firstName || null, userData.lastName || null],
    })
  }

  return { success: true, userId }
}

// Register a student. A login `profiles` row is created ONLY when
// createLoginAccount is true; otherwise the student is just a `students` record
// (no forced user account). Commission is computed on enrollment regardless.
export async function registerStudent(userData: any) {
  await requireRole(["ADMIN", "MANAGER", "SECRETARY"])
  const u = await getCurrentUser()
  if (u && !["ADMIN"].includes(u.role)) {
    const token = getStoredToken()
    const res = await fetch("/api/permissions/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (res.ok) {
      const data = (await res.json()) as { permissions: string[] }
      if (!data.permissions.includes("add_students")) throw new Error("Forbidden: add_students permission required")
    }
  }

  const createLoginAccount = userData.createLoginAccount === true
  const userId = crypto.randomUUID()

  if (createLoginAccount) {
    const passwordHash = await hashPassword(userData.password)
    await turso.execute({
      sql: "insert into profiles (id, email, password, role, firstName, lastName) values (?, ?, ?, ?, ?, ?)",
      args: [userId, userData.email, passwordHash, "STUDENT", userData.firstName, userData.lastName],
    })
  }

  await turso.execute({
    sql: "insert into students (id, profileId, email, firstName, lastName, studentNumber, enrollmentYear, classId, academicYear, parentPhone, courseId, phone, gender, admissionDate, expectedCompletionDate, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [
      userId,
      createLoginAccount ? userId : null,
      userData.email || null,
      userData.firstName || null,
      userData.lastName || null,
      userData.studentNumber || generateStudentNumber(),
      new Date().getFullYear(),
      userData.classId || null,
      userData.academicYear || 1,
      userData.parentPhone || null,
      userData.courseId || null,
      userData.phone || null,
      userData.gender || null,
      userData.admissionDate || null,
      userData.expectedCompletionDate || null,
      userData.status || "ACTIVE",
    ],
  })

  // Enroll in every selected course (creates the enrollment, its charge and
  // teacher commission) and charge the one-off registration fee if configured.
  const courseIds = uniqueIds(
    Array.isArray(userData.courseIds) && userData.courseIds.length
      ? userData.courseIds
      : userData.courseId
        ? [userData.courseId]
        : []
  )
  await syncStudentEnrollments(userId, courseIds, { dueDate: userData.dueDate, discountByCourse: userData.discountByCourse })

  return { success: true, userId }
}

export function generateStudentNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  return `STU${year}${random}`
}

// --- Charges, discounts, tax & enrollment billing ---

export interface ChargeInput {
  studentId: string
  courseId?: string | null
  feeType?: FeeType
  description?: string
  grossAmount: number
  discountAmount?: number
  discountReason?: string
  dueDate?: string | null
  /** Tax/VAT rate in percent. Falls back to institution settings when omitted. */
  taxRate?: number
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

/** gross - discount + tax = net (all rounded to 2 decimals). */
export function computeChargeAmounts(grossAmount: number, discountAmount = 0, taxRate = 0) {
  const gross = round2(Math.max(0, Number(grossAmount) || 0))
  const discount = round2(Math.min(Math.max(0, Number(discountAmount) || 0), gross))
  const taxable = gross - discount
  const tax = round2(taxable * ((Number(taxRate) || 0) / 100))
  const net = round2(taxable + tax)
  return { grossAmount: gross, discountAmount: discount, taxAmount: tax, totalFee: net }
}

/** Reads registration fee, tax rate and currency from institution settings. */
export async function getFinanceConfig() {
  const rs = await turso.execute({ sql: "select * from institution_settings limit 1" })
  const s = rs.rows[0] as any
  return {
    currency: s?.currency || "KES",
    registrationFee: Number(s?.registrationFee) || 0,
    taxRate: Number(s?.taxRate) || 0,
  }
}

/** Insert a single charge (course fee, registration fee, or other). */
export async function createStudentCharge(input: ChargeInput): Promise<string> {
  requireAuth()
  const taxRate = input.taxRate !== undefined ? input.taxRate : (await getFinanceConfig()).taxRate
  const { grossAmount, discountAmount, taxAmount, totalFee } = computeChargeAmounts(
    input.grossAmount,
    input.discountAmount || 0,
    taxRate
  )
  const id = crypto.randomUUID()
  await turso.execute({
    sql: `insert into fees (id, studentId, courseId, feeType, description, grossAmount, discountAmount, discountReason, taxAmount, totalFee, balance, dueDate, status, createdAt) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, input.studentId, input.courseId || null, input.feeType || "COURSE",
      input.description || null, grossAmount, discountAmount, input.discountReason || null,
      taxAmount, totalFee, totalFee, input.dueDate || null,
      totalFee <= 0 ? "PAID" : "PENDING", new Date().toISOString(),
    ],
  })
  return id
}

/** Charge the one-off registration fee once per student (no-op if already charged or zero). */
export async function addRegistrationFeeIfNeeded(studentId: string): Promise<boolean> {
  const cfg = await getFinanceConfig()
  if (cfg.registrationFee <= 0) return false
  const existing = await turso.execute({
    sql: "select id from fees where studentId = ? and feeType = 'REGISTRATION'",
    args: [studentId],
  })
  if (existing.rows.length > 0) return false
  await createStudentCharge({
    studentId, courseId: null, feeType: "REGISTRATION",
    description: "Registration / admission fee",
    grossAmount: cfg.registrationFee, taxRate: cfg.taxRate,
  })
  return true
}

/**
 * Enroll a student in a course and create its charge atomically. Idempotent:
 * re-enrolling an already-enrolled course is a no-op.
 */
export async function enrollStudentInCourse(
  studentId: string,
  courseId: string,
  opts: { discountAmount?: number; discountReason?: string; dueDate?: string; grossAmount?: number; startDate?: string } = {}
): Promise<{ success: boolean; alreadyEnrolled?: boolean }> {
  requireAuth()
  const existing = await turso.execute({
    sql: "select id from enrollment_progress where studentId = ? and courseId = ?",
    args: [studentId, courseId],
  })
  if (existing.rows.length > 0) return { success: true, alreadyEnrolled: true }

  const cfg = await getFinanceConfig()
  const courseRs = await turso.execute({ sql: "select id, fee from courses where id = ?", args: [courseId] })
  const course = courseRs.rows[0] as any
  if (!course) throw new Error("Course not found")

  await turso.execute({
    sql: "insert into enrollment_progress (id, studentId, courseId, progressPercent, status, startDate) values (?, ?, ?, 0, 'ENROLLED', ?)",
    args: [crypto.randomUUID(), studentId, courseId, opts.startDate || null],
  })
  await createStudentCharge({
    studentId, courseId, feeType: "COURSE",
    grossAmount: opts.grossAmount ?? (Number(course.fee) || 0),
    discountAmount: opts.discountAmount || 0,
    discountReason: opts.discountReason,
    dueDate: opts.dueDate || null,
    taxRate: cfg.taxRate,
  })
  await addRegistrationFeeIfNeeded(studentId)
  try {
    await computeCommissionForEnrollment(studentId, courseId)
  } catch (e) {
    const msg = (e as Error)?.message || ""
    // Missing commission config, or an actor without payroll rights, must not
    // block enrollment — an admin can recompute commissions later.
    if (!msg.includes("Commission configuration") && !/forbidden|permission/i.test(msg)) throw e
  }
  await recomputeFeeForStudent(studentId)
  return { success: true }
}

/**
 * Remove a student from a course. Deletes the enrollment and its charge when
 * unpaid; when payments exist the charge is cancelled so those payments become
 * credit on the student's account (no automatic refund).
 */
export async function unenrollStudentFromCourse(studentId: string, courseId: string): Promise<{ success: boolean }> {
  requireAuth()
  await turso.execute({
    sql: "delete from enrollment_progress where studentId = ? and courseId = ?",
    args: [studentId, courseId],
  })
  const feeRs = await turso.execute({
    sql: "select id from fees where studentId = ? and courseId = ? and feeType = 'COURSE' and status != 'CANCELLED'",
    args: [studentId, courseId],
  })
  const fee = feeRs.rows[0] as any
  if (fee) {
    const payRs = await turso.execute({
      sql: "select id from payments where feeId = ? limit 1",
      args: [fee.id],
    })
    if (payRs.rows.length === 0) {
      await turso.execute({ sql: "delete from fees where id = ?", args: [fee.id] })
    } else {
      await turso.execute({
        sql: "update fees set status = ?, balance = ? where id = ?",
        args: ["CANCELLED", 0, fee.id],
      })
    }
  }
  await recomputeFeeForStudent(studentId)
  return { success: true }
}

/**
 * Reconcile a student's enrollments with a target course set: adds missing
 * enrollments (+ charges), removes dropped ones (+ void/delete their charges),
 * and ensures the registration fee exists.
 */
export async function syncStudentEnrollments(
  studentId: string,
  courseIds: string[],
  opts: { discountByCourse?: Record<string, number>; dueDate?: string } = {}
): Promise<void> {
  const target = new Set(uniqueIds(courseIds))
  const rs = await turso.execute({
    sql: "select courseId from enrollment_progress where studentId = ?",
    args: [studentId],
  })
  const current = new Set((rs.rows as any[]).map((r) => r.courseId))
  for (const cid of target) {
    if (current.has(cid)) continue
    await enrollStudentInCourse(studentId, cid, {
      discountAmount: opts.discountByCourse?.[cid] || 0,
      dueDate: opts.dueDate,
    })
  }
  for (const cid of current) {
    if (!target.has(cid)) await unenrollStudentFromCourse(studentId, cid)
  }
  await addRegistrationFeeIfNeeded(studentId)
}

// --- Fee tracking & Teacher commission ---

export async function updateOverdueFees() {
  const today = new Date().toISOString().split("T")[0]
  await turso.execute({
    sql: "update fees set status = 'OVERDUE' where balance > 0 and dueDate < ?",
    args: [today],
  })
}

export async function recomputeFeeForStudent(studentId: string): Promise<{ credit: number }> {
  const feesRs = await turso.execute({ sql: "select * from fees where studentId = ?", args: [studentId] })
  const allFees = feesRs.rows as Fee[]
  // Cancelled charges no longer count, and any payments attached to them are
  // released back into the pool (they become credit).
  const fees = allFees.filter((f) => f.status !== "CANCELLED")
  const activeIds = new Set(fees.map((f) => f.id))

  const payRs = await turso.execute({
    sql: "select feeId, amount from payments where studentId = ?",
    args: [studentId],
  })
  const payRows = payRs.rows as any[]
  const paidByFee: Record<string, number> = {}
  let unattached = 0
  for (const p of payRows) {
    const amount = Number(p.amount) || 0
    if (p.feeId && activeIds.has(p.feeId)) paidByFee[p.feeId] = (paidByFee[p.feeId] || 0) + amount
    else unattached += amount
  }

  const sorted = [...fees].sort((a, b) =>
    String(a.createdAt || "").localeCompare(String(b.createdAt || "")) ||
    String(a.id).localeCompare(String(b.id))
  )
  let remaining = unattached
  for (const fee of sorted) {
    if (remaining <= 0) break
    const totalFee = Number(fee.totalFee) || 0
    const alreadyPaid = paidByFee[fee.id] || 0
    const need = Math.max(0, totalFee - alreadyPaid)
    const applied = Math.min(need, remaining)
    paidByFee[fee.id] = alreadyPaid + applied
    remaining -= applied
  }

  // Unallocated cash and per-fee overpayments become the student's credit.
  let credit = remaining
  for (const fee of fees) {
    const totalFee = Number(fee.totalFee) || 0
    const paid = paidByFee[fee.id] || 0
    credit += Math.max(0, paid - totalFee)
    const balance = Math.max(0, totalFee - paid)
    const status = balance <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING"
    await turso.execute({
      sql: "update fees set balance = ?, status = ? where id = ?",
      args: [balance, status, fee.id],
    })
  }
  // Keep teacher commissions in step with the student's current charges.
  try { await recomputeCommissionsForStudent(studentId) } catch { /* ignore */ }
  return { credit: round2(credit) }
}

/** Record a fee payment and its matching income entry in one step. */
export async function recordStudentPayment(input: {
  studentId: string
  feeId?: string | null
  amount: number
  paymentDate: string
  paymentMethod: "CASH" | "M_PESA" | "BANK"
  receiptNumber: string
  notes?: string
}) {
  requireAuth()
  await checkKeyPermission("payments", "add")
  const user = await getCurrentUser()
  const id = crypto.randomUUID()
  await turso.execute({
    sql: "insert into payments (id, studentId, feeId, amount, paymentDate, paymentMethod, receiptNumber, notes, createdBy) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [id, input.studentId, input.feeId || null, input.amount, input.paymentDate, input.paymentMethod, input.receiptNumber, input.notes || null, user?.id || null],
  })
  const stuRs = await turso.execute({
    sql: "select firstName, lastName from students where id = ?",
    args: [input.studentId],
  })
  const s = stuRs.rows[0] as any
  const studentName = s ? `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Student" : "Student"
  await turso.execute({
    sql: "insert into income (id, category, amount, description, incomeDate, receiptNumber, createdBy) values (?, 'FEES', ?, ?, ?, ?, ?)",
    args: [crypto.randomUUID(), input.amount, `Fee payment - ${studentName}`, input.paymentDate, input.receiptNumber, user?.id || null],
  })
  await recomputeFeeForStudent(input.studentId)
  return { success: true, id }
}

export async function recordPayment(input: {
  studentId: string
  feeId?: string
  amount: number
  paymentDate: string
  paymentMethod: "CASH" | "M_PESA" | "BANK"
  receiptNumber: string
  notes?: string
}) {
  requireAuth()
  const id = crypto.randomUUID()
  await turso.execute({
    sql: "insert into payments (id, studentId, feeId, amount, paymentDate, paymentMethod, receiptNumber, notes) values (?, ?, ?, ?, ?, ?, ?, ?)",
    args: [id, input.studentId, input.feeId || null, input.amount, input.paymentDate, input.paymentMethod, input.receiptNumber, input.notes || null],
  })
  await recomputeFeeForStudent(input.studentId)
  return { success: true, id }
}

export async function getStudentFeeSummary(studentId: string) {
  await updateOverdueFees()

  const feeRs = await turso.execute({ sql: "select * from fees where studentId = ?", args: [studentId] })
  const fees = (feeRs.rows as Fee[]).filter((f) => f.status !== "CANCELLED")
  const payRs = await turso.execute({
    sql: "select * from payments where studentId = ? order by paymentDate desc",
    args: [studentId],
  })
  const payRows = payRs.rows as any[]
  const payments = payRows as Payment[]

  const totalFee = fees.reduce((s, f) => s + (Number(f.totalFee) || 0), 0)
  const amountPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const balance = Math.max(0, totalFee - amountPaid)
  const credit = Math.max(0, amountPaid - totalFee)

  const nonPaidFees = fees.filter(f => f.status !== "PAID")
  const dueDates = nonPaidFees
    .map(f => f.dueDate)
    .filter((d): d is string => !!d)
    .sort()
  const nextDueDate = dueDates.length ? dueDates[0] : undefined

  const status = fees.length === 0 ? "NONE" : balance <= 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "OVERDUE"

  return { totalFee, amountPaid, balance, credit, nextDueDate, status, payments, charges: fees }
}

/**
 * Build a chronological statement for a student: charges (with discount and
 * tax lines), payments, and a running balance.
 */
export async function getStudentLedger(studentId: string): Promise<StudentLedger> {
  requireAuth()
  const feeRs = await turso.execute({
    sql: "select * from fees where studentId = ? order by createdAt asc",
    args: [studentId],
  })
  const fees = (feeRs.rows as Fee[]).filter((f) => f.status !== "CANCELLED")
  const payRs = await turso.execute({
    sql: "select * from payments where studentId = ? order by paymentDate asc",
    args: [studentId],
  })
  const payments = payRs.rows as Payment[]

  const raw: Array<{ id: string; date: string; type: LedgerEntryType; description: string; amount: number }> = []
  let gross = 0, discount = 0, tax = 0, net = 0
  for (const f of fees) {
    const g = Number(f.grossAmount ?? f.totalFee) || 0
    const d = Number(f.discountAmount) || 0
    const t = Number(f.taxAmount) || 0
    const label = f.feeType === "REGISTRATION"
      ? (f.description || "Registration fee")
      : f.feeType === "OTHER"
        ? (f.description || "Charge")
        : (f.courseName || "Course fee")
    const date = f.createdAt || f.dueDate || ""
    raw.push({ id: f.id, date, type: "CHARGE", description: label, amount: g })
    if (d > 0) raw.push({ id: `${f.id}-d`, date, type: "DISCOUNT", description: `Discount${f.discountReason ? ` — ${f.discountReason}` : ""}`, amount: -d })
    if (t > 0) raw.push({ id: `${f.id}-t`, date, type: "TAX", description: "Tax / VAT", amount: t })
    gross += g; discount += d; tax += t; net += Number(f.totalFee) || 0
  }
  let paid = 0
  for (const p of payments) {
    const amount = Number(p.amount) || 0
    raw.push({
      id: p.id,
      date: p.paymentDate || p.createdAt || "",
      type: "PAYMENT",
      description: `Payment (${p.paymentMethod.replace("_", " ")}) #${p.receiptNumber}`,
      amount: -amount,
    })
    paid += amount
  }

  raw.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.type.localeCompare(b.type))
  let running = 0
  const entries: LedgerEntry[] = raw.map((e) => {
    running = round2(running + e.amount)
    return { id: e.id, date: e.date, type: e.type, description: e.description, amount: round2(e.amount), balance: running }
  })

  return {
    studentId,
    entries,
    totals: {
      gross: round2(gross),
      discount: round2(discount),
      tax: round2(tax),
      net: round2(net),
      paid: round2(paid),
      balance: round2(Math.max(0, net - paid)),
      credit: round2(Math.max(0, paid - net)),
    },
  }
}

export async function getCourseTeachers(courseId: string): Promise<string[]> {
  const rs = await turso.execute({
    sql: "select teacherId from course_teachers where courseId = ?",
    args: [courseId],
  })
  const ids = (rs.rows as any[]).map((r) => r.teacherId)
  // Fallback to the legacy single teacherId if no join rows exist yet.
  if (ids.length === 0) {
    const c = await turso.execute({ sql: "select teacherId from courses where id = ?", args: [courseId] })
    if (c.rows[0]?.teacherId) ids.push(c.rows[0].teacherId)
  }
  return ids
}

export async function assignTeacherToCourse(courseId: string, teacherId: string): Promise<void> {
  requireAuth()
  await turso.execute({
    sql: "insert or ignore into course_teachers (courseId, teacherId, createdAt) values (?, ?, ?)",
    args: [courseId, teacherId, new Date().toISOString()],
  })
  // A newly assigned teacher should start earning on existing enrollments.
  try { await recomputeCommissionsForCourse(courseId) } catch { /* ignore */ }
}

export async function removeTeacherFromCourse(courseId: string, teacherId: string): Promise<void> {
  requireAuth()
  await turso.execute({
    sql: "delete from course_teachers where courseId = ? and teacherId = ?",
    args: [courseId, teacherId],
  })
}

/** The student's current net charge for a course (after discount/tax), or null. */
async function studentCourseNetFee(studentId: string, courseId: string): Promise<number | null> {
  const rs = await turso.execute({
    sql: "select totalFee from fees where studentId = ? and courseId = ? and feeType = 'COURSE' and status != 'CANCELLED' order by createdAt asc limit 1",
    args: [studentId, courseId],
  })
  const row = rs.rows[0] as any
  return row ? Number(row.totalFee) || 0 : null
}

async function commissionForTeacher(
  teacherId: string,
  studentId: string,
  courseId: string,
  course: any
): Promise<number> {
  const rate = Number(course.commissionRate) || 0
  // Commission is based on what the student is actually charged for the course
  // (net of discount/tax), falling back to the course list fee when no charge
  // exists yet. This keeps commissions in step with fee/discount edits.
  const netFee = await studentCourseNetFee(studentId, courseId)
  const baseFee = netFee !== null ? netFee : (Number(course.fee) || 0)
  const percentPortion = (rate / 100) * baseFee
  // Per-student fixed amount from the teacher's commission contract
  let perStudentFixed = 0
  const contractRs = await turso.execute({
    sql: "select commissionPerStudent from teacher_contracts where teacherId = ? and compensationType = 'COMMISSION' and status = 'ACTIVE' order by createdAt desc limit 1",
    args: [teacherId],
  })
  const contract = contractRs.rows[0] as any
  if (contract?.commissionPerStudent) perStudentFixed = Number(contract.commissionPerStudent) || 0

  const commissionAmount = round2(percentPortion + perStudentFixed)
  if (commissionAmount <= 0) return 0

  // Upsert so re-enrollment / fee edits refresh the amount while preserving
  // whatever has already been paid out to the teacher.
  const existingRs = await turso.execute({
    sql: "select id, paidAmount from teacher_commissions where teacherId = ? and studentId = ? and courseId = ? limit 1",
    args: [teacherId, studentId, courseId],
  })
  const existing = existingRs.rows[0] as any
  if (existing) {
    const paid = Number(existing.paidAmount) || 0
    const status = paid <= 0 ? "EARNED" : paid >= commissionAmount ? "PAID" : "PARTIAL"
    await turso.execute({
      sql: "update teacher_commissions set commissionRate = ?, commissionAmount = ?, status = ? where id = ?",
      args: [rate, commissionAmount, status, existing.id],
    })
  } else {
    await turso.execute({
      sql: "insert into teacher_commissions (id, teacherId, studentId, courseId, commissionRate, commissionAmount, paidAmount, status, createdAt) values (?, ?, ?, ?, ?, ?, 0, 'EARNED', ?)",
      args: [crypto.randomUUID(), teacherId, studentId, courseId, rate, commissionAmount, new Date().toISOString()],
    })
  }
  return commissionAmount
}

export async function computeCommissionForEnrollment(studentId: string, courseId: string) {
  const courseRs = await turso.execute({ sql: "select * from courses where id = ?", args: [courseId] })
  const course = courseRs.rows[0] as any
  if (!course) throw new Error("Commission configuration unavailable for course")

  // Pay every teacher assigned to the course (per-student commission). This is
  // an upsert, so calling it again refreshes stale amounts.
  const teacherIds = await getCourseTeachers(courseId)
  let total = 0
  for (const tid of teacherIds) {
    total += await commissionForTeacher(tid, studentId, courseId, course)
  }
  return { success: true, commissionAmount: total }
}

/**
 * Recompute a student's commissions from their current enrollments and charges.
 * Called whenever their fees/discounts change so the payroll view stays live.
 */
export async function recomputeCommissionsForStudent(studentId: string): Promise<void> {
  const rs = await turso.execute({
    sql: "select courseId from enrollment_progress where studentId = ?",
    args: [studentId],
  })
  for (const r of rs.rows as any[]) {
    try {
      await computeCommissionForEnrollment(studentId, r.courseId)
    } catch {
      // Missing commission config or insufficient rights — leave as is.
    }
  }
}

/** Recompute commissions for every student enrolled in a course (fee/rate/teacher edits). */
export async function recomputeCommissionsForCourse(courseId: string): Promise<void> {
  const rs = await turso.execute({
    sql: "select studentId from enrollment_progress where courseId = ?",
    args: [courseId],
  })
  for (const r of rs.rows as any[]) {
    try {
      await computeCommissionForEnrollment(r.studentId, courseId)
    } catch {
      // Missing commission config or insufficient rights — leave as is.
    }
  }
}

export async function getTeacherCommissionSummaries(teacherId?: string): Promise<TeacherCommissionSummary[]> {
  requireAuth()
  const teacherRs = teacherId
    ? await turso.execute({ sql: "select * from teachers where id = ?", args: [teacherId] })
    : await turso.execute({ sql: "select * from teachers" })
  const teacherRows = teacherRs.rows as any[]
  const teacherIds = uniqueIds(teacherRows.map((t) => t.id))

  let profileMap = new Map<string, any>()
  const ctsByTeacher = new Map<string, string[]>()
  const legacyByTeacher = new Map<string, string[]>()
  let commissionRows: any[] = []
  if (teacherIds.length) {
    // Fetch all teacher-related data in parallel, single HTTP round trip each.
    const [profiles, cts, legacy, commissions] = await Promise.all([
      turso.execute({ sql: `select id, firstName, lastName from profiles where id in (${placeholders(teacherIds.length)})`, args: teacherIds }),
      turso.execute({ sql: `select teacherId, courseId from course_teachers where teacherId in (${placeholders(teacherIds.length)})`, args: teacherIds }),
      turso.execute({ sql: `select id, teacherId from courses where teacherId in (${placeholders(teacherIds.length)})`, args: teacherIds }),
      turso.execute({ sql: `select teacherId, commissionAmount, paidAmount from teacher_commissions where teacherId in (${placeholders(teacherIds.length)})`, args: teacherIds }),
    ])
    profileMap = indexRows(profiles.rows)
    for (const r of cts.rows as any[]) {
      if (!ctsByTeacher.has(r.teacherId)) ctsByTeacher.set(r.teacherId, [])
      ctsByTeacher.get(r.teacherId)!.push(r.courseId)
    }
    for (const r of legacy.rows as any[]) {
      if (!legacyByTeacher.has(r.teacherId)) legacyByTeacher.set(r.teacherId, [])
      legacyByTeacher.get(r.teacherId)!.push(r.id)
    }
    commissionRows = commissions.rows as any[]
  }

  // Merge assigned courses per teacher (course_teachers + legacy column), deduped.
  const courseIdsByTeacher: Record<string, string[]> = {}
  const allCourseIds: string[] = []
  for (const t of teacherRows) {
    const merged: string[] = []
    for (const cid of [...(ctsByTeacher.get(t.id) ?? []), ...(legacyByTeacher.get(t.id) ?? [])]) {
      if (!merged.includes(cid)) merged.push(cid)
    }
    courseIdsByTeacher[t.id] = merged
    allCourseIds.push(...merged)
  }
  const uniqueCourseIds = uniqueIds(allCourseIds)

  let studentCountByCourse = new Map<string, number>()
  if (uniqueCourseIds.length) {
    const studentRs = await turso.execute({
      sql: `select courseId, count(*) as cnt from enrollment_progress where courseId in (${placeholders(uniqueCourseIds.length)}) group by courseId`,
      args: uniqueCourseIds,
    })
    for (const r of studentRs.rows as any[]) {
      studentCountByCourse.set(r.courseId, Number(r.cnt) || 0)
    }
  }

  // Aggregate commission sums per teacher in memory (avoids one query per teacher).
  const earnedByTeacher = new Map<string, number>()
  const paidByTeacher = new Map<string, number>()
  for (const r of commissionRows) {
    earnedByTeacher.set(r.teacherId, (earnedByTeacher.get(r.teacherId) || 0) + (Number(r.commissionAmount) || 0))
    paidByTeacher.set(r.teacherId, (paidByTeacher.get(r.teacherId) || 0) + (Number(r.paidAmount) || 0))
  }

  return teacherRows.map((teacher) => {
    const tid = teacher.id
    const p = profileMap.get(tid)
    const teacherName = p ? `${p.firstName} ${p.lastName}`.trim() : "Unknown"
    const totalStudentsAssigned = (courseIdsByTeacher[tid] || []).reduce(
      (s, cid) => s + (studentCountByCourse.get(cid) || 0),
      0
    )
    const totalCommissionEarned = earnedByTeacher.get(tid) || 0
    const amountPaid = paidByTeacher.get(tid) || 0

    return {
      teacherId: tid,
      teacherName,
      totalStudentsAssigned,
      totalCommissionEarned,
      amountPaid,
      remainingBalance: Math.max(0, totalCommissionEarned - amountPaid),
    }
  })
}

export interface TeacherCommissionCourseRow {
  teacherId: string
  teacherName: string
  courseId: string
  courseName: string
  studentsInCourse: number
  commissionEarned: number
  amountPaid: number
  remainingBalance: number
}

// Per-course commission breakdown per teacher (reflects multi-teacher assignment
// via course_teachers). Used by the Payroll > Commission view.
export async function getTeacherCommissionBreakdown(): Promise<TeacherCommissionCourseRow[]> {
  requireAuth()
  const teacherRs = await turso.execute({ sql: "select * from teachers" })
  const teacherRows = teacherRs.rows as any[]
  const teacherIds = uniqueIds(teacherRows.map((t) => t.id))

  let profileMap = new Map<string, any>()
  const ctsByTeacher = new Map<string, string[]>()
  const legacyByTeacher = new Map<string, string[]>()
  let commissionRows: any[] = []
  if (teacherIds.length) {
    const [profiles, cts, legacy, commissions] = await Promise.all([
      turso.execute({ sql: `select id, firstName, lastName from profiles where id in (${placeholders(teacherIds.length)})`, args: teacherIds }),
      turso.execute({ sql: `select teacherId, courseId from course_teachers where teacherId in (${placeholders(teacherIds.length)})`, args: teacherIds }),
      turso.execute({ sql: `select id, teacherId from courses where teacherId in (${placeholders(teacherIds.length)})`, args: teacherIds }),
      turso.execute({ sql: `select teacherId, courseId, commissionAmount, paidAmount from teacher_commissions where teacherId in (${placeholders(teacherIds.length)})`, args: teacherIds }),
    ])
    profileMap = indexRows(profiles.rows)
    for (const r of cts.rows as any[]) {
      if (!ctsByTeacher.has(r.teacherId)) ctsByTeacher.set(r.teacherId, [])
      ctsByTeacher.get(r.teacherId)!.push(r.courseId)
    }
    for (const r of legacy.rows as any[]) {
      if (!legacyByTeacher.has(r.teacherId)) legacyByTeacher.set(r.teacherId, [])
      legacyByTeacher.get(r.teacherId)!.push(r.id)
    }
    commissionRows = commissions.rows as any[]
  }

  // Merge assigned courses per teacher (course_teachers + legacy column), deduped.
  const courseIdsByTeacher: Record<string, string[]> = {}
  const allCourseIds: string[] = []
  for (const t of teacherRows) {
    const merged: string[] = []
    for (const cid of [...(ctsByTeacher.get(t.id) ?? []), ...(legacyByTeacher.get(t.id) ?? [])]) {
      if (!merged.includes(cid)) merged.push(cid)
    }
    courseIdsByTeacher[t.id] = merged
    allCourseIds.push(...merged)
  }
  const uniqueCourseIds = uniqueIds(allCourseIds)

  let courseNameMap = new Map<string, any>()
  let studentCountByCourse = new Map<string, number>()
  if (uniqueCourseIds.length) {
    const [courses, students] = await Promise.all([
      turso.execute({ sql: `select id, name from courses where id in (${placeholders(uniqueCourseIds.length)})`, args: uniqueCourseIds }),
      turso.execute({ sql: `select courseId, count(*) as cnt from enrollment_progress where courseId in (${placeholders(uniqueCourseIds.length)}) group by courseId`, args: uniqueCourseIds }),
    ])
    courseNameMap = indexRows(courses.rows)
    for (const r of students.rows as any[]) {
      studentCountByCourse.set(r.courseId, Number(r.cnt) || 0)
    }
  }

  // Aggregate commission sums per (teacher, course) in memory.
  const earnedByTeacherCourse = new Map<string, number>()
  const paidByTeacherCourse = new Map<string, number>()
  for (const r of commissionRows) {
    const key = `${r.teacherId}|${r.courseId}`
    earnedByTeacherCourse.set(key, (earnedByTeacherCourse.get(key) || 0) + (Number(r.commissionAmount) || 0))
    paidByTeacherCourse.set(key, (paidByTeacherCourse.get(key) || 0) + (Number(r.paidAmount) || 0))
  }

  const rows: TeacherCommissionCourseRow[] = []
  for (const teacher of teacherRows) {
    const tid = teacher.id
    const p = profileMap.get(tid)
    const teacherName = p ? `${p.firstName} ${p.lastName}`.trim() : "Unknown"

    for (const courseId of courseIdsByTeacher[tid] || []) {
      const courseName = courseNameMap.get(courseId)?.name || "Unknown course"
      const studentsInCourse = studentCountByCourse.get(courseId) || 0
      const key = `${tid}|${courseId}`
      const commissionEarned = earnedByTeacherCourse.get(key) || 0
      const amountPaid = paidByTeacherCourse.get(key) || 0

      rows.push({
        teacherId: tid,
        teacherName,
        courseId,
        courseName,
        studentsInCourse,
        commissionEarned,
        amountPaid,
        remainingBalance: Math.max(0, commissionEarned - amountPaid),
      })
    }
  }
  return rows
}

export async function recordCommissionPayment(teacherId: string, amount: number, payDate: string, notes?: string) {
  requireAuth()
  await turso.execute({
    sql: "insert into payroll_records (id, teacherId, amount, periodStart, periodEnd, payDate, payType, notes, status) values (?, ?, ?, ?, ?, ?, 'COMMISSION', ?, 'PAID')",
    args: [crypto.randomUUID(), teacherId, amount, payDate, payDate, payDate, notes || null],
  })

  const rowsRs = await turso.execute({
    sql: "select * from teacher_commissions where teacherId = ? and status != 'PAID' order by createdAt asc",
    args: [teacherId],
  })
  let remaining = amount
  for (const row of rowsRs.rows as any[]) {
    if (remaining <= 0) break
    const commissionAmount = Number(row.commissionAmount) || 0
    const currentPaid = Number(row.paidAmount) || 0
    if (currentPaid >= commissionAmount) continue
    const toApply = Math.min(remaining, commissionAmount - currentPaid)
    const newPaid = currentPaid + toApply
    const newStatus = newPaid >= commissionAmount ? "PAID" : "PARTIAL"
    await turso.execute({
      sql: "update teacher_commissions set paidAmount = ?, status = ? where id = ?",
      args: [newPaid, newStatus, row.id],
    })
    remaining -= toApply
  }
  return { success: true }
}

// --- Payroll ---

export async function processPayroll(teacherId: string, contractId: string, amount: number, periodStart: string, periodEnd: string, payDate: string, payType: "SALARY" | "COMMISSION", notes?: string) {
  requireAuth()
  const id = crypto.randomUUID()
  await turso.execute({
    sql: "insert into payroll_records (id, teacherId, contractId, amount, periodStart, periodEnd, payDate, payType, notes, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID')",
    args: [id, teacherId, contractId, amount, periodStart, periodEnd, payDate, payType, notes || null],
  })
  // Also add as expense
  await turso.execute({
    sql: "insert into expenses (id, category, amount, description, expenseDate) values (?, 'SALARIES', ?, ?, ?)",
    args: [crypto.randomUUID(), amount, `Payroll: ${payType} for period ${periodStart} to ${periodEnd}`, payDate],
  })
  return { success: true, id }
}

export async function getPayrollSummary(year: number, month: number) {
  requireAuth()
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`
  const rs = await turso.execute({
    sql: "select sum(amount) as totalPayroll, count(*) as payCount from payroll_records where periodStart >= ? and periodEnd <= ? and status = 'PAID'",
    args: [startDate, endDate],
  })
  return { totalPayroll: rs.rows[0]?.totalPayroll || 0, payCount: rs.rows[0]?.payCount || 0 }
}

// --- Income helpers ---

export async function getIncomeSummary(year: number, month?: number) {
  requireAuth()
  let sql = "select category, sum(amount) as total from income group by category"
  let args: any[] = []
  if (month) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`
    const endDate = `${year}-${String(month).padStart(2, "0")}-31`
    sql = "select category, sum(amount) as total from income where incomeDate >= ? and incomeDate <= ? group by category"
    args = [startDate, endDate]
  }
  const rs = await turso.execute({ sql, args })
  return rs.rows as any[]
}

// --- Enrollment progress ---

export async function getEnrollmentStats() {
  requireAuth()
  const total = await turso.execute("select count(*) as cnt from enrollment_progress")
  const byStatus = await turso.execute("select status, count(*) as cnt from enrollment_progress group by status")
  const avgProgress = await turso.execute("select avg(progressPercent) as avgPct from enrollment_progress")
  return {
    total: total.rows[0]?.cnt || 0,
    byStatus: byStatus.rows as any[],
    avgProgress: avgProgress.rows[0]?.avgPct || 0,
  }
}
