import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import {
  getItems, addItem, updateItem, deleteItem, upsertItem,
  createUser, processPayroll, getPayrollSummary, getIncomeSummary, getEnrollmentStats,
} from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

function setStudentToken() {
  localStorage.setItem("auth_token", "mock-student-token")
}

function setTeacherToken() {
  localStorage.setItem("auth_token", "mock-teacher-token")
}

function setSecretaryToken() {
  localStorage.setItem("auth_token", "mock-secretary-token")
}

function clearAuth() {
  localStorage.removeItem("auth_token")
}

describe("RBAC - Admin access", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("admin can getItems for all tables", async () => {
    await expect(getItems("courses")).resolves.toBeDefined()
    await expect(getItems("students")).resolves.toBeDefined()
    await expect(getItems("teachers")).resolves.toBeDefined()
    await expect(getItems("classes")).resolves.toBeDefined()
    await expect(getItems("fees")).resolves.toBeDefined()
    await expect(getItems("payments")).resolves.toBeDefined()
    await expect(getItems("expenses")).resolves.toBeDefined()
    await expect(getItems("income")).resolves.toBeDefined()
  })

  it("admin can create users", async () => {
    const result = await createUser({
      email: "new@t.com", password: "p", role: "STUDENT",
      firstName: "N", lastName: "U",
    })
    expect(result.success).toBe(true)
  })

  it("admin can add items", async () => {
    const c = await addItem("courses", { name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" } as any)
    expect(c.id).toBeDefined()
  })

  it("admin can update items", async () => {
    tables.courses.push({ id: "c1", name: "Old", code: "OLD", classId: "cl1", teacherId: "t1" })
    const u: any = await updateItem("courses", "c1", { name: "New" } as any)
    expect(u.name).toBe("New")
  })

  it("admin can delete items", async () => {
    tables.courses.push({ id: "c1", name: "Del", code: "DEL", classId: "cl1", teacherId: "t1" })
    await deleteItem("courses", "c1")
    expect(tables.courses).toHaveLength(0)
  })

  it("admin can process payroll", async () => {
    const r = await processPayroll("t1", "ctr1", 30000, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")
    expect(r.success).toBe(true)
  })

  it("admin can get payroll summary", async () => {
    const s = await getPayrollSummary(2026, 1)
    expect(s).toBeDefined()
  })

  it("admin can get income summary", async () => {
    const s = await getIncomeSummary(2026)
    expect(s).toBeDefined()
  })

  it("admin can get enrollment stats", async () => {
    const s = await getEnrollmentStats()
    expect(s).toBeDefined()
  })
})

describe("RBAC - Unauthenticated access blocked", () => {
  beforeEach(() => { resetDb() })

  it("getItems blocked", async () => {
    await expect(getItems("courses")).rejects.toThrow("Authentication required")
  })

  it("addItem blocked", async () => {
    await expect(addItem("courses", { name: "X", code: "X", classId: "x", teacherId: "x" } as any)).rejects.toThrow("Authentication required")
  })

  it("updateItem blocked", async () => {
    await expect(updateItem("courses", "x", { name: "X" } as any)).rejects.toThrow("Authentication required")
  })

  it("deleteItem blocked", async () => {
    await expect(deleteItem("courses", "x")).rejects.toThrow("Authentication required")
  })

  it("upsertItem blocked", async () => {
    await expect(upsertItem("courses", { name: "X", code: "X", classId: "x", teacherId: "x" } as any)).rejects.toThrow("Authentication required")
  })

  it("processPayroll blocked", async () => {
    await expect(processPayroll("t", "c", 100, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")).rejects.toThrow("Authentication required")
  })

  it("getPayrollSummary blocked", async () => {
    await expect(getPayrollSummary(2026, 1)).rejects.toThrow("Authentication required")
  })

  it("getIncomeSummary blocked", async () => {
    await expect(getIncomeSummary(2026)).rejects.toThrow("Authentication required")
  })

  it("getEnrollmentStats blocked", async () => {
    await expect(getEnrollmentStats()).rejects.toThrow("Authentication required")
  })
})

describe("RBAC - Student cannot create users", () => {
  beforeEach(() => {
    resetDb()
    tables.profiles.push({ id: "stu-1", email: "s@t.com", password: "h", role: "STUDENT", firstName: "S", lastName: "T" })
    setStudentToken()
  })

  it("student cannot create users", async () => {
    await expect(createUser({
      email: "bad@t.com", password: "p", role: "STUDENT",
      firstName: "B", lastName: "D",
    })).rejects.toThrow("Forbidden: insufficient role")
  })
})

describe("RBAC - Teacher cannot create users", () => {
  beforeEach(() => {
    resetDb()
    tables.profiles.push({ id: "tch-1", email: "t@t.com", password: "h", role: "TEACHER", firstName: "T", lastName: "E" })
    setTeacherToken()
  })

  it("teacher cannot create users", async () => {
    await expect(createUser({
      email: "bad@t.com", password: "p", role: "STUDENT",
      firstName: "B", lastName: "D",
    })).rejects.toThrow("Forbidden: insufficient role")
  })
})

describe("RBAC - Secretary cannot use generic createUser", () => {
  beforeEach(() => {
    resetDb()
    tables.profiles.push({ id: "sec-1", email: "s@t.com", password: "h", role: "SECRETARY", firstName: "S", lastName: "E" })
    setSecretaryToken()
  })

  it("secretary cannot use createUser (requires ADMIN)", async () => {
    await expect(createUser({
      email: "bad@t.com", password: "p", role: "TEACHER",
      firstName: "B", lastName: "D",
    })).rejects.toThrow("Forbidden: insufficient role")
  })
})

describe("RBAC - Token manipulation", () => {
  beforeEach(() => { resetDb() })

  it("empty token string treated as no auth", async () => {
    localStorage.setItem("auth_token", "")
    await expect(getItems("courses")).rejects.toThrow("Authentication required")
  })

  it("clearing token mid-session blocks further operations", async () => {
    await seedAdmin()
    await getItems("courses")
    clearAuth()
    await expect(getItems("courses")).rejects.toThrow("Authentication required")
  })
})
