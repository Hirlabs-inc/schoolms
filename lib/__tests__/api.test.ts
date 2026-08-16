import { describe, it, expect, beforeEach, vi } from "vitest"
import { resetDb } from "../../vitest.setup"
import {
  login, logout, getCurrentUser, updatePassword,
  createUser, generateStudentNumber,
  getItems, addItem, updateItem, deleteItem, upsertItem,
  resetPassword,
  processPayroll, getPayrollSummary,
  getIncomeSummary,
  getEnrollmentStats,
} from "../api"

// Seed an admin user into the mock DB & set its token
async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  const { tables } = await import("../../vitest.setup")
  tables.profiles.push({
    id: "admin-1",
    email: "admin@school.com",
    password: hash,
    role: "ADMIN",
    firstName: "Admin",
    lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

function clearAuth() {
  localStorage.removeItem("auth_token")
}

describe("Auth", () => {
  beforeEach(() => { resetDb() })

  it("login succeeds with valid credentials", async () => {
    const bcrypt = await import("bcryptjs")
    const { tables } = await import("../../vitest.setup")
    const hash = await bcrypt.hash("pass", 10)
    tables.profiles.push({ id: "u1", email: "a@b.com", password: hash, role: "ADMIN", firstName: "A", lastName: "B" })
    const user = await login("a@b.com", "pass")
    expect(user.email).toBe("a@b.com")
    expect(user.role).toBe("ADMIN")
    expect(localStorage.getItem("auth_token")).toBe("mock-jwt-token")
  })

  it("login fails with wrong password", async () => {
    const bcrypt = await import("bcryptjs")
    const { tables } = await import("../../vitest.setup")
    const hash = await bcrypt.hash("pass", 10)
    tables.profiles.push({ id: "u1", email: "a@b.com", password: hash, role: "ADMIN", firstName: "A", lastName: "B" })
    await expect(login("a@b.com", "wrong")).rejects.toThrow("Invalid email or password")
  })

  it("login fails with unknown email", async () => {
    await expect(login("nobody@b.com", "pass")).rejects.toThrow("Invalid email or password")
  })

  it("logout clears token", async () => {
    localStorage.setItem("auth_token", "tok")
    await logout()
    expect(localStorage.getItem("auth_token")).toBeNull()
  })

  it("getCurrentUser returns null when no token", async () => {
    const u = await getCurrentUser()
    expect(u).toBeNull()
  })

  it("getCurrentUser returns user from token", async () => {
    await seedAdmin()
    const u = await getCurrentUser()
    expect(u).not.toBeNull()
    expect(u!.email).toBe("admin@school.com")
    expect(u!.role).toBe("ADMIN")
  })

  it("updatePassword changes password", async () => {
    await seedAdmin()
    const { tables } = await import("../../vitest.setup")
    const ok = await updatePassword("newpass")
    expect(ok).toBe(true)
    const profile = tables.profiles.find((p: any) => p.id === "admin-1")
    expect(profile.password).toBe("hashed_newpass")
  })

  it("resetPassword succeeds for existing email", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.profiles.push({ id: "u1", email: "x@y.com", password: "h", role: "STUDENT", firstName: "X", lastName: "Y" })
    const ok = await resetPassword("x@y.com")
    expect(ok).toBe(true)
  })

  it("resetPassword throws for unknown email", async () => {
    await expect(resetPassword("no@no.com")).rejects.toThrow("No account found")
  })
})

describe("Generic CRUD", () => {
  beforeEach(async () => {
    resetDb()
    await seedAdmin()
  })

  it("getItems returns rows from a table", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" })
    const courses = await getItems<any>("courses")
    expect(courses).toHaveLength(1)
    expect(courses[0].name).toBe("Math")
  })

  it("getItems throws for unknown key", async () => {
    await expect(getItems("nope")).rejects.toThrow("Unknown key")
  })

  it("addItem inserts and returns with id", async () => {
    const course = await addItem("courses", { name: "Science", code: "SCI", classId: "c1", teacherId: "t1" })
    expect(course.id).toBeDefined()
    const { tables } = await import("../../vitest.setup")
    expect(tables.courses).toHaveLength(1)
  })

  it("addItem preserves existing id", async () => {
    const course = await addItem("courses", { id: "my-id", name: "Art", code: "ART", classId: "c1", teacherId: "t1" })
    expect(course.id).toBe("my-id")
  })

  it("updateItem updates and returns", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.courses.push({ id: "c1", name: "Old", code: "OLD", classId: "c1", teacherId: "t1" })
    const updated = await updateItem("courses", "c1", { name: "New" })
    expect(updated.name).toBe("New")
  })

  it("updateItem throws on missing record", async () => {
    await expect(updateItem("courses", "ghost", { name: "Nope" })).rejects.toThrow("Record not found")
  })

  it("deleteItem removes a row", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.courses.push({ id: "c1", name: "Delete me", code: "DEL", classId: "c1", teacherId: "t1" })
    await deleteItem("courses", "c1")
    expect(tables.courses).toHaveLength(0)
  })

  it("upsertItem inserts new", async () => {
    const r = await upsertItem("courses", { name: "New", code: "NEW", classId: "c1", teacherId: "t1" })
    expect(r.id).toBeDefined()
  })

  it("upsertItem updates existing", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.courses.push({ id: "c1", name: "Old", code: "OLD", classId: "c1", teacherId: "t1" })
    const r = await upsertItem("courses", { id: "c1", name: "Updated", code: "OLD", classId: "c1", teacherId: "t1" })
    expect(r.name).toBe("Updated")
  })

  it("requires auth for all CRUD", async () => {
    clearAuth()
    await expect(getItems("courses")).rejects.toThrow("Authentication required")
    await expect(addItem("courses", { name: "X", code: "X", classId: "x", teacherId: "x" })).rejects.toThrow("Authentication required")
    await expect(updateItem("courses", "x", { name: "X" })).rejects.toThrow("Authentication required")
    await expect(deleteItem("courses", "x")).rejects.toThrow("Authentication required")
    await expect(upsertItem("courses", { name: "X", code: "X", classId: "x", teacherId: "x" })).rejects.toThrow("Authentication required")
  })
})

