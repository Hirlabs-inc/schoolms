import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { getItems, addItem, updateItem, deleteItem } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

describe("Exams CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("create exam with all fields", async () => {
    const exam = await addItem("exams", {
      courseId: "c1", term: "Term 1", date: "2026-03-15", totalMarks: 100,
    } as any)
    expect(exam.id).toBeDefined()
    expect(tables.exams).toHaveLength(1)
    expect(tables.exams[0].term).toBe("Term 1")
    expect(tables.exams[0].totalMarks).toBe(100)
  })

  it("get all exams", async () => {
    tables.exams.push(
      { id: "e1", courseId: "c1", term: "Term 1", date: "2026-03-15", totalMarks: 100 },
      { id: "e2", courseId: "c1", term: "Term 2", date: "2026-06-15", totalMarks: 100 },
    )
    const exams = await getItems<any>("exams")
    expect(exams).toHaveLength(2)
  })

  it("update exam", async () => {
    tables.exams.push({ id: "e1", courseId: "c1", term: "Term 1", date: "2026-03-15", totalMarks: 100 })
    const updated: any = await updateItem("exams", "e1", { totalMarks: 150 } as any)
    expect(updated.totalMarks).toBe(150)
  })

  it("delete exam", async () => {
    tables.exams.push({ id: "e1", courseId: "c1", term: "Term 1", date: "2026-03-15", totalMarks: 100 })
    await deleteItem("exams", "e1")
    expect(tables.exams).toHaveLength(0)
  })

  it("multiple exams per course", async () => {
    tables.exams.push(
      { id: "e1", courseId: "c1", term: "Term 1", date: "2026-03-15", totalMarks: 100 },
      { id: "e2", courseId: "c1", term: "Term 2", date: "2026-06-15", totalMarks: 100 },
      { id: "e3", courseId: "c1", term: "Term 3", date: "2026-09-15", totalMarks: 100 },
    )
    const exams = await getItems<any>("exams")
    const c1Exams = exams.filter((e: any) => e.courseId === "c1")
    expect(c1Exams).toHaveLength(3)
  })

  it("exams for different courses", async () => {
    tables.exams.push(
      { id: "e1", courseId: "c1", term: "Term 1", date: "2026-03-15", totalMarks: 100 },
      { id: "e2", courseId: "c2", term: "Term 1", date: "2026-03-15", totalMarks: 80 },
    )
    const exams = await getItems<any>("exams")
    expect(exams).toHaveLength(2)
  })

  it("exam with custom id", async () => {
    const exam = await addItem("exams", {
      id: "custom-exam", courseId: "c1", term: "Final", date: "2026-12-01", totalMarks: 200,
    } as any)
    expect(exam.id).toBe("custom-exam")
  })

  it("update exam term", async () => {
    tables.exams.push({ id: "e1", courseId: "c1", term: "Term 1", date: "2026-03-15", totalMarks: 100 })
    await updateItem("exams", "e1", { term: "Midterm" } as any)
    expect(tables.exams[0].term).toBe("Midterm")
  })

  it("update exam date", async () => {
    tables.exams.push({ id: "e1", courseId: "c1", term: "Term 1", date: "2026-03-15", totalMarks: 100 })
    await updateItem("exams", "e1", { date: "2026-04-01" } as any)
    expect(tables.exams[0].date).toBe("2026-04-01")
  })
})
