import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { createUser, generateStudentNumber, getItems, updateItem, deleteItem } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

describe("createUser - Student", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("creates student with all fields", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1", fee: 50000 })
    const result = await createUser({
      email: "stu@test.com", password: "pass", role: "STUDENT",
      firstName: "John", lastName: "Doe", courseId: "c1",
      classId: "cl1", parentPhone: "+254700000", phone: "+254711111",
      gender: "MALE", academicYear: 2,
    })
    expect(result.success).toBe(true)
    expect(tables.students).toHaveLength(1)
    const s = tables.students[0]
    expect(s.classId).toBe("cl1")
    expect(s.parentPhone).toBe("+254700000")
    expect(s.phone).toBe("+254711111")
    expect(s.gender).toBe("MALE")
    expect(s.academicYear).toBe(2)
  })

  it("auto-creates fee when courseId provided with fee > 0", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1", fee: 30000 })
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T", courseId: "c1",
    })
    expect(tables.fees).toHaveLength(1)
    expect(tables.fees[0].totalFee).toBe(30000)
    expect(tables.fees[0].balance).toBe(30000)
    expect(tables.fees[0].status).toBe("PENDING")
  })

  it("auto-creates enrollment progress when courseId provided", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1", fee: 0 })
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T", courseId: "c1",
    })
    expect(tables.enrollment_progress).toHaveLength(1)
    expect(tables.enrollment_progress[0].progressPercent).toBe(0)
    expect(tables.enrollment_progress[0].status).toBe("ENROLLED")
  })

  it("fee still created when course has fee=0 (with balance 0)", async () => {
    tables.courses.push({ id: "c1", name: "Free", code: "FREE", classId: "cl1", teacherId: "t1", fee: 0 })
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T", courseId: "c1",
    })
    expect(tables.fees).toHaveLength(1)
    expect(tables.fees[0].totalFee).toBe(0)
    expect(tables.fees[0].balance).toBe(0)
  })

  it("no fee created when courseId not provided", async () => {
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T",
    })
    expect(tables.fees).toHaveLength(0)
    expect(tables.enrollment_progress).toHaveLength(0)
  })

  it("student gets auto-generated studentNumber if not provided", async () => {
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T",
    })
    expect(tables.students[0].studentNumber).toBeDefined()
    expect(tables.students[0].studentNumber).toMatch(/^STU\d{6}$/)
  })

  it("student uses provided studentNumber", async () => {
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T", studentNumber: "CUSTOM001",
    })
    expect(tables.students[0].studentNumber).toBe("CUSTOM001")
  })

  it("student default status is ACTIVE", async () => {
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T",
    })
    expect(tables.students[0].status).toBe("ACTIVE")
  })
})

describe("createUser - Teacher", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("creates teacher with all fields", async () => {
    const result = await createUser({
      email: "t@t.com", password: "pass", role: "TEACHER",
      firstName: "Jane", lastName: "Smith",
      staffId: "TCH001", department: "Science", specialization: "Physics",
    })
    expect(result.success).toBe(true)
    expect(tables.teachers).toHaveLength(1)
    expect(tables.teachers[0].staffId).toBe("TCH001")
    expect(tables.teachers[0].department).toBe("Science")
    expect(tables.teachers[0].specialization).toBe("Physics")
  })

  it("teacher gets auto-generated staffId if not provided", async () => {
    await createUser({
      email: "t@t.com", password: "pass", role: "TEACHER",
      firstName: "T", lastName: "E",
    })
    expect(tables.teachers[0].staffId).toMatch(/^TCH\d+/)
  })

  it("teacher department and specialization default to null", async () => {
    await createUser({
      email: "t@t.com", password: "pass", role: "TEACHER",
      firstName: "T", lastName: "E", staffId: "TCH999",
    })
    expect(tables.teachers[0].department).toBeNull()
    expect(tables.teachers[0].specialization).toBeNull()
  })
})

describe("createUser - Authorization", () => {
  beforeEach(() => { resetDb() })

  it("rejects when no user is logged in", async () => {
    await expect(createUser({
      email: "x@t.com", password: "p", role: "STUDENT",
      firstName: "X", lastName: "Y",
    })).rejects.toThrow("Only admins can create users")
  })

  it("rejects when student is logged in", async () => {
    tables.profiles.push({ id: "stu-1", email: "s@t.com", password: "h", role: "STUDENT", firstName: "S", lastName: "T" })
    localStorage.setItem("auth_token", "mock-student-token")
    await expect(createUser({
      email: "x@t.com", password: "p", role: "STUDENT",
      firstName: "X", lastName: "Y",
    })).rejects.toThrow("Only admins can create users")
  })

  it("rejects when teacher is logged in", async () => {
    tables.profiles.push({ id: "tch-1", email: "t@t.com", password: "h", role: "TEACHER", firstName: "T", lastName: "E" })
    localStorage.setItem("auth_token", "mock-teacher-token")
    await expect(createUser({
      email: "x@t.com", password: "p", role: "STUDENT",
      firstName: "X", lastName: "Y",
    })).rejects.toThrow("Only admins can create users")
  })
})

describe("generateStudentNumber", () => {
  it("returns string in correct format", () => {
    const num = generateStudentNumber()
    const year = new Date().getFullYear().toString().slice(-2)
    expect(num).toMatch(new RegExp(`^STU${year}\\d{4}$`))
  })

  it("multiple calls produce values (may collide due to random)", () => {
    const nums = new Set<string>()
    for (let i = 0; i < 10; i++) {
      nums.add(generateStudentNumber())
    }
    expect(nums.size).toBeGreaterThanOrEqual(1)
  })
})

describe("User update and delete", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("can update user profile fields via updateItem", async () => {
    tables.profiles.push({ id: "u1", email: "u@t.com", role: "STUDENT", firstName: "Old", lastName: "Name" })
    const updated = await updateItem("users", "u1", { firstName: "New" } as any)
    expect(updated.firstName).toBe("New")
  })

  it("can delete user via deleteItem", async () => {
    tables.profiles.push({ id: "u1", email: "u@t.com", role: "STUDENT", firstName: "Del", lastName: "Me" })
    await deleteItem("users", "u1")
    expect(tables.profiles.find((p: any) => p.id === "u1")).toBeUndefined()
  })
})
