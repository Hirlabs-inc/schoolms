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

export async function getItems<T>(key: string): Promise<T[]> {
  requireAuth()
  const table = TABLE_MAP[key]
  if (!table) throw new Error(`Unknown key: ${key}`)

  const rs = await turso.execute(`select * from ${table}`)
  const rows = rs.rows as any[]

  if (key === "students") {
    const out: any[] = []
    for (const row of rows) {
      const p = await turso.execute({ sql: "select firstName, lastName, email from profiles where id = ?", args: [row.profileId || row.id] })
      const c = row.courseId ? await turso.execute({ sql: "select name from courses where id = ?", args: [row.courseId] }) : null
      out.push({
        ...row,
        firstName: p.rows[0]?.firstName || null,
        lastName: p.rows[0]?.lastName || null,
        email: p.rows[0]?.email || row.email || null,
        courseName: c?.rows[0]?.name,
      })
    }
    return out as T[]
  }

  if (key === "teachers") {
    const out: any[] = []
    for (const row of rows) {
      const p = await turso.execute({ sql: "select firstName, lastName, email from profiles where id = ?", args: [row.id] })
      out.push({ ...row, firstName: p.rows[0]?.firstName, lastName: p.rows[0]?.lastName, email: p.rows[0]?.email })
    }
    return out as T[]
  }

  if (key === "payments") {
    const out: any[] = []
    for (const row of rows) {
      let nameRow: any = null
      if (row.studentId) {
        const stu = await turso.execute({ sql: "select profileId from students where id = ?", args: [row.studentId] })
        const pId = stu.rows[0]?.profileId || row.studentId
        const p = await turso.execute({ sql: "select firstName, lastName, email from profiles where id = ?", args: [pId] })
        if (p.rows[0]) nameRow = p.rows[0]
        else nameRow = { firstName: null, lastName: null, email: row.email || null }
      }
      out.push({ ...row, firstName: nameRow?.firstName ?? null, lastName: nameRow?.lastName ?? null, email: nameRow?.email ?? row.email ?? null })
    }
    return out as T[]
  }

  if (key === "fees") {
    const out: any[] = []
    for (const row of rows) {
      const c = row.courseId ? await turso.execute({ sql: "select name from courses where id = ?", args: [row.courseId] }) : null
      out.push({ ...row, courseName: c?.rows[0]?.name })
    }
    return out as T[]
  }

  if (key === "expenses") {
    const out: any[] = []
    for (const row of rows) {
      const p = row.createdBy ? await turso.execute({ sql: "select firstName, lastName from profiles where id = ?", args: [row.createdBy] }) : null
      out.push({ ...row, firstName: p?.rows[0]?.firstName, lastName: p?.rows[0]?.lastName })
    }
    return out as T[]
  }

  if (key === "income") {
    const out: any[] = []
    for (const row of rows) {
      const p = row.createdBy ? await turso.execute({ sql: "select firstName, lastName from profiles where id = ?", args: [row.createdBy] }) : null
      out.push({ ...row, firstName: p?.rows[0]?.firstName, lastName: p?.rows[0]?.lastName })
    }
    return out as T[]
  }

  if (key === "teacherContracts") {
    const out: any[] = []
    for (const row of rows) {
      const p = await turso.execute({ sql: "select firstName, lastName from profiles where id = ?", args: [row.teacherId] })
      out.push({ ...row, teacherName: p.rows[0] ? `${p.rows[0].firstName} ${p.rows[0].lastName}` : "Unknown" })
    }
    return out as T[]
  }

  if (key === "payrollRecords") {
    const out: any[] = []
    for (const row of rows) {
      const p = await turso.execute({ sql: "select firstName, lastName from profiles where id = ?", args: [row.teacherId] })
      out.push({ ...row, teacherName: p.rows[0] ? `${p.rows[0].firstName} ${p.rows[0].lastName}` : "Unknown" })
    }
    return out as T[]
  }

  if (key === "enrollmentProgress") {
    const out: any[] = []
    for (const row of rows) {
      const p = await turso.execute({ sql: "select firstName, lastName from profiles where id = ?", args: [row.studentId] })
      const c = await turso.execute({ sql: "select name from courses where id = ?", args: [row.courseId] })
      out.push({
        ...row,
        studentName: p.rows[0] ? `${p.rows[0].firstName} ${p.rows[0].lastName}` : "Unknown",
        courseName: c.rows[0]?.name || "Unknown",
      })
    }
    return out as T[]
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
  const placeholders = cols.map(() => "?").join(", ")

  await turso.execute({
    sql: `insert into ${table} (${cols.map(c => `"${c}"`).join(", ")}) values (${placeholders})`,
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

  const rs = await turso.execute({
    sql: `update ${table} set ${setClause} where id = ? returning *`,
    args: [...vals, id],
  })

  if (rs.rows.length === 0) throw new Error(`Record not found in ${table} with id ${id}`)
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
  // 4. Delete payments linked to this student's fees
  await turso.execute({ sql: "delete from payments where \"studentId\" = ?", args: [id] })
  // 5. Delete income records linked to this student's fees
  await turso.execute({ sql: "delete from income where description like ?", args: [`%studentId:${id}%`] })
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
    // Auto-assign fee based on course
    if (userData.courseId) {
      const courseRs = await turso.execute({ sql: "select fee from courses where id = ?", args: [userData.courseId] })
      if (courseRs.rows.length > 0) {
        const fee = Number(courseRs.rows[0].fee) || 0
        await turso.execute({
          sql: "insert into fees (id, studentId, courseId, totalFee, balance, status) values (?, ?, ?, ?, ?, ?)",
          args: [crypto.randomUUID(), userId, userData.courseId, fee, fee, "PENDING"],
        })
      }
      // Auto-create enrollment progress record
      await turso.execute({
        sql: "insert into enrollment_progress (id, studentId, courseId, progressPercent, status, startDate) values (?, ?, ?, 0, 'ENROLLED', ?)",
        args: [crypto.randomUUID(), userId, userData.courseId, userData.admissionDate || null],
      })
      // Auto-compute teacher commission for this enrollment
      try {
        await computeCommissionForEnrollment(userId, userData.courseId)
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
      sql: "insert into teachers (id, staffId, department, specialization) values (?, ?, ?, ?)",
      args: [userId, userData.staffId || "TCH" + Math.floor(Math.random() * 1000), userData.department || null, userData.specialization || null],
    })
  }

  return { success: true, userId }
}

export function generateStudentNumber(): string {
  const year = new Date().getFullYear().toString().slice(-2)
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  return `STU${year}${random}`
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
  const paidRs = await turso.execute({ sql: "select coalesce(sum(amount), 0) as paid from payments where studentId = ?", args: [studentId] })
  const paid = Number(paidRs.rows[0]?.paid) || 0
  for (const fee of fees) {
    const totalFee = Number(fee.totalFee) || 0
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
  const balance = totalFee - amountPaid

  const nonPaidFees = fees.filter(f => f.status !== "PAID")
  const dueDates = nonPaidFees
    .map(f => f.dueDate)
    .filter((d): d is string => !!d)
    .sort()
  const nextDueDate = dueDates.length ? dueDates[0] : undefined

  const status = fees.length === 0 ? "NONE" : balance <= 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "OVERDUE"

  return { totalFee, amountPaid, balance, nextDueDate, status, payments }
}

export async function computeCommissionForEnrollment(studentId: string, courseId: string) {
  const courseRs = await turso.execute({ sql: "select * from courses where id = ?", args: [courseId] })
  const course = courseRs.rows[0] as any
  if (!course) throw new Error("Commission configuration unavailable for course")
  if (!course.teacherId || !course.commissionRate) {
    throw new Error("Commission configuration unavailable for course")
  }
  const rate = Number(course.commissionRate) || 0
  const fee = Number(course.fee) || 0
  const commissionAmount = rate * fee
  if (commissionAmount <= 0) return { success: true, commissionAmount: 0 }

  await turso.execute({
    sql: "insert into teacher_commissions (id, teacherId, studentId, courseId, commissionRate, commissionAmount, paidAmount, status) values (?, ?, ?, ?, ?, ?, 0, 'EARNED')",
    args: [crypto.randomUUID(), course.teacherId, studentId, courseId, rate, commissionAmount],
  })
  return { success: true, commissionAmount }
}

export async function getTeacherCommissionSummaries(teacherId?: string): Promise<TeacherCommissionSummary[]> {
  requireAuth()
  const teacherRs = teacherId
    ? await turso.execute({ sql: "select * from teachers where id = ?", args: [teacherId] })
    : await turso.execute({ sql: "select * from teachers" })
  const teacherRows = teacherRs.rows as any[]

  const summaries: TeacherCommissionSummary[] = []
  for (const teacher of teacherRows) {
    const tid = teacher.id
    const p = await turso.execute({ sql: "select firstName, lastName from profiles where id = ?", args: [tid] })
    const teacherName = p.rows[0] ? `${p.rows[0].firstName} ${p.rows[0].lastName}`.trim() : "Unknown"

    const courseRs = await turso.execute({ sql: "select id from courses where teacherId = ?", args: [tid] })
    const courseIds = (courseRs.rows as any[]).map(r => r.id)
    let totalStudentsAssigned = 0
    if (courseIds.length) {
      const placeholders = courseIds.map(() => "?").join(", ")
      const studentRs = await turso.execute({
        sql: `select count(*) as cnt from students where courseId in (${placeholders})`,
        args: courseIds,
      })
      totalStudentsAssigned = Number(studentRs.rows[0]?.cnt) || 0
    }

    const earnedRs = await turso.execute({
      sql: "select sum(commissionAmount) as s from teacher_commissions where teacherId = ?",
      args: [tid],
    })
    const paidRs = await turso.execute({
      sql: "select sum(paidAmount) as s from teacher_commissions where teacherId = ?",
      args: [tid],
    })

    const totalCommissionEarned = Number(earnedRs.rows[0]?.s) || 0
    const amountPaid = Number(paidRs.rows[0]?.s) || 0

    summaries.push({
      teacherId: tid,
      teacherName,
      totalStudentsAssigned,
      totalCommissionEarned,
      amountPaid,
      remainingBalance: Math.max(0, totalCommissionEarned - amountPaid),
    })
  }
  return summaries
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
