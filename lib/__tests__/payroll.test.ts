import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { processPayroll, getPayrollSummary, getItems } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

describe("Payroll - Extended", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("processPayroll with SALARY type creates record and expense", async () => {
    const result = await processPayroll("t1", "ctr1", 40000, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")
    expect(result.success).toBe(true)
    expect(tables.payroll_records).toHaveLength(1)
    expect(tables.payroll_records[0].amount).toBe(40000)
    expect(tables.payroll_records[0].status).toBe("PAID")
    expect(tables.expenses).toHaveLength(1)
    expect(tables.expenses[0].category).toBe("SALARIES")
  })

  it("processPayroll with COMMISSION type", async () => {
    await processPayroll("t1", "ctr1", 5000, "2026-02-01", "2026-02-28", "2026-02-28", "COMMISSION")
    expect(tables.payroll_records[0].payType).toBe("COMMISSION")
    expect(tables.expenses[0].description).toContain("COMMISSION")
  })

  it("processPayroll with notes", async () => {
    await processPayroll("t1", "ctr1", 30000, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY", "January salary")
    expect(tables.payroll_records[0].notes).toBe("January salary")
  })

  it("processPayroll without notes defaults to null", async () => {
    await processPayroll("t1", "ctr1", 30000, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")
    expect(tables.payroll_records[0].notes).toBeNull()
  })

  it("multiple payroll records for same teacher", async () => {
    await processPayroll("t1", "ctr1", 30000, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")
    await processPayroll("t1", "ctr1", 30000, "2026-02-01", "2026-02-28", "2026-02-28", "SALARY")
    expect(tables.payroll_records).toHaveLength(2)
    expect(tables.expenses).toHaveLength(2)
  })

  it("payroll for different teachers", async () => {
    await processPayroll("t1", "ctr1", 30000, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")
    await processPayroll("t2", "ctr2", 25000, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")
    expect(tables.payroll_records).toHaveLength(2)
  })

  it("getPayrollSummary for specific month", async () => {
    tables.payroll_records.push(
      { id: "p1", teacherId: "t1", amount: 30000, periodStart: "2026-01-01", periodEnd: "2026-01-31", payDate: "2026-01-31", payType: "SALARY", status: "PAID" },
      { id: "p2", teacherId: "t2", amount: 25000, periodStart: "2026-01-01", periodEnd: "2026-01-31", payDate: "2026-01-31", payType: "SALARY", status: "PAID" },
    )
    const summary = await getPayrollSummary(2026, 1)
    expect(summary.totalPayroll).toBe(55000)
    expect(summary.payCount).toBe(2)
  })

  it("getPayrollSummary excludes non-PAID records", async () => {
    tables.payroll_records.push(
      { id: "p1", teacherId: "t1", amount: 30000, periodStart: "2026-01-01", periodEnd: "2026-01-31", payDate: "2026-01-31", payType: "SALARY", status: "PAID" },
      { id: "p2", teacherId: "t2", amount: 25000, periodStart: "2026-01-01", periodEnd: "2026-01-31", payDate: "2026-01-31", payType: "SALARY", status: "PENDING" },
    )
    const summary = await getPayrollSummary(2026, 1)
    expect(summary.totalPayroll).toBe(30000)
    expect(summary.payCount).toBe(1)
  })

  it("getPayrollSummary returns 0 for empty month", async () => {
    const summary = await getPayrollSummary(2026, 12)
    expect(summary.totalPayroll).toBe(0)
    expect(summary.payCount).toBe(0)
  })

  it("getItems payrollRecords enriches with teacherName", async () => {
    tables.profiles.push({ id: "t1", firstName: "Jane", lastName: "Smith" })
    tables.payroll_records.push({ id: "pr1", teacherId: "t1", amount: 40000, payType: "SALARY", status: "PAID" })
    const records = await getItems<any>("payrollRecords")
    expect(records[0].teacherName).toBe("Jane Smith")
  })

  it("payroll expense description includes period", async () => {
    await processPayroll("t1", "ctr1", 30000, "2026-03-01", "2026-03-31", "2026-03-31", "SALARY")
    expect(tables.expenses[0].description).toContain("2026-03-01")
    expect(tables.expenses[0].description).toContain("2026-03-31")
  })

  it("payroll with zero amount", async () => {
    await processPayroll("t1", "ctr1", 0, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")
    expect(tables.payroll_records[0].amount).toBe(0)
    expect(tables.expenses[0].amount).toBe(0)
  })
})
