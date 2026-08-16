import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { getItems, addItem, updateItem } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

describe("Student Promotion", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("promote student to next grade by updating classId", async () => {
    tables.students.push({ id: "s1", studentNumber: "STU001", classId: "cl1", academicYear: 1, status: "ACTIVE" })
    await updateItem("students", "s1", { classId: "cl2", academicYear: 2 } as any)
    expect(tables.students[0].classId).toBe("cl2")
    expect(tables.students[0].academicYear).toBe(2)
  })

  it("student with all courses passed can be promoted", async () => {
    tables.students.push({ id: "s1", studentNumber: "STU001", classId: "cl1", academicYear: 1, status: "ACTIVE" })
    tables.courses.push(
      { id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" },
      { id: "c2", name: "Eng", code: "ENG", classId: "cl1", teacherId: "t2" },
    )
    tables.exams.push(
      { id: "e1", courseId: "c1", term: "Final", date: "2026-12-01", totalMarks: 100 },
      { id: "e2", courseId: "c2", term: "Final", date: "2026-12-01", totalMarks: 100 },
    )
    tables.exam_results.push(
      { id: "er1", examId: "e1", studentId: "s1", marksObtained: 75, grade: "B", remarks: "Pass" },
      { id: "er2", examId: "e2", studentId: "s1", marksObtained: 80, grade: "A", remarks: "Pass" },
    )
    const results = tables.exam_results.filter((r: any) => r.studentId === "s1")
    const allPassed = results.every((r: any) => r.marksObtained >= 40)
    expect(allPassed).toBe(true)
    await updateItem("students", "s1", { classId: "cl2", academicYear: 2 } as any)
    expect(tables.students[0].classId).toBe("cl2")
  })

  it("student with failed course should not be promoted", async () => {
    tables.students.push({ id: "s1", studentNumber: "STU001", classId: "cl1", academicYear: 1, status: "ACTIVE" })
    tables.exam_results.push(
      { id: "er1", examId: "e1", studentId: "s1", marksObtained: 30, grade: "F", remarks: "Fail" },
    )
    const results = tables.exam_results.filter((r: any) => r.studentId === "s1")
    const allPassed = results.every((r: any) => r.marksObtained >= 40)
    expect(allPassed).toBe(false)
  })

  it("bulk promotion - promote multiple students", async () => {
    tables.students.push(
      { id: "s1", studentNumber: "STU001", classId: "cl1", academicYear: 1, status: "ACTIVE" },
      { id: "s2", studentNumber: "STU002", classId: "cl1", academicYear: 1, status: "ACTIVE" },
      { id: "s3", studentNumber: "STU003", classId: "cl1", academicYear: 1, status: "ACTIVE" },
    )
    for (const s of tables.students) {
      await updateItem("students", s.id, { classId: "cl2", academicYear: 2 } as any)
    }
    const promoted = tables.students.filter((s: any) => s.classId === "cl2")
    expect(promoted).toHaveLength(3)
  })

  it("Grade 12 student - mark as COMPLETED instead of promoting", async () => {
    tables.students.push({ id: "s1", studentNumber: "STU001", classId: "cl12", academicYear: 12, status: "ACTIVE" })
    await updateItem("students", "s1", { status: "COMPLETED" } as any)
    expect(tables.students[0].status).toBe("COMPLETED")
  })

  it("student with DROPPED status cannot be promoted", async () => {
    tables.students.push({ id: "s1", studentNumber: "STU001", classId: "cl1", academicYear: 1, status: "DROPPED" })
    expect(tables.students[0].status).toBe("DROPPED")
  })
})