describe("createUser (Admin-only)", () => {
  beforeEach(async () => {
    resetDb()
    await seedAdmin()
  })

  it("creates a student with auto-fee when courseId provided", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.courses.push({ id: "c-math", name: "Math", code: "MTH", classId: "c1", teacherId: "t1", fee: 50000 })
    const result = await createUser({
      email: "student@test.com", password: "pass", role: "STUDENT",
      firstName: "Stu", lastName: "Dent", courseId: "c-math",
    })
    expect(result.success).toBe(true)
    // Student record created
    expect(tables.students).toHaveLength(1)
    expect(tables.students[0].courseId).toBe("c-math")
    // Fee auto-created
    expect(tables.fees).toHaveLength(1)
    expect(tables.fees[0].totalFee).toBe(50000)
    expect(tables.fees[0].balance).toBe(50000)
    expect(tables.fees[0].status).toBe("PENDING")
  })

  it("creates a student without fee when no courseId", async () => {
    const { tables } = await import("../../vitest.setup")
    const result = await createUser({
      email: "s@t.com", password: "pass", role: "STUDENT",
      firstName: "S", lastName: "T",
    })
    expect(result.success).toBe(true)
    expect(tables.students).toHaveLength(1)
    expect(tables.fees).toHaveLength(0)
  })

  it("creates a teacher", async () => {
    const { tables } = await import("../../vitest.setup")
    const result = await createUser({
      email: "t@t.com", password: "pass", role: "TEACHER",
      firstName: "Teach", lastName: "Er",
      staffId: "TCH001", department: "Science",
    })
    expect(result.success).toBe(true)
    expect(tables.teachers).toHaveLength(1)
    expect(tables.teachers[0].staffId).toBe("TCH001")
  })

  it("rejects non-admin users", async () => {
    clearAuth()
    const { tables } = await import("../../vitest.setup")
    tables.profiles.push({ id: "stu-1", email: "s@t.com", password: "h", role: "STUDENT", firstName: "S", lastName: "T" })
    localStorage.setItem("auth_token", "mock-student-token")
    await expect(createUser({
      email: "bad@t.com", password: "pass", role: "STUDENT",
      firstName: "B", lastName: "D",
    })).rejects.toThrow("Only admins can create users")
  })

  it("generateStudentNumber returns correct format", () => {
    const num = generateStudentNumber()
    const year = new Date().getFullYear().toString().slice(-2)
    expect(num).toMatch(new RegExp(`^STU${year}\\d{4}$`))
  })
})

