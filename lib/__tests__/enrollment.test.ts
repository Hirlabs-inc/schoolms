import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { getItems, addItem, updateItem, deleteItem, getEnrollmentStats } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

describe("Enrollment Progress CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("create enrollment progress", async () => {
    const ep = await addItem("enrollmentProgress", {
      studentId: "s1", courseId: "c1", progressPercent: 0, status: "ENROLLED",
      startDate: "2026-01-01",
    } as any)
    expect(ep.id).toBeDefined()
    expect(tables.enrollment_progress).toHaveLength(1)
  })

  it("update progress percentage", async () => {
    tables.enrollment_progress.push({ id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 0, status: "ENROLLED" })
    const updated = await updateItem("enrollmentProgress", "ep1", { progressPercent: 50, status: "IN_PROGRESS" } as any)
    expect(updated.progressPercent).toBe(50)
    expect(updated.status).toBe("IN_PROGRESS")
  })

  it("status transition ENROLLED → IN_PROGRESS", async () => {
    tables.enrollment_progress.push({ id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 0, status: "ENROLLED" })
    await updateItem("enrollmentProgress", "ep1", { status: "IN_PROGRESS", progressPercent: 25 } as any)
    expect(tables.enrollment_progress[0].status).toBe("IN_PROGRESS")
  })

  it("status transition IN_PROGRESS → COMPLETED", async () => {
    tables.enrollment_progress.push({ id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 75, status: "IN_PROGRESS" })
    await updateItem("enrollmentProgress", "ep1", { status: "COMPLETED", progressPercent: 100 } as any)
    expect(tables.enrollment_progress[0].status).toBe("COMPLETED")
    expect(tables.enrollment_progress[0].progressPercent).toBe(100)
  })

  it("status transition to DROPPED", async () => {
    tables.enrollment_progress.push({ id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 30, status: "IN_PROGRESS" })
    await updateItem("enrollmentProgress", "ep1", { status: "DROPPED" } as any)
    expect(tables.enrollment_progress[0].status).toBe("DROPPED")
  })

  it("delete enrollment progress", async () => {
    tables.enrollment_progress.push({ id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 50, status: "IN_PROGRESS" })
    await deleteItem("enrollmentProgress", "ep1")
    expect(tables.enrollment_progress).toHaveLength(0)
  })

  it("getItems enriches with studentName and courseName", async () => {
    tables.profiles.push({ id: "s1", firstName: "John", lastName: "Doe" })
    tables.courses.push({ id: "c1", name: "Mathematics", code: "MTH" })
    tables.enrollment_progress.push({ id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 60, status: "IN_PROGRESS" })
    const ep = await getItems<any>("enrollmentProgress")
    expect(ep[0].studentName).toBe("John Doe")
    expect(ep[0].courseName).toBe("Mathematics")
  })

  it("enrichment shows Unknown for missing student", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH" })
    tables.enrollment_progress.push({ id: "ep1", studentId: "nonexistent", courseId: "c1", progressPercent: 50, status: "IN_PROGRESS" })
    const ep = await getItems<any>("enrollmentProgress")
    expect(ep[0].studentName).toBe("Unknown")
  })

  it("enrichment shows Unknown for missing course", async () => {
    tables.profiles.push({ id: "s1", firstName: "John", lastName: "Doe" })
    tables.enrollment_progress.push({ id: "ep1", studentId: "s1", courseId: "nonexistent", progressPercent: 50, status: "IN_PROGRESS" })
    const ep = await getItems<any>("enrollmentProgress")
    expect(ep[0].courseName).toBe("Unknown")
  })
})

describe("Enrollment Stats", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("returns zeroes with no data", async () => {
    const stats = await getEnrollmentStats()
    expect(stats.total).toBe(0)
    expect(stats.avgProgress).toBe(0)
  })

  it("returns correct total count", async () => {
    tables.enrollment_progress.push(
      { id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 50, status: "IN_PROGRESS" },
      { id: "ep2", studentId: "s2", courseId: "c1", progressPercent: 100, status: "COMPLETED" },
    )
    const stats = await getEnrollmentStats()
    expect(stats.total).toBe(2)
  })

  it("returns correct average progress", async () => {
    tables.enrollment_progress.push(
      { id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 40, status: "IN_PROGRESS" },
      { id: "ep2", studentId: "s2", courseId: "c1", progressPercent: 60, status: "IN_PROGRESS" },
    )
    const stats = await getEnrollmentStats()
    expect(stats.avgProgress).toBe(50)
  })

  it("returns status breakdown", async () => {
    tables.enrollment_progress.push(
      { id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 50, status: "IN_PROGRESS" },
      { id: "ep2", studentId: "s2", courseId: "c1", progressPercent: 100, status: "COMPLETED" },
      { id: "ep3", studentId: "s3", courseId: "c1", progressPercent: 0, status: "ENROLLED" },
    )
    const stats = await getEnrollmentStats()
    expect(stats.byStatus.length).toBeGreaterThan(0)
  })

  it("all completed - 100% average", async () => {
    tables.enrollment_progress.push(
      { id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 100, status: "COMPLETED" },
      { id: "ep2", studentId: "s2", courseId: "c1", progressPercent: 100, status: "COMPLETED" },
    )
    const stats = await getEnrollmentStats()
    expect(stats.avgProgress).toBe(100)
  })
})
