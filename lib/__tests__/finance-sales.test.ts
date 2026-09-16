import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import {
  computeChargeAmounts, enrollStudentInCourse, unenrollStudentFromCourse,
  syncStudentEnrollments, addRegistrationFeeIfNeeded, recomputeFeeForStudent,
  getStudentFeeSummary, getStudentLedger, recordStudentPayment,
} from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

function seedStudent(id = "s1") {
  tables.students.push({ id, studentNumber: "STU001", firstName: "Stu", lastName: "Dent", status: "ACTIVE" })
}

function seedFinance(registrationFee = 0, taxRate = 0) {
  tables.institution_settings.push({ id: "main", name: "Inst", currency: "KES", registrationFee, taxRate })
}

describe("computeChargeAmounts", () => {
  it("applies discount then tax", () => {
    const r = computeChargeAmounts(1000, 100, 16)
    expect(r.grossAmount).toBe(1000)
    expect(r.discountAmount).toBe(100)
    expect(r.taxAmount).toBe(144)
    expect(r.totalFee).toBe(1044)
  })

  it("clamps discount to gross and handles zero tax", () => {
    const r = computeChargeAmounts(500, 999, 0)
    expect(r.discountAmount).toBe(500)
    expect(r.totalFee).toBe(0)
  })
})

describe("Registration fee", () => {
  beforeEach(async () => { resetDb(); await seedAdmin(); seedStudent(); seedFinance(500, 0) })

  it("is charged once on first enrollment", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", fee: 10000 })
    await enrollStudentInCourse("s1", "c1")
    const reg = tables.fees.filter((f: any) => f.feeType === "REGISTRATION")
    expect(reg).toHaveLength(1)
    expect(Number(reg[0].totalFee)).toBe(500)

    // A second course must not add another registration fee.
    tables.courses.push({ id: "c2", name: "Physics", code: "PHY", fee: 8000 })
    await enrollStudentInCourse("s1", "c2")
    expect(tables.fees.filter((f: any) => f.feeType === "REGISTRATION")).toHaveLength(1)
  })

  it("is skipped when the fee is zero", async () => {
    resetDb(); await seedAdmin(); seedStudent(); seedFinance(0, 0)
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", fee: 10000 })
    await addRegistrationFeeIfNeeded("s1")
    expect(tables.fees).toHaveLength(0)
  })
})

describe("Enrollment billing", () => {
  beforeEach(async () => { resetDb(); await seedAdmin(); seedStudent(); seedFinance(0, 16) })

  it("enroll creates an enrollment and a taxed course charge", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", fee: 10000 })
    await enrollStudentInCourse("s1", "c1", { discountAmount: 1000, discountReason: "Sibling" })
    expect(tables.enrollment_progress).toHaveLength(1)
    const fee = tables.fees.find((f: any) => f.feeType === "COURSE")
    // 10000 - 1000 = 9000, +16% = 10440
    expect(Number(fee.totalFee)).toBe(10440)
    expect(Number(fee.discountAmount)).toBe(1000)
    expect(fee.discountReason).toBe("Sibling")
  })

  it("enroll is idempotent", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", fee: 10000 })
    await enrollStudentInCourse("s1", "c1")
    await enrollStudentInCourse("s1", "c1")
    expect(tables.enrollment_progress).toHaveLength(1)
    expect(tables.fees).toHaveLength(1)
  })

  it("sync adds and removes enrollments with their charges", async () => {
    tables.courses.push(
      { id: "c1", name: "Math", code: "MTH", fee: 10000 },
      { id: "c2", name: "Physics", code: "PHY", fee: 8000 },
    )
    await syncStudentEnrollments("s1", ["c1"])
    expect(tables.fees).toHaveLength(1)
    await syncStudentEnrollments("s1", ["c1", "c2"])
    expect(tables.fees).toHaveLength(2)
    // Drop c1 (unpaid) → its charge is deleted.
    await syncStudentEnrollments("s1", ["c2"])
    expect(tables.enrollment_progress).toHaveLength(1)
    expect(tables.fees).toHaveLength(1)
    expect(tables.fees[0].courseId).toBe("c2")
  })

  it("unenroll with payments cancels the charge so the payment becomes credit", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", fee: 10000 })
    await enrollStudentInCourse("s1", "c1")
    const fee = tables.fees[0]
    await recordStudentPayment({
      studentId: "s1", feeId: fee.id, amount: 4000,
      paymentDate: "2026-01-10", paymentMethod: "CASH", receiptNumber: "RCP1",
    })
    await unenrollStudentFromCourse("s1", "c1")
    expect(tables.fees[0].status).toBe("CANCELLED")
    const summary = await getStudentFeeSummary("s1")
    expect(summary.totalFee).toBe(0)
    expect(summary.credit).toBe(4000)
  })
})

describe("Credit balance", () => {
  beforeEach(async () => { resetDb(); await seedAdmin(); seedStudent(); seedFinance(0, 0) })

  it("overpayment becomes credit and auto-applies to new charges", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", fee: 10000 })
    await enrollStudentInCourse("s1", "c1")
    const fee = tables.fees[0]
    await recordStudentPayment({
      studentId: "s1", feeId: fee.id, amount: 15000,
      paymentDate: "2026-01-10", paymentMethod: "CASH", receiptNumber: "RCP1",
    })
    let summary = await getStudentFeeSummary("s1")
    expect(summary.balance).toBe(0)
    expect(summary.credit).toBe(5000)

    // A new charge consumes the credit automatically.
    tables.courses.push({ id: "c2", name: "Physics", code: "PHY", fee: 8000 })
    await enrollStudentInCourse("s1", "c2")
    summary = await getStudentFeeSummary("s1")
    expect(summary.totalFee).toBe(18000)
    expect(summary.credit).toBe(0)
    expect(summary.balance).toBe(3000)
  })
})

describe("Student ledger", () => {
  beforeEach(async () => { resetDb(); await seedAdmin(); seedStudent(); seedFinance(0, 0) })

  it("lists charges and payments with a running balance", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", fee: 10000 })
    await enrollStudentInCourse("s1", "c1")
    const fee = tables.fees[0]
    await recordStudentPayment({
      studentId: "s1", feeId: fee.id, amount: 6000,
      paymentDate: "2026-02-01", paymentMethod: "M_PESA", receiptNumber: "RCP9",
    })
    const ledger = await getStudentLedger("s1")
    const types = ledger.entries.map((e) => e.type)
    expect(types).toContain("CHARGE")
    expect(types).toContain("PAYMENT")
    expect(ledger.totals.net).toBe(10000)
    expect(ledger.totals.paid).toBe(6000)
    expect(ledger.totals.balance).toBe(4000)
    expect(ledger.entries[ledger.entries.length - 1].balance).toBe(4000)
  })
})
