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

describe("Exam Results CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("create exam result", async () => {
    const result = await addItem("examResults", {
      examId: "e1", studentId: "s1", marksObtained: 85, grade: "A", remarks: "Excellent",
    } as any)
    expect(result.id).toBeDefined()
    expect(tables.exam_results).toHaveLength(1)
    expect(tables.exam_results[0].marksObtained).toBe(85)
    expect(tables.exam_results[0].grade).toBe("A")
  })

  it("get all exam results", async () => {
    tables.exam_results.push(
      { id: "er1", examId: "e1", studentId: "s1", marksObtained: 85, grade: "A", remarks: "Excellent" },
      { id: "er2", examId: "e1", studentId: "s2", marksObtained: 65, grade: "B", remarks: "Good" },
    )
    const results = await getItems<any>("examResults")
    expect(results).toHaveLength(2)
  })

  it("update exam result", async () => {
    tables.exam_results.push({ id: "er1", examId: "e1", studentId: "s1", marksObtained: 70, grade: "B", remarks: "Good" })
    const updated = await updateItem("examResults", "er1", { marksObtained: 90, grade: "A", remarks: "Excellent" } as any)
    expect(updated.marksObtained).toBe(90)
    expect(updated.grade).toBe("A")
  })

  it("delete exam result", async () => {
    tables.exam_results.push({ id: "er1", examId: "e1", studentId: "s1", marksObtained: 85, grade: "A", remarks: "Excellent" })
    await deleteItem("examResults", "er1")
    expect(tables.exam_results).toHaveLength(0)
  })

  it("multiple results for same exam", async () => {
    tables.exam_results.push(
      { id: "er1", examId: "e1", studentId: "s1", marksObtained: 85, grade: "A", remarks: "Excellent" },
      { id: "er2", examId: "e1", studentId: "s2", marksObtained: 70, grade: "B", remarks: "Good" },
      { id: "er3", examId: "e1", studentId: "s3", marksObtained: 55, grade: "C", remarks: "Average" },
    )
    const results = await getItems<any>("examResults")
    const e1Results = results.filter((r: any) => r.examId === "e1")
    expect(e1Results).toHaveLength(3)
  })

  it("results for same student across multiple exams", async () => {
    tables.exam_results.push(
      { id: "er1", examId: "e1", studentId: "s1", marksObtained: 85, grade: "A", remarks: "Excellent" },
      { id: "er2", examId: "e2", studentId: "s1", marksObtained: 90, grade: "A", remarks: "Excellent" },
    )
    const results = await getItems<any>("examResults")
    const s1Results = results.filter((r: any) => r.studentId === "s1")
    expect(s1Results).toHaveLength(2)
  })

  it("grade calculation - pass", async () => {
    await addItem("examResults", {
      examId: "e1", studentId: "s1", marksObtained: 50, grade: "C", remarks: "Pass",
    } as any)
    expect(tables.exam_results[0].marksObtained).toBe(50)
    expect(tables.exam_results[0].grade).toBe("C")
  })

  it("grade calculation - fail", async () => {
    await addItem("examResults", {
      examId: "e1", studentId: "s1", marksObtained: 30, grade: "F", remarks: "Fail",
    } as any)
    expect(tables.exam_results[0].marksObtained).toBe(30)
    expect(tables.exam_results[0].grade).toBe("F")
  })

  it("zero marks", async () => {
    await addItem("examResults", {
      examId: "e1", studentId: "s1", marksObtained: 0, grade: "F", remarks: "Absent",
    } as any)
    expect(tables.exam_results[0].marksObtained).toBe(0)
  })

  it("full marks", async () => {
    await addItem("examResults", {
      examId: "e1", studentId: "s1", marksObtained: 100, grade: "A+", remarks: "Perfect",
    } as any)
    expect(tables.exam_results[0].marksObtained).toBe(100)
  })
})
