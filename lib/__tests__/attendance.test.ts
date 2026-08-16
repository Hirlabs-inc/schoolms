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

describe("Attendance CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("mark student attendance PRESENT", async () => {
    const att = await addItem("attendance", {
      type: "STUDENT", studentId: "s1", classId: "cl1",
      date: "2026-01-15", status: "PRESENT",
    } as any)
    expect(att.id).toBeDefined()
    expect(tables.attendance).toHaveLength(1)
    expect(tables.attendance[0].status).toBe("PRESENT")
  })

  it("mark student attendance ABSENT", async () => {
    await addItem("attendance", {
      type: "STUDENT", studentId: "s1", classId: "cl1",
      date: "2026-01-15", status: "ABSENT",
    } as any)
    expect(tables.attendance[0].status).toBe("ABSENT")
  })

  it("mark student attendance LATE", async () => {
    await addItem("attendance", {
      type: "STUDENT", studentId: "s1", classId: "cl1",
      date: "2026-01-15", status: "LATE",
    } as any)
    expect(tables.attendance[0].status).toBe("LATE")
  })

  it("mark student attendance SICK", async () => {
    await addItem("attendance", {
      type: "STUDENT", studentId: "s1", classId: "cl1",
      date: "2026-01-15", status: "SICK", excuse: "Flu",
    } as any)
    expect(tables.attendance[0].status).toBe("SICK")
    expect(tables.attendance[0].excuse).toBe("Flu")
  })

  it("mark teacher attendance", async () => {
    await addItem("attendance", {
      type: "TEACHER", teacherId: "t1",
      date: "2026-01-15", status: "PRESENT",
    } as any)
    expect(tables.attendance[0].type).toBe("TEACHER")
    expect(tables.attendance[0].teacherId).toBe("t1")
  })

  it("get all attendance records", async () => {
    tables.attendance.push(
      { id: "a1", type: "STUDENT", studentId: "s1", date: "2026-01-15", status: "PRESENT" },
      { id: "a2", type: "STUDENT", studentId: "s2", date: "2026-01-15", status: "ABSENT" },
    )
    const att = await getItems<any>("attendance")
    expect(att).toHaveLength(2)
  })

  it("update attendance status", async () => {
    tables.attendance.push({ id: "a1", type: "STUDENT", studentId: "s1", date: "2026-01-15", status: "ABSENT" })
    const updated = await updateItem("attendance", "a1", { status: "PRESENT" } as any)
    expect(updated.status).toBe("PRESENT")
  })

  it("add excuse to attendance", async () => {
    tables.attendance.push({ id: "a1", type: "STUDENT", studentId: "s1", date: "2026-01-15", status: "ABSENT" })
    await updateItem("attendance", "a1", { excuse: "Medical appointment" } as any)
    expect(tables.attendance[0].excuse).toBe("Medical appointment")
  })

  it("delete attendance record", async () => {
    tables.attendance.push({ id: "a1", type: "STUDENT", studentId: "s1", date: "2026-01-15", status: "PRESENT" })
    await deleteItem("attendance", "a1")
    expect(tables.attendance).toHaveLength(0)
  })

  it("attendance for multiple dates", async () => {
    tables.attendance.push(
      { id: "a1", type: "STUDENT", studentId: "s1", date: "2026-01-15", status: "PRESENT" },
      { id: "a2", type: "STUDENT", studentId: "s1", date: "2026-01-16", status: "PRESENT" },
      { id: "a3", type: "STUDENT", studentId: "s1", date: "2026-01-17", status: "ABSENT" },
    )
    const att = await getItems<any>("attendance")
    expect(att).toHaveLength(3)
  })

  it("attendance for multiple students same date", async () => {
    tables.attendance.push(
      { id: "a1", type: "STUDENT", studentId: "s1", classId: "cl1", date: "2026-01-15", status: "PRESENT" },
      { id: "a2", type: "STUDENT", studentId: "s2", classId: "cl1", date: "2026-01-15", status: "ABSENT" },
      { id: "a3", type: "STUDENT", studentId: "s3", classId: "cl1", date: "2026-01-15", status: "LATE" },
    )
    const att = await getItems<any>("attendance")
    const jan15 = att.filter((a: any) => a.date === "2026-01-15")
    expect(jan15).toHaveLength(3)
  })

  it("attendance by class filtering", async () => {
    tables.attendance.push(
      { id: "a1", type: "STUDENT", studentId: "s1", classId: "cl1", date: "2026-01-15", status: "PRESENT" },
      { id: "a2", type: "STUDENT", studentId: "s2", classId: "cl2", date: "2026-01-15", status: "PRESENT" },
    )
    const att = await getItems<any>("attendance")
    const cl1Att = att.filter((a: any) => a.classId === "cl1")
    expect(cl1Att).toHaveLength(1)
  })
})
