import { describe, it, expect, beforeEach, vi } from "vitest"
import { resetDb, tables } from "../../vitest.setup"
import {
  login, logout, getCurrentUser, updatePassword, resetPassword,
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

async function seedStudent() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("student123", 10)
  tables.profiles.push({
    id: "stu-1", email: "student@test.com", password: hash,
    role: "STUDENT", firstName: "Stud", lastName: "Ent",
  })
}

async function seedTeacher() {
  const bcrypt = await import("bcryptjs")
  const hash = await bcrypt.hash("teacher123", 10)
  tables.profiles.push({
    id: "tch-1", email: "teacher@test.com", password: hash,
    role: "TEACHER", firstName: "Teach", lastName: "Er",
  })
}

describe("Auth - Login Edge Cases", () => {
  beforeEach(() => { resetDb() })

  it("login with empty email throws", async () => {
    await expect(login("", "pass")).rejects.toThrow()
  })

  it("login with empty password throws", async () => {
    await seedAdmin()
    await expect(login("admin@school.com", "")).rejects.toThrow()
  })

  it("login with null email throws", async () => {
    await expect(login(null as any, "pass")).rejects.toThrow()
  })

  it("login with undefined password throws", async () => {
    await seedAdmin()
    await expect(login("admin@school.com", undefined as any)).rejects.toThrow()
  })

  it("login sets token in localStorage on success", async () => {
    await seedAdmin()
    await login("admin@school.com", "password123")
    expect(localStorage.getItem("auth_token")).toBe("mock-jwt-token")
  })

  it("login returns user object with correct fields", async () => {
    await seedAdmin()
    const user = await login("admin@school.com", "password123")
    expect(user).toHaveProperty("id")
    expect(user).toHaveProperty("email")
    expect(user).toHaveProperty("role")
    expect(user).toHaveProperty("firstName")
    expect(user).toHaveProperty("lastName")
  })

  it("login with student credentials returns student role", async () => {
    await seedStudent()
    const user = await login("student@test.com", "student123")
    expect(user.role).toBe("STUDENT")
  })

  it("login with teacher credentials returns teacher role", async () => {
    await seedTeacher()
    const user = await login("teacher@test.com", "teacher123")
    expect(user.role).toBe("TEACHER")
  })

  it("login is case-sensitive for email", async () => {
    await seedAdmin()
    await expect(login("ADMIN@SCHOOL.COM", "password123")).rejects.toThrow()
  })
})

describe("Auth - Logout", () => {
  beforeEach(() => { resetDb() })

  it("logout clears both auth_token and currentUser", async () => {
    localStorage.setItem("auth_token", "tok")
    localStorage.setItem("currentUser", '{"id":"1"}')
    await logout()
    expect(localStorage.getItem("auth_token")).toBeNull()
    expect(localStorage.getItem("currentUser")).toBeNull()
  })

  it("logout is safe to call when already logged out", async () => {
    await expect(logout()).resolves.not.toThrow()
  })
})

describe("Auth - getCurrentUser", () => {
  beforeEach(() => { resetDb() })

  it("returns null when token is cleared mid-session", async () => {
    await seedAdmin()
    await getCurrentUser()
    localStorage.removeItem("auth_token")
    const u = await getCurrentUser()
    expect(u).toBeNull()
  })

  it("returns student user with student token", async () => {
    localStorage.setItem("auth_token", "mock-student-token")
    const u = await getCurrentUser()
    expect(u).not.toBeNull()
    expect(u!.role).toBe("STUDENT")
  })

  it("returns teacher user with teacher token", async () => {
    localStorage.setItem("auth_token", "mock-teacher-token")
    const u = await getCurrentUser()
    expect(u).not.toBeNull()
    expect(u!.role).toBe("TEACHER")
  })
})

describe("Auth - updatePassword", () => {
  beforeEach(async () => { resetDb(); await seedAdmin() })

  it("updates password hash in profiles table", async () => {
    await updatePassword("newSecurePass")
    const profile = tables.profiles.find((p: any) => p.id === "admin-1")
    expect(profile.password).toBe("hashed_newSecurePass")
  })

  it("throws when not authenticated", async () => {
    localStorage.removeItem("auth_token")
    await expect(updatePassword("newpass")).rejects.toThrow("Not authenticated")
  })

  it("can update password multiple times", async () => {
    await updatePassword("pass1")
    const p1 = tables.profiles.find((p: any) => p.id === "admin-1").password
    await updatePassword("pass2")
    const p2 = tables.profiles.find((p: any) => p.id === "admin-1").password
    expect(p1).toBe("hashed_pass1")
    expect(p2).toBe("hashed_pass2")
    expect(p1).not.toBe(p2)
  })
})

describe("Auth - resetPassword", () => {
  beforeEach(() => { resetDb() })

  it("succeeds for existing email", async () => {
    tables.profiles.push({ id: "u1", email: "x@y.com", password: "h", role: "STUDENT", firstName: "X", lastName: "Y" })
    const ok = await resetPassword("x@y.com")
    expect(ok).toBe(true)
  })

  it("throws for non-existent email", async () => {
    await expect(resetPassword("nobody@nowhere.com")).rejects.toThrow("No account found")
  })

  it("works for multiple users with different emails", async () => {
    tables.profiles.push(
      { id: "u1", email: "a@b.com", password: "h", role: "STUDENT", firstName: "A", lastName: "B" },
      { id: "u2", email: "c@d.com", password: "h", role: "TEACHER", firstName: "C", lastName: "D" },
    )
    expect(await resetPassword("a@b.com")).toBe(true)
    expect(await resetPassword("c@d.com")).toBe(true)
  })

  it("multiple resets for same email all succeed", async () => {
    tables.profiles.push({ id: "u1", email: "a@b.com", password: "h", role: "STUDENT", firstName: "A", lastName: "B" })
    expect(await resetPassword("a@b.com")).toBe(true)
    expect(await resetPassword("a@b.com")).toBe(true)
    expect(await resetPassword("a@b.com")).toBe(true)
  })
})
