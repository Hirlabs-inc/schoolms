import { turso } from "./turso-client"
import { hashPassword, verifyPassword, getStoredToken, setStoredToken, clearStoredToken } from "./auth-client"
import type { UserRole, IncomeCategory, ExpenseCategory, Payment, Fee, TeacherCommissionSummary } from "./types"

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
  exams: "exams",
  examResults: "exam_results",
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
    const batchQueries: Array<{ sql: string; args: any[] }> = []
    if (courseIds.length) {
      batchQueries.push({
        sql: `select id, name from courses where id in (${placeholders(courseIds.length)})`,
        args: courseIds,
      })
    }
    const results = batchQueries.length ? await turso.batch(batchQueries) : []
    const courseMap = indexRows(results[0]?.rows ?? [])
    return rows.map((row) => ({
      ...row,
      courseName: row.courseId ? courseMap.get(row.courseId)?.name : undefined,
    })) as T[]
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
    if (studentIds.length) {
      batchQueries.push({
        sql: `select id, firstName, lastName from profiles where id in (${placeholders(studentIds.length)})`,
        args: studentIds,
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
      const p = profileMap.get(row.studentId)
      const c = courseMap.get(row.courseId)
      return {
        ...row,
        studentName: p ? `${p.firstName} ${p.lastName}` : "Unknown",
        courseName: c?.name || "Unknown",
      }
    }) as T[]
  }

  return rows as T[]
}

export async function addItem<T extends Record<string, any>>(key: string, item: T): Promise<T> {
  requireAuth()
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

  return data as T
}

export async function updateItem<T>(key: string, id: string, updates: Partial<T>): Promise<T> {
  requireAuth()
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
  // Delete in order: child records first, then the student, then the profile
  // 1. Delete exam results for this student
  await turso.execute({ sql: "delete from exam_results where \"studentId\" = ?", args: [id] })
  // 2. Delete attendance records for this student
  await turso.execute({ sql: "delete from attendance where \"studentId\" = ?", args: [id] })
  // 3. Delete enrollment progress records
  await turso.execute({ sql: "delete from enrollment_progress where \"studentId\" = ?", args: [id] })
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
    // Auto-assign a fee for every enrolled course, create enrollment progress
    // records and compute teacher commission per course.
    const courseIds = uniqueIds(
      Array.isArray(userData.courseIds) && userData.courseIds.length
        ? userData.courseIds
        : userData.courseId
          ? [userData.courseId]
          : []
    )
    await createFeesForStudent(userId, courseIds)
    for (const cid of courseIds) {
      // Auto-create enrollment progress record
      await turso.execute({
        sql: "insert into enrollment_progress (id, studentId, courseId, progressPercent, status, startDate) values (?, ?, ?, 0, 'ENROLLED', ?)",
        args: [crypto.randomUUID(), userId, cid, userData.admissionDate || null],
      })
      // Auto-compute teacher commission for this enrollment
      try {
        await computeCommissionForEnrollment(userId, cid)
      } catch (e) {
        const msg = (e as Error)?.message || "unknown error"
        if (!msg.includes("Commission configuration")) {
          // A genuine DB error should not silently break user creation
          throw e
        }
      }
    }
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
  await requireRole(["ADMIN"])

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

  // Auto-assign a fee for every enrolled course (multi-course students get a
  // separate fee record per course).
  const courseIds = uniqueIds(
    Array.isArray(userData.courseIds) && userData.courseIds.length
      ? userData.courseIds
      : userData.courseId
        ? [userData.courseId]
        : []
  )
  await createFeesForStudent(userId, courseIds)

  return { success: true, userId }
}

export function generateStudentNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  return `STU${year}${random}`
}

// Create one PENDING fee per enrolled course so multi-course students get a
// separate fee record per course.
async function createFeesForStudent(studentId: string, courseIds: string[]) {
  const ids = uniqueIds(courseIds)
  if (!ids.length) return
  const courseRs = await turso.execute({
    sql: `select id, fee from courses where id in (${placeholders(ids.length)})`,
    args: ids,
  })
  const feeByCourse = new Map<string, number>()
  for (const r of courseRs.rows as any[]) {
    feeByCourse.set(r.id, Number(r.fee) || 0)
  }
  for (const cid of ids) {
    const fee = feeByCourse.get(cid) ?? 0
    await turso.execute({
      sql: "insert into fees (id, studentId, courseId, totalFee, balance, status) values (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), studentId, cid, fee, fee, "PENDING"],
    })
  }
}

// --- Fee tracking & Teacher commission ---

export async function updateOverdueFees() {
  const today = new Date().toISOString().split("T")[0]
  await turso.execute({
    sql: "update fees set status = 'OVERDUE' where balance > 0 and dueDate < ?",
    args: [today],
  })
}

