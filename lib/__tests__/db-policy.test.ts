import { describe, it, expect, beforeEach } from "vitest"
import { resetDb } from "../../vitest.setup"
import { isSqlAllowed, checkTablePermission, checkTablePermissionWithOverrides } from "../db-policy"

describe("db-policy - isSqlAllowed (profiles updates)", () => {
  it("allows a quoted-column name/email update for a non-admin role", () => {
    const r = isSqlAllowed(
      `update profiles set "firstName" = ?, "lastName" = ?, "email" = ? where id = ? returning *`,
      "SECRETARY"
    )
    expect(r.ok).toBe(true)
    expect(r.table).toBe("profiles")
    expect(r.action).toBe("update")
  })

  it("allows a password update for a non-admin role", () => {
    const r = isSqlAllowed(`update profiles set password = ? where id = ?`, "SECRETARY")
    expect(r.ok).toBe(true)
  })

  it("blocks role escalation on profiles", () => {
    const r = isSqlAllowed(`update profiles set role = ? where id = ?`, "SECRETARY")
    expect(r.ok).toBe(false)
  })

  it("blocks unknown columns on profiles", () => {
    const r = isSqlAllowed(`update profiles set "passwordHash" = ? where id = ?`, "SECRETARY")
    expect(r.ok).toBe(false)
  })

  it("allows admins to change roles", () => {
    const r = isSqlAllowed(`update profiles set role = ? where id = ?`, "ADMIN")
    expect(r.ok).toBe(true)
  })

  it("still blocks unknown tables and DDL", () => {
    expect(isSqlAllowed(`select * from sqlite_master`, "ADMIN").ok).toBe(false)
    expect(isSqlAllowed(`drop table students`, "ADMIN").ok).toBe(false)
    expect(isSqlAllowed(`select 1; drop table students`, "ADMIN").ok).toBe(false)
  })
})

describe("db-policy - checkTablePermission", () => {
  beforeEach(() => resetDb())

  it("secretary can update profiles (via add_students)", async () => {
    expect(await checkTablePermission("SECRETARY", "profiles", "update")).toBe(true)
  })

  it("secretary can write enrollment_progress (via add_students)", async () => {
    expect(await checkTablePermission("SECRETARY", "enrollment_progress", "add")).toBe(true)
    expect(await checkTablePermission("SECRETARY", "enrollment_progress", "update")).toBe(true)
    expect(await checkTablePermission("SECRETARY", "enrollment_progress", "delete")).toBe(true)
  })

  it("teacher cannot update profiles", async () => {
    expect(await checkTablePermission("TEACHER", "profiles", "update")).toBe(false)
  })

  it("secretary can read profiles and institution settings (student list + finance config)", async () => {
    expect(await checkTablePermission("SECRETARY", "profiles", "view")).toBe(true)
    expect(await checkTablePermission("SECRETARY", "institution_settings", "view")).toBe(true)
  })

  it("secretary can delete students and their auto-created commissions", async () => {
    expect(await checkTablePermission("SECRETARY", "students", "delete")).toBe(true)
    expect(await checkTablePermission("SECRETARY", "teacher_commissions", "delete")).toBe(true)
  })

  it("student cannot read students", async () => {
    expect(await checkTablePermission("STUDENT", "students", "view")).toBe(false)
  })

  it("admin and manager always pass", async () => {
    expect(await checkTablePermission("ADMIN", "profiles", "delete")).toBe(true)
    expect(await checkTablePermission("MANAGER", "role_permissions", "update")).toBe(true)
  })
})

describe("db-policy - checkTablePermissionWithOverrides (per-request)", () => {
  it("honours an explicit deny override", () => {
    const overrides = new Map<string, boolean>([["view_students", false]])
    expect(checkTablePermissionWithOverrides("SECRETARY", overrides, "students", "view")).toBe(false)
  })

  it("honours an explicit grant override", () => {
    const overrides = new Map<string, boolean>([["view_teachers", true]])
    expect(checkTablePermissionWithOverrides("SECRETARY", overrides, "teachers", "view")).toBe(true)
  })

  it("falls back to defaults when there is no override", () => {
    expect(checkTablePermissionWithOverrides("SECRETARY", new Map(), "courses", "view")).toBe(true)
    expect(checkTablePermissionWithOverrides("TEACHER", new Map(), "courses", "view")).toBe(false)
  })

  it("admin always passes regardless of overrides", () => {
    const overrides = new Map<string, boolean>([["view_students", false]])
    expect(checkTablePermissionWithOverrides("ADMIN", overrides, "students", "view")).toBe(true)
  })
})
