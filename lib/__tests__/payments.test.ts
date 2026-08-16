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

describe("Payments CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("create payment with CASH method", async () => {
    const pay = await addItem("payments", {
      studentId: "s1", feeId: "f1", amount: 10000,
      paymentDate: "2026-01-15", paymentMethod: "CASH", receiptNumber: "RCP001",
    } as any)
    expect(pay.id).toBeDefined()
    expect(tables.payments).toHaveLength(1)
    expect(tables.payments[0].paymentMethod).toBe("CASH")
  })

  it("create payment with BANK method", async () => {
    await addItem("payments", {
      studentId: "s1", feeId: "f1", amount: 15000,
      paymentDate: "2026-01-20", paymentMethod: "BANK", receiptNumber: "RCP002",
    } as any)
    expect(tables.payments[0].paymentMethod).toBe("BANK")
  })

  it("create payment with M_PESA method", async () => {
    await addItem("payments", {
      studentId: "s1", feeId: "f1", amount: 5000,
      paymentDate: "2026-01-25", paymentMethod: "M_PESA", receiptNumber: "RCP003",
    } as any)
    expect(tables.payments[0].paymentMethod).toBe("M_PESA")
  })

  it("get all payments with student name enrichment", async () => {
    tables.profiles.push({ id: "s1", email: "s@t.com", firstName: "John", lastName: "Doe" })
    tables.payments.push({ id: "p1", studentId: "s1", feeId: "f1", amount: 10000, paymentDate: "2026-01-15", paymentMethod: "CASH", receiptNumber: "RCP001" })
    const payments = await getItems<any>("payments")
    expect(payments[0].firstName).toBe("John")
    expect(payments[0].lastName).toBe("Doe")
  })

  it("payment with notes", async () => {
    await addItem("payments", {
      studentId: "s1", feeId: "f1", amount: 10000,
      paymentDate: "2026-01-15", paymentMethod: "CASH", receiptNumber: "RCP001",
      notes: "Partial payment",
    } as any)
    expect(tables.payments[0].notes).toBe("Partial payment")
  })

  it("update payment", async () => {
    tables.payments.push({ id: "p1", studentId: "s1", feeId: "f1", amount: 10000, paymentDate: "2026-01-15", paymentMethod: "CASH", receiptNumber: "RCP001" })
    const updated: any = await updateItem("payments", "p1", { amount: 12000, notes: "Updated" } as any)
    expect(updated.amount).toBe(12000)
    expect(updated.notes).toBe("Updated")
  })

  it("delete payment", async () => {
    tables.payments.push({ id: "p1", studentId: "s1", feeId: "f1", amount: 10000, paymentDate: "2026-01-15", paymentMethod: "CASH", receiptNumber: "RCP001" })
    await deleteItem("payments", "p1")
    expect(tables.payments).toHaveLength(0)
  })

  it("multiple payments for same fee", async () => {
    tables.payments.push(
      { id: "p1", studentId: "s1", feeId: "f1", amount: 10000, paymentDate: "2026-01-15", paymentMethod: "CASH", receiptNumber: "RCP001" },
      { id: "p2", studentId: "s1", feeId: "f1", amount: 10000, paymentDate: "2026-02-15", paymentMethod: "BANK", receiptNumber: "RCP002" },
    )
    const payments = await getItems<any>("payments")
    const f1Payments = payments.filter((p: any) => p.feeId === "f1")
    expect(f1Payments).toHaveLength(2)
  })

  it("payment with zero amount", async () => {
    await addItem("payments", {
      studentId: "s1", feeId: "f1", amount: 0,
      paymentDate: "2026-01-15", paymentMethod: "CASH", receiptNumber: "RCP001",
    } as any)
    expect(tables.payments[0].amount).toBe(0)
  })

  it("payment linked to fee", async () => {
    tables.fees.push({ id: "f1", studentId: "s1", courseId: "c1", totalFee: 30000, balance: 30000, status: "PENDING" })
    await addItem("payments", {
      studentId: "s1", feeId: "f1", amount: 10000,
      paymentDate: "2026-01-15", paymentMethod: "CASH", receiptNumber: "RCP001",
    } as any)
    expect(tables.payments[0].feeId).toBe("f1")
  })
})
