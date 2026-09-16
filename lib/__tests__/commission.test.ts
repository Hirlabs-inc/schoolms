import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { createUser, computeCommissionForEnrollment, getTeacherCommissionSummaries, enrollStudentInCourse, updateItem } from "../api"

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

  it("pays EVERY teacher assigned to a course (per-student commission for each)", async () => {
    // Two teachers assigned to the same course via course_teachers
    tables.teachers.push({ id: "t1", staffId: "TCH1", department: "Academics" })
    tables.teachers.push({ id: "t2", staffId: "TCH2", department: "Academics" })
    tables.profiles.push({ id: "t1", firstName: "Teach", lastName: "One" })
    tables.profiles.push({ id: "t2", firstName: "Teach", lastName: "Two" })
    tables.courses.push({
      id: "c1", name: "Mathematics", code: "MTH", classId: "cl1",
      fee: 100000, commissionRate: 10, // no single teacherId; assignment is via course_teachers
    })
    tables.teacher_contracts.push({
      id: "ctr1", teacherId: "t1", compensationType: "COMMISSION",
      commissionRate: 10, commissionPerStudent: 500, status: "ACTIVE",
    })
    tables.teacher_contracts.push({
      id: "ctr2", teacherId: "t2", compensationType: "COMMISSION",
      commissionRate: 10, commissionPerStudent: 500, status: "ACTIVE",
    })
    // Assign both teachers to the course
    tables.course_teachers.push({ courseId: "c1", teacherId: "t1", createdAt: "2026-01-01" })
    tables.course_teachers.push({ courseId: "c1", teacherId: "t2", createdAt: "2026-01-01" })

    await createUser({
      email: "stu@test.com", password: "p", role: "STUDENT",
      firstName: "Stu", lastName: "Dent", courseId: "c1",
    })

    // One commission row per assigned teacher
    expect(tables.teacher_commissions).toHaveLength(2)
    const teachers = tables.teacher_commissions.map((c: any) => c.teacherId).sort()
    expect(teachers).toEqual(["t1", "t2"])
    // Each gets fee*rate/100 + perStudent = 100000*0.10 + 500 = 10500
    for (const c of tables.teacher_commissions) {
      expect(Number(c.commissionAmount)).toBeCloseTo(10500)
      expect(c.status).toBe("EARNED")
    }

    const summaries = await getTeacherCommissionSummaries()
    const s1 = summaries.find(s => s.teacherId === "t1")
    const s2 = summaries.find(s => s.teacherId === "t2")
    expect(s1!.totalCommissionEarned).toBeCloseTo(10500)
    expect(s2!.totalCommissionEarned).toBeCloseTo(10500)
    // Student counts toward both assigned teachers
    expect(s1!.totalStudentsAssigned).toBe(1)
    expect(s2!.totalStudentsAssigned).toBe(1)
  })
})

describe("Teacher Commission is live", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  function seedCourse(id: string, fee: number, rate: number) {
    tables.teachers.push({ id: "t1", staffId: "TCH1", department: "Academics" })
    tables.profiles.push({ id: "t1", firstName: "Teach", lastName: "Er" })
    tables.courses.push({ id, name: id, code: id.toUpperCase(), teacherId: "t1", fee, commissionRate: rate })
    tables.course_teachers.push({ courseId: id, teacherId: "t1", createdAt: "2026-01-01" })
  }

  it("is based on the student's net (discounted) charge, not the list fee", async () => {
    seedCourse("c1", 100000, 10)
    await enrollStudentInCourse("s1", "c1", { discountAmount: 20000 })
    const c = tables.teacher_commissions[0]
    // net = 100000 - 20000 = 80000 → 10% = 8000
    expect(Number(c.commissionAmount)).toBeCloseTo(8000)
  })

  it("updates when the fee/discount is edited afterwards", async () => {
    seedCourse("c1", 100000, 10)
    await enrollStudentInCourse("s1", "c1")
    expect(Number(tables.teacher_commissions[0].commissionAmount)).toBeCloseTo(10000)

    const fee = tables.fees.find((f: any) => f.feeType === "COURSE")
    await updateItem("fees", fee.id, { discountAmount: 50000, totalFee: 50000, balance: 50000 } as any)

    expect(tables.teacher_commissions).toHaveLength(1)
    expect(Number(tables.teacher_commissions[0].commissionAmount)).toBeCloseTo(5000)
  })

  it("counts students from enrollments (multi-course) for each teacher", async () => {
    seedCourse("c1", 100000, 10)
    seedCourse("c2", 50000, 10)
    await enrollStudentInCourse("s1", "c1")
    await enrollStudentInCourse("s1", "c2")

    const summaries = await getTeacherCommissionSummaries()
    const t1 = summaries.find(s => s.teacherId === "t1")!
    expect(t1.totalStudentsAssigned).toBe(2)
    // 100000*10% + 50000*10% = 15000
    expect(t1.totalCommissionEarned).toBeCloseTo(15000)
  })
})
