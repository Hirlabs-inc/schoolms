import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import {
  getItems, addItem, updateItem, deleteItem,
  createUser, generateStudentNumber,
  processPayroll, getPayrollSummary, getIncomeSummary, getEnrollmentStats,
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

describe("Edge Cases - SQL injection attempts", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("SQL injection in name field is stored as-is (parameterized)", async () => {
    const malicious = "Robert'); DROP TABLE courses;--"
    await addItem("courses", { name: malicious, code: "HACK", classId: "cl1", teacherId: "t1" } as any)
    expect(tables.courses[0].name).toBe(malicious)
    expect(tables.courses).toHaveLength(1)
  })

  it("SQL injection in search-like field", async () => {
    const malicious = "1 OR 1=1"
    await addItem("courses", { name: malicious, code: "SQL", classId: "cl1", teacherId: "t1" } as any)
    expect(tables.courses[0].name).toBe(malicious)
  })
})

describe("Edge Cases - XSS in fields", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("XSS in name field stored as-is (sanitization is a UI concern)", async () => {
    const xss = '<script>alert("xss")</script>'
    await addItem("courses", { name: xss, code: "XSS", classId: "cl1", teacherId: "t1" } as any)
    expect(tables.courses[0].name).toBe(xss)
  })

  it("XSS in description field", async () => {
    const xss = '<img src=x onerror=alert(1)>'
    await addItem("expenses", { category: "MISCELLANEOUS", amount: 100, description: xss, expenseDate: "2026-01-01" } as any)
    expect(tables.expenses[0].description).toBe(xss)
  })
})

describe("Edge Cases - Very long strings", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("very long name is stored", async () => {
    const longName = "A".repeat(1000)
    await addItem("courses", { name: longName, code: "LONG", classId: "cl1", teacherId: "t1" } as any)
    expect(tables.courses[0].name).toHaveLength(1000)
  })

  it("very long description", async () => {
    const longDesc = "X".repeat(5000)
    await addItem("expenses", { category: "MISCELLANEOUS", amount: 100, description: longDesc, expenseDate: "2026-01-01" } as any)
    expect(tables.expenses[0].description).toHaveLength(5000)
  })
})

describe("Edge Cases - Special characters", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("Unicode characters in names", async () => {
    await addItem("courses", { name: "数学 Mathematics", code: "UNI", classId: "cl1", teacherId: "t1" } as any)
    expect(tables.courses[0].name).toBe("数学 Mathematics")
  })

  it("Emoji in names", async () => {
    await addItem("courses", { name: "Art 🎨 Class", code: "EMJ", classId: "cl1", teacherId: "t1" } as any)
    expect(tables.courses[0].name).toBe("Art 🎨 Class")
  })

  it("Arabic text", async () => {
    await createUser({
      email: "arabic@t.com", password: "p", role: "STUDENT",
      firstName: "محمد", lastName: "علي",
    })
    const profile = tables.profiles.find((p: any) => p.email === "arabic@t.com")
    expect(profile.firstName).toBe("محمد")
  })

  it("special chars in email", async () => {
    await createUser({
      email: "user+tag@sub.domain.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T",
    })
    expect(tables.profiles.find((p: any) => p.email === "user+tag@sub.domain.com")).toBeDefined()
  })
})

describe("Edge Cases - Numeric edge cases", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("negative amount in expense", async () => {
    await addItem("expenses", { category: "MISCELLANEOUS", amount: -100, description: "Refund", expenseDate: "2026-01-01" } as any)
    expect(tables.expenses[0].amount).toBe(-100)
  })

  it("zero amount in payment", async () => {
    await addItem("payments", { studentId: "s1", feeId: "f1", amount: 0, paymentDate: "2026-01-15", paymentMethod: "CASH", receiptNumber: "RCP000" } as any)
    expect(tables.payments[0].amount).toBe(0)
  })

  it("very large amount", async () => {
    await addItem("payments", { studentId: "s1", feeId: "f1", amount: 999999999, paymentDate: "2026-01-15", paymentMethod: "BANK", receiptNumber: "RCP999" } as any)
    expect(tables.payments[0].amount).toBe(999999999)
  })

  it("decimal amount in fee", async () => {
    await addItem("fees", { studentId: "s1", courseId: "c1", totalFee: 29999.99, balance: 29999.99, status: "PENDING" } as any)
    expect(tables.fees[0].totalFee).toBe(29999.99)
  })

  it("payroll with zero amount", async () => {
    const r = await processPayroll("t1", "ctr1", 0, "2026-01-01", "2026-01-31", "2026-01-31", "SALARY")
    expect(r.success).toBe(true)
    expect(tables.payroll_records[0].amount).toBe(0)
  })
})