describe("Payroll", () => {
  beforeEach(async () => {
    resetDb()
    await seedAdmin()
  })

  it("processPayroll creates payroll record and expense", async () => {
    const { tables } = await import("../../vitest.setup")
    const result = await processPayroll("t1", "ctr1", 30000, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")
    expect(result.success).toBe(true)
    // Payroll record
    expect(tables.payroll_records).toHaveLength(1)
    expect(tables.payroll_records[0].amount).toBe(30000)
    expect(tables.payroll_records[0].payType).toBe("SALARY")
    // Expense record auto-created
    expect(tables.expenses).toHaveLength(1)
    expect(tables.expenses[0].category).toBe("SALARIES")
    expect(tables.expenses[0].amount).toBe(30000)
  })

  it("processPayroll with COMMISSION type", async () => {
    const { tables } = await import("../../vitest.setup")
    await processPayroll("t2", "ctr2", 5000, "2026-02-01", "2026-02-28", "2026-02-28", "COMMISSION")
    expect(tables.payroll_records[0].payType).toBe("COMMISSION")
    expect(tables.expenses[0].description).toContain("COMMISSION")
  })

  it("getPayrollSummary returns totals", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.payroll_records.push(
      { id: "p1", teacherId: "t1", amount: 30000, periodStart: "2026-01-01", periodEnd: "2026-01-31", payDate: "2026-01-31", payType: "SALARY", status: "PAID" },
      { id: "p2", teacherId: "t1", amount: 20000, periodStart: "2026-02-01", periodEnd: "2026-02-28", payDate: "2026-02-28", payType: "SALARY", status: "PAID" },
    )
    const summary = await getPayrollSummary(2026, 1)
    expect(summary.totalPayroll).toBe(30000)
    expect(summary.payCount).toBe(1)
  })

  it("getPayrollSummary returns 0 for empty month", async () => {
    const summary = await getPayrollSummary(2026, 6)
    expect(summary.totalPayroll).toBe(0)
    expect(summary.payCount).toBe(0)
  })
})

describe("Income", () => {
  beforeEach(async () => {
    resetDb()
    await seedAdmin()
  })

  it("getIncomeSummary groups by category", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.income.push(
      { id: "i1", category: "FEES", amount: 100000, incomeDate: "2026-01-15" },
      { id: "i2", category: "FEES", amount: 50000, incomeDate: "2026-01-20" },
      { id: "i3", category: "GRANTS", amount: 200000, incomeDate: "2026-02-01" },
    )
    const summary = await getIncomeSummary(2026)
    expect(summary).toHaveLength(2)
    const fees = summary.find((s: any) => s.category === "FEES")
    const grants = summary.find((s: any) => s.category === "GRANTS")
    expect(fees.total).toBe(150000)
    expect(grants.total).toBe(200000)
  })

  it("getIncomeSummary with month filter", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.income.push(
      { id: "i1", category: "FEES", amount: 100000, incomeDate: "2026-01-15" },
      { id: "i2", category: "FEES", amount: 50000, incomeDate: "2026-02-20" },
    )
    const summary = await getIncomeSummary(2026, 1)
    expect(summary).toHaveLength(1)
    expect(summary[0].total).toBe(100000)
  })
})

describe("Enrollment Progress", () => {
  beforeEach(async () => {
    resetDb()
    await seedAdmin()
  })

  it("getEnrollmentStats returns zeroes with no data", async () => {
    const stats = await getEnrollmentStats()
    expect(stats.total).toBe(0)
    expect(stats.byStatus).toHaveLength(0)
    expect(stats.avgProgress).toBe(0)
  })

  it("getEnrollmentStats returns correct aggregates", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.enrollment_progress.push(
      { id: "e1", studentId: "s1", courseId: "c1", progressPercent: 50, status: "IN_PROGRESS" },
      { id: "e2", studentId: "s2", courseId: "c1", progressPercent: 100, status: "COMPLETED" },
      { id: "e3", studentId: "s3", courseId: "c2", progressPercent: 75, status: "IN_PROGRESS" },
    )
    const stats = await getEnrollmentStats()
    expect(stats.total).toBe(3)
    expect(stats.avgProgress).toBe(75) // (50+100+75)/3 = 75
  })
})

