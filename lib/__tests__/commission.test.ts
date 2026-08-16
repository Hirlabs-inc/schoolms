import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { createUser, computeCommissionForEnrollment, getTeacherCommissionSummaries } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

describe("Teacher Commission generation on enrollment", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("creates a commission row when a student enrolls in a course with a commissionRate", async () => {
    tables.teachers.push({ id: "t1", staffId: "TCH1", department: "Academics" })
    tables.profiles.push({ id: "t1", firstName: "Teach", lastName: "Er" })
    tables.courses.push({
      id: "c1", name: "Mathematics", code: "MTH", classId: "cl1",
      teacherId: "t1", fee: 100000, commissionRate: 10,
    })
    tables.teacher_contracts.push({
      id: "ctr1", teacherId: "t1", compensationType: "COMMISSION",
      commissionRate: 10, commissionPerStudent: 500, status: "ACTIVE",
    })

    await createUser({
      email: "stu@test.com", password: "p", role: "STUDENT",
      firstName: "Stu", lastName: "Dent", courseId: "c1",
    })

    expect(tables.teacher_commissions).toHaveLength(1)
    const c = tables.teacher_commissions[0]
    expect(c.teacherId).toBe("t1")
    expect(c.courseId).toBe("c1")
    expect(c.status).toBe("EARNED")
    expect(c.paidAmount).toBe(0)
    expect(Number(c.commissionAmount)).toBeGreaterThan(0)
    // fee * rate/100 + perStudent = 100000 * 0.10 + 500 = 10500
    expect(Number(c.commissionAmount)).toBeCloseTo(10500)
  })

  it("creates no commission for a course without a teacherId", async () => {
    tables.courses.push({
      id: "c1", name: "Math", code: "MTH", classId: "cl1",
      fee: 100000, commissionRate: 10,
    })
    await createUser({
      email: "stu@test.com", password: "p", role: "STUDENT",
      firstName: "Stu", lastName: "Dent", courseId: "c1",
    })
    expect(tables.teacher_commissions).toHaveLength(0)
  })

  it("is idempotent - does not double-insert for the same student + course", async () => {
    tables.teachers.push({ id: "t1", staffId: "TCH1", department: "Academics" })
    tables.profiles.push({ id: "t1", firstName: "Teach", lastName: "Er" })
    tables.courses.push({
      id: "c1", name: "Mathematics", code: "MTH", classId: "cl1",
      teacherId: "t1", fee: 100000, commissionRate: 10,
    })

    const res = await createUser({
      email: "stu@test.com", password: "p", role: "STUDENT",
      firstName: "Stu", lastName: "Dent", courseId: "c1",
    })
    await computeCommissionForEnrollment(res.userId as unknown as string, "c1")

    expect(tables.teacher_commissions).toHaveLength(1)
  })

  it("commission failure never blocks student creation", async () => {
    tables.courses.push({
      id: "c1", name: "Math", code: "MTH", classId: "cl1",
      teacherId: "t1", fee: 100000, commissionRate: 10,
    })
    const res = await createUser({
      email: "stu@test.com", password: "p", role: "STUDENT",
      firstName: "Stu", lastName: "Dent", courseId: "c1",
    })
    expect(res.success).toBe(true)
    expect(tables.students).toHaveLength(1)
  })

  it("reflects in getTeacherCommissionSummaries total earned", async () => {
    tables.teachers.push({ id: "t1", staffId: "TCH1", department: "Academics" })
    tables.profiles.push({ id: "t1", firstName: "Teach", lastName: "Er" })
    tables.courses.push({
      id: "c1", name: "Mathematics", code: "MTH", classId: "cl1",
      teacherId: "t1", fee: 100000, commissionRate: 10,
    })
    await createUser({
      email: "stu@test.com", password: "p", role: "STUDENT",
      firstName: "Stu", lastName: "Dent", courseId: "c1",
    })

    const summaries = await getTeacherCommissionSummaries()
    const t1 = summaries.find(s => s.teacherId === "t1")
    expect(t1).toBeDefined()
    expect(t1!.totalCommissionEarned).toBeGreaterThan(0)
  })
})