export async function recomputeFeeForStudent(studentId: string) {
  const feesRs = await turso.execute({ sql: "select * from fees where studentId = ?", args: [studentId] })
  const fees = feesRs.rows as Fee[]
  if (fees.length === 0) return

  // Sum payments per fee. Payments that were recorded without a feeId are
  // applied to the oldest unpaid fee first (legacy data migration).
  const payRs = await turso.execute({
    sql: "select feeId, amount from payments where studentId = ?",
    args: [studentId],
  })
  const payRows = payRs.rows as any[]
  const paidByFee: Record<string, number> = {}
  let unattached = 0
  for (const p of payRows) {
    const amount = Number(p.amount) || 0
    if (p.feeId) paidByFee[p.feeId] = (paidByFee[p.feeId] || 0) + amount
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

  for (const fee of fees) {
    const totalFee = Number(fee.totalFee) || 0
    const paid = paidByFee[fee.id] || 0
    const balance = Math.max(0, totalFee - paid)
    const status = balance <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING"
    await turso.execute({
      sql: "update fees set balance = ?, status = ? where id = ?",
      args: [balance, status, fee.id],
    })
  }
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
  const fees = feeRs.rows as Fee[]
  const payRs = await turso.execute({
    sql: "select * from payments where studentId = ? order by paymentDate desc",
    args: [studentId],
  })
  const payRows = payRs.rows as any[]
  const payments = payRows as Payment[]

  const totalFee = fees.reduce((s, f) => s + (Number(f.totalFee) || 0), 0)
  const amountPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const balance = Math.max(0, totalFee - amountPaid)

  const nonPaidFees = fees.filter(f => f.status !== "PAID")
  const dueDates = nonPaidFees
    .map(f => f.dueDate)
    .filter((d): d is string => !!d)
    .sort()
  const nextDueDate = dueDates.length ? dueDates[0] : undefined

  const status = fees.length === 0 ? "NONE" : balance <= 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "OVERDUE"

  return { totalFee, amountPaid, balance, nextDueDate, status, payments }
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
}

export async function removeTeacherFromCourse(courseId: string, teacherId: string): Promise<void> {
  requireAuth()
  await turso.execute({
    sql: "delete from course_teachers where courseId = ? and teacherId = ?",
    args: [courseId, teacherId],
  })
}

async function commissionForTeacher(
  teacherId: string,
  studentId: string,
  courseId: string,
  course: any
): Promise<number> {
  const rate = Number(course.commissionRate) || 0
  const fee = Number(course.fee) || 0
  const percentPortion = (rate / 100) * fee
  // Per-student fixed amount from the teacher's commission contract
  let perStudentFixed = 0
  const contractRs = await turso.execute({
    sql: "select commissionPerStudent from teacher_contracts where teacherId = ? and compensationType = 'COMMISSION' and status = 'ACTIVE' order by createdAt desc limit 1",
    args: [teacherId],
  })
  const contract = contractRs.rows[0] as any
  if (contract?.commissionPerStudent) perStudentFixed = Number(contract.commissionPerStudent) || 0

  const commissionAmount = percentPortion + perStudentFixed
  if (commissionAmount <= 0) return 0

  await turso.execute({
    sql: "insert into teacher_commissions (id, teacherId, studentId, courseId, commissionRate, commissionAmount, paidAmount, status, createdAt) values (?, ?, ?, ?, ?, ?, 0, 'EARNED', ?)",
    args: [crypto.randomUUID(), teacherId, studentId, courseId, rate, commissionAmount, new Date().toISOString()],
  })
  return commissionAmount
}

export async function computeCommissionForEnrollment(studentId: string, courseId: string) {
  const courseRs = await turso.execute({ sql: "select * from courses where id = ?", args: [courseId] })
  const course = courseRs.rows[0] as any
  if (!course) throw new Error("Commission configuration unavailable for course")

  // Idempotency: skip if a commission already exists for this student + course
  const existingRs = await turso.execute({
    sql: "select id from teacher_commissions where studentId = ? and courseId = ?",
    args: [studentId, courseId],
  })
  if (existingRs.rows.length > 0) {
    return { success: true, commissionAmount: 0, alreadyExists: true }
  }

  // Pay every teacher assigned to the course (per-student commission).
  const teacherIds = await getCourseTeachers(courseId)
  let total = 0
  for (const tid of teacherIds) {
    total += await commissionForTeacher(tid, studentId, courseId, course)
  }
  return { success: true, commissionAmount: total }
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
      sql: `select courseId, count(*) as cnt from students where courseId in (${placeholders(uniqueCourseIds.length)}) group by courseId`,
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
      turso.execute({ sql: `select courseId, count(*) as cnt from students where courseId in (${placeholders(uniqueCourseIds.length)}) group by courseId`, args: uniqueCourseIds }),
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
