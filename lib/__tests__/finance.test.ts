import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { getItems, addItem, updateItem, deleteItem, getIncomeSummary } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

describe("Income CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("create income with FEES category", async () => {
    const inc = await addItem("income", {
      category: "FEES", amount: 100000, description: "Tuition fees",
      incomeDate: "2026-01-15", receiptNumber: "INC001",
    } as any)
    expect(inc.id).toBeDefined()
    expect(tables.income).toHaveLength(1)
    expect(tables.income[0].category).toBe("FEES")
  })

  it("create income with GRANTS category", async () => {
    await addItem("income", {
      category: "GRANTS", amount: 500000, description: "Government grant",
      incomeDate: "2026-02-01",
    } as any)
    expect(tables.income[0].category).toBe("GRANTS")
  })

  it("create income with DONATIONS category", async () => {
    await addItem("income", {
      category: "DONATIONS", amount: 50000, description: "Alumni donation",
      incomeDate: "2026-03-01",
    } as any)
    expect(tables.income[0].category).toBe("DONATIONS")
  })

  it("create income with OTHER category", async () => {
    await addItem("income", {
      category: "OTHER", amount: 10000, description: "Misc income",
      incomeDate: "2026-04-01",
    } as any)
    expect(tables.income[0].category).toBe("OTHER")
  })

  it("get all income with createdBy enrichment", async () => {
    tables.profiles.push({ id: "adm1", firstName: "Ad", lastName: "Min" })
    tables.income.push({ id: "i1", category: "FEES", amount: 10000, description: "Fees", incomeDate: "2026-01-01", createdBy: "adm1" })
    const income = await getItems<any>("income")
    expect(income[0].firstName).toBe("Ad")
    expect(income[0].lastName).toBe("Min")
  })

  it("update income", async () => {
    tables.income.push({ id: "i1", category: "FEES", amount: 10000, description: "Old", incomeDate: "2026-01-01" })
    const updated = await updateItem("income", "i1", { amount: 15000, description: "Updated" } as any)
    expect(updated.amount).toBe(15000)
    expect(updated.description).toBe("Updated")
  })

  it("delete income", async () => {
    tables.income.push({ id: "i1", category: "FEES", amount: 10000, description: "Del", incomeDate: "2026-01-01" })
    await deleteItem("income", "i1")
    expect(tables.income).toHaveLength(0)
  })

  it("income with createdBy field", async () => {
    await addItem("income", {
      category: "FEES", amount: 10000, description: "Fees",
      incomeDate: "2026-01-01", createdBy: "admin-1",
    } as any)
    expect(tables.income[0].createdBy).toBe("admin-1")
  })
})

describe("Income Summary", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("groups by category for full year", async () => {
    tables.income.push(
      { id: "i1", category: "FEES", amount: 100000, incomeDate: "2026-01-15" },
      { id: "i2", category: "FEES", amount: 50000, incomeDate: "2026-02-20" },
      { id: "i3", category: "GRANTS", amount: 200000, incomeDate: "2026-03-01" },
    )
    const summary = await getIncomeSummary(2026)
    expect(summary).toHaveLength(2)
    const fees = summary.find((s: any) => s.category === "FEES")
    expect(fees.total).toBe(150000)
  })

  it("filters by month", async () => {
    tables.income.push(
      { id: "i1", category: "FEES", amount: 100000, incomeDate: "2026-01-15" },
      { id: "i2", category: "FEES", amount: 50000, incomeDate: "2026-02-20" },
    )
    const summary = await getIncomeSummary(2026, 1)
    expect(summary).toHaveLength(1)
    expect(summary[0].total).toBe(100000)
  })

  it("returns empty for month with no income", async () => {
    tables.income.push({ id: "i1", category: "FEES", amount: 100000, incomeDate: "2026-01-15" })
    const summary = await getIncomeSummary(2026, 6)
    expect(summary).toHaveLength(0)
  })
})

describe("Expenses CRUD", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("create expense with RENT category", async () => {
    const exp = await addItem("expenses", {
      category: "RENT", amount: 50000, description: "Office rent",
      expenseDate: "2026-01-01",
    } as any)
    expect(exp.id).toBeDefined()
    expect(tables.expenses).toHaveLength(1)
  })

  it("create expense with SALARIES category", async () => {
    await addItem("expenses", {
      category: "SALARIES", amount: 100000, description: "Staff salaries",
      expenseDate: "2026-01-31",
    } as any)
    expect(tables.expenses[0].category).toBe("SALARIES")
  })

  it("create expense with INTERNET category", async () => {
    await addItem("expenses", {
      category: "INTERNET", amount: 5000, description: "Monthly internet",
      expenseDate: "2026-01-15",
    } as any)
    expect(tables.expenses[0].category).toBe("INTERNET")
  })

  it("create expense with ELECTRICITY category", async () => {
    await addItem("expenses", {
      category: "ELECTRICITY", amount: 8000, description: "Power bill",
      expenseDate: "2026-01-20",
    } as any)
    expect(tables.expenses[0].category).toBe("ELECTRICITY")
  })

  it("create expense with MARKETING category", async () => {
    await addItem("expenses", {
      category: "MARKETING", amount: 20000, description: "Ad campaign",
      expenseDate: "2026-02-01",
    } as any)
    expect(tables.expenses[0].category).toBe("MARKETING")
  })

  it("create expense with OFFICE_SUPPLIES category", async () => {
    await addItem("expenses", {
      category: "OFFICE_SUPPLIES", amount: 3000, description: "Stationery",
      expenseDate: "2026-02-10",
    } as any)
    expect(tables.expenses[0].category).toBe("OFFICE_SUPPLIES")
  })

  it("create expense with TRANSPORT category", async () => {
    await addItem("expenses", {
      category: "TRANSPORT", amount: 10000, description: "Field trip",
      expenseDate: "2026-03-01",
    } as any)
    expect(tables.expenses[0].category).toBe("TRANSPORT")
  })

  it("create expense with MISCELLANEOUS category", async () => {
    await addItem("expenses", {
      category: "MISCELLANEOUS", amount: 2000, description: "Other",
      expenseDate: "2026-03-15",
    } as any)
    expect(tables.expenses[0].category).toBe("MISCELLANEOUS")
  })

  it("get all expenses with createdBy enrichment", async () => {
    tables.profiles.push({ id: "adm1", firstName: "Ad", lastName: "Min" })
    tables.expenses.push({ id: "e1", category: "RENT", amount: 50000, description: "Rent", expenseDate: "2026-01-01", createdBy: "adm1" })
    const expenses = await getItems<any>("expenses")
    expect(expenses[0].firstName).toBe("Ad")
    expect(expenses[0].lastName).toBe("Min")
  })

  it("update expense", async () => {
    tables.expenses.push({ id: "e1", category: "RENT", amount: 50000, description: "Old", expenseDate: "2026-01-01" })
    const updated = await updateItem("expenses", "e1", { amount: 55000, description: "Updated" } as any)
    expect(updated.amount).toBe(55000)
  })

  it("delete expense", async () => {
    tables.expenses.push({ id: "e1", category: "RENT", amount: 50000, description: "Del", expenseDate: "2026-01-01" })
    await deleteItem("expenses", "e1")
    expect(tables.expenses).toHaveLength(0)
  })

  it("expense with receiptNumber", async () => {
    await addItem("expenses", {
      category: "RENT", amount: 50000, description: "Rent",
      expenseDate: "2026-01-01", receiptNumber: "EXP-RCPT-001",
    } as any)
    expect(tables.expenses[0].receiptNumber).toBe("EXP-RCPT-001")
  })
})
