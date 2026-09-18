import { describe, it, expect, beforeEach } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import { getItems, getItemsSafe } from "../api"

async function seedAdmin() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("password123", 10)
  tables.profiles.push({
    id: "admin-1", email: "admin@school.com", password: hash,
    role: "ADMIN", firstName: "Admin", lastName: "User",
  })
  localStorage.setItem("auth_token", "mock-jwt-token")
}

function seedSecretary() {
  tables.profiles.push({
    id: "sec-1", email: "secretary@test.com", password: "h",
    role: "SECRETARY", firstName: "Sec", lastName: "Retary",
  })
  localStorage.setItem("auth_token", "mock-secretary-token")
}

describe("getItemsSafe", () => {
  beforeEach(() => resetDb())

  it("returns data when permitted", async () => {
    await seedAdmin()
    tables.courses.push({ id: "c1", name: "Math", code: "MTH" })
    expect(await getItemsSafe("courses")).toHaveLength(1)
  })

  it("returns [] instead of throwing when the role lacks the permission", async () => {
    seedSecretary()
    // Secretary has view_courses (so the Courses page loads) but not view_teachers.
    expect(await getItems("courses")).toBeDefined()
    expect(await getItemsSafe("teachers")).toEqual([])
  })

  it("returns [] for an unknown key", async () => {
    await seedAdmin()
    expect(await getItemsSafe("notARealTable")).toEqual([])
  })
})
