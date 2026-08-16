import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { getItems, addItem, updateItem, deleteItem, createUser } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

describe("Students - getItems enrichment", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("enriches students with firstName, lastName, email from profiles", async () => {
    tables.profiles.push({ id: "s1", email: "stu@t.com", password: "h", role: "STUDENT", firstName: "John", lastName: "Doe" })
    tables.students.push({ id: "s1", studentNumber: "STU260001", enrollmentYear: 2026, classId: "cl1", academicYear: 1 })
    const students = await getItems<any>("students")
    expect(students[0].firstName).toBe("John")
    expect(students[0].lastName).toBe("Doe")
    expect(students[0].email).toBe("stu@t.com")
  })

  it("enriches students with courseName when courseId exists", async () => {
    tables.profiles.push({ id: "s1", email: "s@t.com", firstName: "A", lastName: "B" })
    tables.courses.push({ id: "c1", name: "Physics", code: "PHY" })
    tables.students.push({ id: "s1", studentNumber: "STU260001", courseId: "c1" })
    const students = await getItems<any>("students")
    expect(students[0].courseName).toBe("Physics")
  })

  it("courseName is undefined when no courseId", async () => {
    tables.profiles.push({ id: "s1", email: "s@t.com", firstName: "A", lastName: "B" })
    tables.students.push({ id: "s1", studentNumber: "STU260001" })
    const students = await getItems<any>("students")
    expect(students[0].courseName).toBeUndefined()
  })

  it("returns empty array when no students", async () => {
    const students = await getItems<any>("students")
    expect(students).toHaveLength(0)
  })

  it("handles multiple students", async () => {
    tables.profiles.push(
      { id: "s1", email: "s1@t.com", firstName: "A", lastName: "B" },
      { id: "s2", email: "s2@t.com", firstName: "C", lastName: "D" },
    )
    tables.students.push(
      { id: "s1", studentNumber: "STU001" },
      { id: "s2", studentNumber: "STU002" },
    )
    const students = await getItems<any>("students")
    expect(students).toHaveLength(2)
  })
})

describe("Students - CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("add student directly via addItem", async () => {
    const s = await addItem("students", {
      studentNumber: "STU260001", enrollmentYear: 2026, classId: "cl1",
      academicYear: 1, status: "ACTIVE",
    } as any)
    expect(s.id).toBeDefined()
    expect(tables.students).toHaveLength(1)
  })

  it("update student class", async () => {
    tables.students.push({ id: "s1", studentNumber: "STU001", classId: "cl1", academicYear: 1 })
    const updated: any = await updateItem("students", "s1", { classId: "cl2" } as any)
    expect(updated.classId).toBe("cl2")
  })

  it("update student parentPhone", async () => {
    tables.students.push({ id: "s1", studentNumber: "STU001", parentPhone: "+254700" })
    const updated: any = await updateItem("students", "s1", { parentPhone: "+254711" } as any)
    expect(updated.parentPhone).toBe("+254711")
  })

  it("update student status", async () => {
    tables.students.push({ id: "s1", studentNumber: "STU001", status: "ACTIVE" })
    await updateItem("students", "s1", { status: "COMPLETED" } as any)
    expect(tables.students[0].status).toBe("COMPLETED")
  })

  it("delete student", async () => {
    tables.students.push({ id: "s1", studentNumber: "STU001" })
    await deleteItem("students", "s1")
    expect(tables.students).toHaveLength(0)
  })
})

describe("Students - via createUser", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("createUser creates profile + student record", async () => {
    const result = await createUser({
      email: "new@stu.com", password: "pass", role: "STUDENT",
      firstName: "New", lastName: "Student", classId: "cl1",
    })
    expect(result.success).toBe(true)
    expect(tables.profiles.find((p: any) => p.email === "new@stu.com")).toBeDefined()
    expect(tables.students).toHaveLength(1)
  })

  it("createUser with courseId creates fee and enrollment progress", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1", fee: 25000 })
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T", courseId: "c1",
    })
    expect(tables.fees).toHaveLength(1)
    expect(tables.enrollment_progress).toHaveLength(1)
  })
})

describe("Students - filtering", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("filter students by classId manually", async () => {
    tables.profiles.push(
      { id: "s1", email: "s1@t.com", firstName: "A", lastName: "B" },
      { id: "s2", email: "s2@t.com", firstName: "C", lastName: "D" },
      { id: "s3", email: "s3@t.com", firstName: "E", lastName: "F" },
    )
    tables.students.push(
      { id: "s1", studentNumber: "STU001", classId: "cl1" },
      { id: "s2", studentNumber: "STU002", classId: "cl2" },
      { id: "s3", studentNumber: "STU003", classId: "cl1" },
    )
    const all = await getItems<any>("students")
    const cl1Students = all.filter((s: any) => s.classId === "cl1")
    expect(cl1Students).toHaveLength(2)
  })

  it("filter students by courseId manually", async () => {
    tables.profiles.push(
      { id: "s1", email: "s1@t.com", firstName: "A", lastName: "B" },
      { id: "s2", email: "s2@t.com", firstName: "C", lastName: "D" },
    )
    tables.students.push(
      { id: "s1", studentNumber: "STU001", courseId: "c1" },
      { id: "s2", studentNumber: "STU002", courseId: "c2" },
    )
    const all = await getItems<any>("students")
    const mathStudents = all.filter((s: any) => s.courseId === "c1")
    expect(mathStudents).toHaveLength(1)
  })
})
