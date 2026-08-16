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

describe("Fees - Auto-creation on student enrollment", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("fee auto-created when student enrolled with courseId", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1", fee: 50000 })
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T", courseId: "c1",
    })
    expect(tables.fees).toHaveLength(1)
    expect(tables.fees[0].totalFee).toBe(50000)
    expect(tables.fees[0].balance).toBe(50000)
    expect(tables.fees[0].status).toBe("PENDING")
  })

  it("fee still created when course has no fee field (balance=0)", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" })
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T", courseId: "c1",
    })
    expect(tables.fees).toHaveLength(1)
    expect(tables.fees[0].totalFee).toBe(0)
    expect(tables.fees[0].balance).toBe(0)
  })
})

describe("Fees - CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("add fee manually", async () => {
    const fee = await addItem("fees", {
      studentId: "s1", courseId: "c1", totalFee: 30000, balance: 30000, status: "PENDING",
    } as any)
    expect(fee.id).toBeDefined()
    expect(tables.fees).toHaveLength(1)
  })

  it("get all fees with courseName enrichment", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH" })
    tables.fees.push({ id: "f1", studentId: "s1", courseId: "c1", totalFee: 30000, balance: 15000, status: "PARTIAL" })
    const fees = await getItems<any>("fees")
    expect(fees[0].courseName).toBe("Math")
  })

  it("update fee balance", async () => {
    tables.fees.push({ id: "f1", studentId: "s1", courseId: "c1", totalFee: 30000, balance: 30000, status: "PENDING" })
    const updated = await updateItem("fees", "f1", { balance: 15000, status: "PARTIAL" } as any)
    expect(updated.balance).toBe(15000)
    expect(updated.status).toBe("PARTIAL")
  })

  it("fee status transition PENDING → PARTIAL", async () => {
    tables.fees.push({ id: "f1", studentId: "s1", courseId: "c1", totalFee: 30000, balance: 30000, status: "PENDING" })
    await updateItem("fees", "f1", { balance: 15000, status: "PARTIAL" } as any)
    expect(tables.fees[0].status).toBe("PARTIAL")
  })

  it("fee status transition PARTIAL → PAID", async () => {
    tables.fees.push({ id: "f1", studentId: "s1", courseId: "c1", totalFee: 30000, balance: 15000, status: "PARTIAL" })
    await updateItem("fees", "f1", { balance: 0, status: "PAID" } as any)
    expect(tables.fees[0].balance).toBe(0)
    expect(tables.fees[0].status).toBe("PAID")
  })

  it("fee status transition PENDING → PAID (full payment)", async () => {
    tables.fees.push({ id: "f1", studentId: "s1", courseId: "c1", totalFee: 30000, balance: 30000, status: "PENDING" })
    await updateItem("fees", "f1", { balance: 0, status: "PAID" } as any)
    expect(tables.fees[0].status).toBe("PAID")
    expect(tables.fees[0].balance).toBe(0)
  })

  it("delete fee", async () => {
    tables.fees.push({ id: "f1", studentId: "s1", courseId: "c1", totalFee: 30000, balance: 30000, status: "PENDING" })
    await deleteItem("fees", "f1")
    expect(tables.fees).toHaveLength(0)
  })

  it("fee with zero total", async () => {
    await addItem("fees", {
      studentId: "s1", courseId: "c1", totalFee: 0, balance: 0, status: "PAID",
    } as any)
    expect(tables.fees[0].totalFee).toBe(0)
    expect(tables.fees[0].balance).toBe(0)
  })

  it("multiple fees for same student", async () => {
    tables.fees.push(
      { id: "f1", studentId: "s1", courseId: "c1", totalFee: 30000, balance: 30000, status: "PENDING" },
      { id: "f2", studentId: "s1", courseId: "c2", totalFee: 20000, balance: 20000, status: "PENDING" },
    )
    const fees = await getItems<any>("fees")
    const s1Fees = fees.filter((f: any) => f.studentId === "s1")
    expect(s1Fees).toHaveLength(2)
  })
})