describe("Edge Cases & Security", () => {
  beforeEach(async () => {
    resetDb()
    await seedAdmin()
  })

  it("getItems with students key enriches with names", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.profiles.push({ id: "s1", email: "stu@t.com", password: "h", role: "STUDENT", firstName: "John", lastName: "Doe" })
    tables.students.push({ id: "s1", studentNumber: "STU260001", courseId: "c1" })
    tables.courses.push({ id: "c1", name: "Math", code: "MTH" })
    const students = await getItems<any>("students")
    expect(students[0].firstName).toBe("John")
    expect(students[0].lastName).toBe("Doe")
    expect(students[0].courseName).toBe("Math")
  })

  it("getItems with payments key enriches with student name", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.profiles.push({ id: "s1", firstName: "Stu", lastName: "Dent" })
    tables.payments.push({ id: "pay1", studentId: "s1", amount: 10000, paymentMethod: "CASH", paymentDate: "2026-01-15", receiptNumber: "RCP001" })
    const payments = await getItems<any>("payments")
    expect(payments[0].firstName).toBe("Stu")
    expect(payments[0].lastName).toBe("Dent")
  })

  it("getItems with fees key enriches with courseName", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.courses.push({ id: "c1", name: "Science", code: "SCI" })
    tables.fees.push({ id: "f1", studentId: "s1", courseId: "c1", totalFee: 30000, balance: 15000, status: "PARTIAL" })
    const fees = await getItems<any>("fees")
    expect(fees[0].courseName).toBe("Science")
  })

  it("getItems with expenses key enriches with createdBy name", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.profiles.push({ id: "adm1", firstName: "Ad", lastName: "Min" })
    tables.expenses.push({ id: "e1", category: "RENT", amount: 50000, description: "Rent", expenseDate: "2026-01-01", createdBy: "adm1" })
    const expenses = await getItems<any>("expenses")
    expect(expenses[0].firstName).toBe("Ad")
    expect(expenses[0].lastName).toBe("Min")
  })

  it("getItems with income key enriches with createdBy name", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.profiles.push({ id: "adm1", firstName: "Ad", lastName: "Min" })
    tables.income.push({ id: "i1", category: "FEES", amount: 10000, description: "Fees", incomeDate: "2026-01-01", createdBy: "adm1" })
    const income = await getItems<any>("income")
    expect(income[0].firstName).toBe("Ad")
  })

  it("getItems with teacherContracts enriches with teacherName", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.profiles.push({ id: "t1", firstName: "Teach", lastName: "Er" })
    tables.teacher_contracts.push({ id: "tc1", teacherId: "t1", compensationType: "SALARY", status: "ACTIVE" })
    const contracts = await getItems<any>("teacherContracts")
    expect(contracts[0].teacherName).toBe("Teach Er")
  })

  it("getItems with payrollRecords enriches with teacherName", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.profiles.push({ id: "t1", firstName: "Jane", lastName: "Smith" })
    tables.payroll_records.push({ id: "pr1", teacherId: "t1", amount: 40000, payType: "SALARY", status: "PAID" })
    const records = await getItems<any>("payrollRecords")
    expect(records[0].teacherName).toBe("Jane Smith")
  })

  it("getItems with enrollmentProgress enriches with names", async () => {
    const { tables } = await import("../../vitest.setup")
    tables.profiles.push({ id: "s1", firstName: "Stu", lastName: "Dent" })
    tables.courses.push({ id: "c1", name: "Physics", code: "PHY" })
    tables.enrollment_progress.push({ id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 60, status: "IN_PROGRESS" })
    const ep = await getItems<any>("enrollmentProgress")
    expect(ep[0].studentName).toBe("Stu Dent")
    expect(ep[0].courseName).toBe("Physics")
  })
})

describe("Unauthorized access", () => {
  it("throws on all protected operations", async () => {
    clearAuth()
    await expect(getItems("courses")).rejects.toThrow("Authentication required")
    await expect(addItem("courses", { name: "X", code: "X", classId: "x", teacherId: "x" })).rejects.toThrow("Authentication required")
    await expect(processPayroll("t", "c", 100, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")).rejects.toThrow("Authentication required")
    await expect(getPayrollSummary(2026, 1)).rejects.toThrow("Authentication required")
    await expect(getIncomeSummary(2026)).rejects.toThrow("Authentication required")
    await expect(getEnrollmentStats()).rejects.toThrow("Authentication required")
  })
})
