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

describe("Teachers - getItems enrichment", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("enriches teachers with firstName, lastName, email", async () => {
    tables.profiles.push({ id: "t1", email: "t@t.com", password: "h", role: "TEACHER", firstName: "Jane", lastName: "Smith" })
    tables.teachers.push({ id: "t1", staffId: "TCH001", department: "Science" })
    const teachers = await getItems<any>("teachers")
    expect(teachers[0].firstName).toBe("Jane")
    expect(teachers[0].lastName).toBe("Smith")
    expect(teachers[0].email).toBe("t@t.com")
  })

  it("returns empty array when no teachers", async () => {
    const teachers = await getItems<any>("teachers")
    expect(teachers).toHaveLength(0)
  })

  it("handles multiple teachers", async () => {
    tables.profiles.push(
      { id: "t1", email: "t1@t.com", firstName: "A", lastName: "B" },
      { id: "t2", email: "t2@t.com", firstName: "C", lastName: "D" },
    )
    tables.teachers.push(
      { id: "t1", staffId: "TCH001" },
      { id: "t2", staffId: "TCH002" },
    )
    const teachers = await getItems<any>("teachers")
    expect(teachers).toHaveLength(2)
  })
})

describe("Teachers - CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("add teacher directly", async () => {
    const t = await addItem("teachers", {
      staffId: "TCH001", department: "Math", specialization: "Algebra",
    } as any)
    expect(t.id).toBeDefined()
    expect(tables.teachers).toHaveLength(1)
  })

  it("update teacher department", async () => {
    tables.teachers.push({ id: "t1", staffId: "TCH001", department: "Science" })
    const updated = await updateItem("teachers", "t1", { department: "Math" } as any)
    expect(updated.department).toBe("Math")
  })

  it("update teacher specialization", async () => {
    tables.teachers.push({ id: "t1", staffId: "TCH001", specialization: "Physics" })
    await updateItem("teachers", "t1", { specialization: "Chemistry" } as any)
    expect(tables.teachers[0].specialization).toBe("Chemistry")
  })

  it("delete teacher", async () => {
    tables.teachers.push({ id: "t1", staffId: "TCH001" })
    await deleteItem("teachers", "t1")
    expect(tables.teachers).toHaveLength(0)
  })
})

describe("Teachers - via createUser", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("creates profile + teacher record", async () => {
    const result = await createUser({
      email: "new@teacher.com", password: "pass", role: "TEACHER",
      firstName: "New", lastName: "Teacher", staffId: "TCH999",
      department: "Art", specialization: "Painting",
    })
    expect(result.success).toBe(true)
    expect(tables.profiles.find((p: any) => p.email === "new@teacher.com")).toBeDefined()
    expect(tables.teachers).toHaveLength(1)
    expect(tables.teachers[0].staffId).toBe("TCH999")
  })
})

describe("Teachers - Course assignment", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("assign teacher to course", async () => {
    tables.teachers.push({ id: "t1", staffId: "TCH001" })
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: null })
    await updateItem("courses", "c1", { teacherId: "t1" } as any)
    expect(tables.courses[0].teacherId).toBe("t1")
  })

  it("teacher can have multiple courses", async () => {
    tables.teachers.push({ id: "t1", staffId: "TCH001" })
    tables.courses.push(
      { id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" },
      { id: "c2", name: "Science", code: "SCI", classId: "cl1", teacherId: "t1" },
    )
    const courses = await getItems<any>("courses")
    const tCourses = courses.filter((c: any) => c.teacherId === "t1")
    expect(tCourses).toHaveLength(2)
  })
})