describe("Edge Cases - Null/undefined handling", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("addItem with null fields", async () => {
    await addItem("courses", { name: "Test", code: "TST", classId: null, teacherId: null } as any)
    expect(tables.courses[0].classId).toBeNull()
    expect(tables.courses[0].teacherId).toBeNull()
  })

  it("updateItem with empty updates object throws (no columns to set)", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" })
    await expect(updateItem("courses", "c1", {} as any)).rejects.toThrow()
  })

  it("student with null optional fields", async () => {
    await createUser({
      email: "s@t.com", password: "p", role: "STUDENT",
      firstName: "S", lastName: "T",
      parentPhone: null, phone: null, gender: null,
    })
    expect(tables.students[0].parentPhone).toBeNull()
    expect(tables.students[0].phone).toBeNull()
    expect(tables.students[0].gender).toBeNull()
  })
})

describe("Edge Cases - Empty result sets", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("getItems returns empty array for empty table", async () => {
    const courses = await getItems<any>("courses")
    expect(courses).toHaveLength(0)
    expect(Array.isArray(courses)).toBe(true)
  })

  it("getItems students returns empty array", async () => {
    const students = await getItems<any>("students")
    expect(students).toHaveLength(0)
  })

  it("getPayrollSummary for empty month", async () => {
    const s = await getPayrollSummary(2026, 1)
    expect(s.totalPayroll).toBe(0)
    expect(s.payCount).toBe(0)
  })

  it("getIncomeSummary for empty data", async () => {
    const s = await getIncomeSummary(2026)
    expect(s).toHaveLength(0)
  })

  it("getEnrollmentStats for empty data", async () => {
    const s = await getEnrollmentStats()
    expect(s.total).toBe(0)
    expect(s.avgProgress).toBe(0)
  })
})

describe("Edge Cases - Large datasets", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("handles 100+ courses", async () => {
    for (let i = 0; i < 120; i++) {
      tables.courses.push({ id: `c${i}`, name: `Course ${i}`, code: `C${i}`, classId: "cl1", teacherId: "t1" })
    }
    const courses = await getItems<any>("courses")
    expect(courses).toHaveLength(120)
  })

  it("handles 100+ students with enrichment", async () => {
    for (let i = 0; i < 110; i++) {
      tables.profiles.push({ id: `s${i}`, email: `s${i}@t.com`, firstName: `First${i}`, lastName: `Last${i}` })
      tables.students.push({ id: `s${i}`, studentNumber: `STU${i}` })
    }
    const students = await getItems<any>("students")
    expect(students).toHaveLength(110)
    expect(students[0].firstName).toBe("First0")
    expect(students[109].firstName).toBe("First109")
  })

  it("rapid inserts and deletes", async () => {
    for (let i = 0; i < 50; i++) {
      await addItem("courses", { name: `Temp${i}`, code: `T${i}`, classId: "cl1", teacherId: "t1" } as any)
    }
    expect(tables.courses).toHaveLength(50)
    for (const c of [...tables.courses]) {
      await deleteItem("courses", c.id)
    }
    expect(tables.courses).toHaveLength(0)
  })
})

describe("Edge Cases - Unknown table key", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("getItems throws for unknown key", async () => {
    await expect(getItems("nonexistent")).rejects.toThrow("Unknown key")
  })

  it("addItem throws for unknown key", async () => {
    await expect(addItem("nonexistent", { name: "X" } as any)).rejects.toThrow("Unknown key")
  })

  it("updateItem throws for unknown key", async () => {
    await expect(updateItem("nonexistent", "x", { name: "X" } as any)).rejects.toThrow("Unknown key")
  })

  it("deleteItem throws for unknown key", async () => {
    await expect(deleteItem("nonexistent", "x")).rejects.toThrow("Unknown key")
  })
})

describe("Edge Cases - Concurrent operations", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("concurrent inserts", async () => {
    const promises = Array.from({ length: 20 }, (_, i) =>
      addItem("courses", { name: `Concurrent${i}`, code: `CC${i}`, classId: "cl1", teacherId: "t1" } as any)
    )
    await Promise.all(promises)
    expect(tables.courses).toHaveLength(20)
  })

  it("concurrent reads and writes", async () => {
    tables.courses.push({ id: "c1", name: "Math", code: "MTH", classId: "cl1", teacherId: "t1" })
    const results = await Promise.all([
      getItems("courses"),
      addItem("courses", { name: "Science", code: "SCI", classId: "cl1", teacherId: "t2" } as any),
      getItems("courses"),
    ])
    expect(results[0]).toHaveLength(1)
    expect(results[2]).toHaveLength(2)
  })
})
