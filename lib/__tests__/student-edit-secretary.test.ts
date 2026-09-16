import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { updateItem, addItem, deleteItem } from "../api"

async function seedSecretary() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "sec-1", email: "secretary@test.com", password: hash,
    role: "SECRETARY", firstName: "Sec", lastName: "Retary",
  })
  localStorage.setItem("auth_token", "mock-secretary-token")
}

async function seedTeacher() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "tch-1", email: "teacher@test.com", password: hash,
    role: "TEACHER", firstName: "Teach", lastName: "Er",
  })
  localStorage.setItem("auth_token", "mock-teacher-token")
}

describe("Secretary editing a student", () => {
  beforeEach(async () => {
    resetDb()
    await seedSecretary()
    tables.profiles.push({ id: "s1", email: "stu@t.com", password: "h", role: "STUDENT", firstName: "Old", lastName: "Name" })
    tables.students.push({ id: "s1", profileId: "s1", studentNumber: "STU001", firstName: "Old", lastName: "Name", status: "ACTIVE" })
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", teacherId: "t1", fee: 1000 })
    tables.enrollment_progress.push({ id: "ep1", studentId: "s1", courseId: "c1", progressPercent: 0, status: "ENROLLED" })
  })

  it("can update the linked profile name/email (no 'Unknown key: profiles')", async () => {
    const updated: any = await updateItem("profiles", "s1", {
      firstName: "New", lastName: "Name2", email: "new@t.com",
    } as any)
    expect(updated.firstName).toBe("New")
    expect(updated.email).toBe("new@t.com")
    expect(tables.profiles.find((p: any) => p.id === "s1").firstName).toBe("New")
  })

  it("can update the student row", async () => {
    const updated: any = await updateItem("students", "s1", {
      firstName: "New", lastName: "Name2", status: "COMPLETED",
    } as any)
    expect(updated.status).toBe("COMPLETED")
  })

  it("can recreate enrollment records (add + delete)", async () => {
    await deleteItem("enrollmentProgress", "ep1")
    expect(tables.enrollment_progress).toHaveLength(0)
    const created: any = await addItem("enrollmentProgress", {
      studentId: "s1", courseId: "c1", progressPercent: 0, status: "ENROLLED",
    } as any)
    expect(created.id).toBeDefined()
    expect(tables.enrollment_progress).toHaveLength(1)
  })
})

describe("Teacher cannot edit student profiles", () => {
  beforeEach(async () => {
    resetDb()
    await seedTeacher()
    tables.profiles.push({ id: "s1", email: "stu@t.com", password: "h", role: "STUDENT", firstName: "Old", lastName: "Name" })
  })

  it("is blocked from updating profiles", async () => {
    await expect(
      updateItem("profiles", "s1", { firstName: "Hack" } as any)
    ).rejects.toThrow(/Forbidden|permission/)
  })
})
