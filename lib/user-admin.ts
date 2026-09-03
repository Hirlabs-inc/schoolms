import "server-only"
import { turso } from "./turso"
import { hashPassword } from "./auth"
import type { SessionUser } from "./auth"

// Server-side logic for managing STAFF user accounts (ADMIN / MANAGER /
// SECRETARY / TEACHER). Student roster accounts are intentionally NOT managed
// here — they belong to the Students page.
//
// All SQL uses lowercase, unquoted column names so it runs identically against
// Turso (SQLite) and the local Postgres path (lib/pg-adapter.ts).

const MANAGED_ROLES = ["ADMIN", "MANAGER", "SECRETARY", "TEACHER"] as const
export type ManagedRole = (typeof MANAGED_ROLES)[number]

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function err(status: number, message: string): HttpError {
  return new HttpError(status, message)
}

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t === "" ? null : t
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function isManagedRole(role: unknown): role is ManagedRole {
  return typeof role === "string" && (MANAGED_ROLES as readonly string[]).includes(role)
}

function assertActor(actor: SessionUser | null | undefined): asserts actor is SessionUser {
  if (!actor) throw err(401, "Unauthorized")
}

function assertStaffActor(actor: SessionUser | null | undefined): asserts actor is SessionUser {
  assertActor(actor)
  if (actor.role !== "ADMIN" && actor.role !== "MANAGER") {
    throw err(403, "Forbidden: admin or manager access required")
  }
}

// Only an ADMIN may create, modify or delete ADMIN accounts.
function assertCanManageRole(actor: SessionUser, role: string): void {
  if (role === "ADMIN" && actor.role !== "ADMIN") {
    throw err(403, "Only administrators can manage administrator accounts")
  }
}

async function getProfile(id: string) {
  const rs = await turso.execute({
    sql: "select id, email, role, firstname, lastname from profiles where id = ?",
    args: [id],
  })
  return (rs.rows[0] as any) ?? null
}

async function countAdminsExcept(excludeId: string): Promise<number> {
  const rs = await turso.execute({
    sql: "select count(*) as n from profiles where role = 'ADMIN' and id != ?",
    args: [excludeId],
  })
  return Number(rs.rows[0]?.n ?? 0)
}

function genStaffId(): string {
  return "TCH" + String(Math.floor(1000 + Math.random() * 9000))
}

// Create the `teachers` side-row for a TEACHER account (id == profile id).
async function ensureTeacherRow(
  id: string,
  fields: { staffId?: unknown; department?: unknown; specialization?: unknown; firstName?: unknown; lastName?: unknown },
  opts: { onlyWhenMissing?: boolean } = {}
): Promise<void> {
  const exists = await turso.execute({ sql: "select id from teachers where id = ?", args: [id] })
  if (exists.rows.length === 0) {
    await turso.execute({
      sql: "insert into teachers (id, staffid, department, specialization, firstname, lastname) values (?, ?, ?, ?, ?, ?)",
      args: [
        id,
        clean(fields.staffId) ?? genStaffId(),
        clean(fields.department),
        clean(fields.specialization),
        clean(fields.firstName),
        clean(fields.lastName),
      ],
    })
    return
  }
  if (opts.onlyWhenMissing) return
  const set: string[] = []
  const vals: any[] = []
  const cols: Array<[string, unknown]> = [
    ["staffid", fields.staffId],
    ["department", fields.department],
    ["specialization", fields.specialization],
    ["firstname", fields.firstName],
    ["lastname", fields.lastName],
  ]
  for (const [col, value] of cols) {
    if (value !== undefined) {
      set.push(`${col} = ?`)
      vals.push(clean(value))
    }
  }
  if (set.length) {
    await turso.execute({ sql: `update teachers set ${set.join(", ")} where id = ?`, args: [...vals, id] })
  }
}

// When an account stops being a TEACHER, drop the teacher identity. Blocked if
// any teacher records (contracts / commissions / payroll) still exist so we
// never silently destroy financial history.
async function removeTeacherIdentity(id: string): Promise<void> {
  const [c, m, p] = await Promise.all([
    turso.execute({ sql: "select count(*) as n from teacher_contracts where teacherid = ?", args: [id] }),
    turso.execute({ sql: "select count(*) as n from teacher_commissions where teacherid = ?", args: [id] }),
    turso.execute({ sql: "select count(*) as n from payroll_records where teacherid = ?", args: [id] }),
  ])
  const history = {
    contracts: Number(c.rows[0]?.n ?? 0),
    commissions: Number(m.rows[0]?.n ?? 0),
    payroll: Number(p.rows[0]?.n ?? 0),
  }
  if (history.contracts || history.commissions || history.payroll) {
    throw err(
      409,
      "This account has teacher contracts, commissions or payroll history. Remove or reassign those records before changing the role away from Teacher."
    )
  }
  await turso.execute({ sql: "delete from course_teachers where teacherid = ?", args: [id] })
  await turso.execute({ sql: "delete from teachers where id = ?", args: [id] })
}

function assertValidEmail(email: string): void {
  if (!isEmail(email)) throw err(400, "Invalid email format")
}

// --- Create ---

export async function createStaffUser(actor: SessionUser | null | undefined, input: any) {
  assertStaffActor(actor)

  const role = input?.role
  if (!isManagedRole(role)) {
    throw err(400, `Unsupported role: ${String(role ?? "")}. Manageable roles are ${MANAGED_ROLES.join(", ")}.`)
  }
  assertCanManageRole(actor as SessionUser, role)

  const email = (clean(input.email) ?? "").toLowerCase()
  if (!email) throw err(400, "Email is required")
  assertValidEmail(email)

  const password = typeof input.password === "string" ? input.password : ""
  if (password.length < 6) throw err(400, "Password must be at least 6 characters")

  const dup = await turso.execute({ sql: "select id from profiles where email = ?", args: [email] })
  if (dup.rows.length > 0) throw err(409, "A user with that email already exists")

  const userId = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  await turso.execute({
    sql: "insert into profiles (id, email, password, role, firstname, lastname) values (?, ?, ?, ?, ?, ?)",
    args: [userId, email, passwordHash, role, clean(input.firstName), clean(input.lastName)],
  })

  if (role === "TEACHER") {
    await ensureTeacherRow(userId, input)
  }

  return { success: true, userId }
}

// --- Update ---

export async function updateStaffUser(actor: SessionUser | null | undefined, id: string, patch: any) {
  assertStaffActor(actor)

  const profile = await getProfile(id)
  if (!profile) throw err(404, "User not found")
  if (profile.role === "STUDENT") {
    throw err(400, "Student accounts are managed from the Students page")
  }

  const currentRole = profile.role as string
  const newRole = patch?.role === undefined ? currentRole : patch.role
  if (!isManagedRole(newRole)) {
    throw err(400, `Unsupported role: ${String(newRole)}`)
  }

  // Managers can only manage non-admin accounts; only an admin grants ADMIN.
  assertCanManageRole(actor as SessionUser, currentRole)
  assertCanManageRole(actor as SessionUser, newRole)

  if (id === (actor as SessionUser).id && newRole !== currentRole) {
    throw err(403, "You cannot change your own role")
  }

  // Never leave the system without an admin.
  if (currentRole === "ADMIN" && newRole !== "ADMIN") {
    if ((await countAdminsExcept(id)) < 1) {
      throw err(409, "Cannot demote the last administrator account")
    }
  }

  // Email validation / uniqueness.
  let email = profile.email as string
  if (patch?.email !== undefined) {
    email = (clean(patch.email) ?? "").toLowerCase()
    if (!email) throw err(400, "Email is required")
    assertValidEmail(email)
    const dup = await turso.execute({ sql: "select id from profiles where email = ? and id != ?", args: [email, id] })
    if (dup.rows.length > 0) throw err(409, "A user with that email already exists")
  }

  // Optional password reset.
  let passwordHash: string | undefined
  if (patch?.password) {
    if (typeof patch.password !== "string" || patch.password.length < 6) {
      throw err(400, "Password must be at least 6 characters")
    }
    passwordHash = await hashPassword(patch.password)
  }

  const updates: Record<string, any> = {
    firstname: clean(patch?.firstName) ?? profile.firstname ?? null,
    lastname: clean(patch?.lastName) ?? profile.lastname ?? null,
    email,
    role: newRole,
  }
  if (passwordHash) updates.password = passwordHash

  const cols = Object.keys(updates)
  const setSql = cols.map((c) => `${c} = ?`).join(", ")
  await turso.execute({
    sql: `update profiles set ${setSql} where id = ?`,
    args: [...cols.map((c) => updates[c]), id],
  })

  // Keep the teachers side-row in sync with the account.
  const isTeacher = newRole === "TEACHER"
  const wasTeacher = currentRole === "TEACHER"
  if (isTeacher) {
    await ensureTeacherRow(id, patch ?? {})
  } else if (wasTeacher) {
    await removeTeacherIdentity(id)
  }

  return { success: true }
}

// --- Delete ---

export async function deleteStaffUser(actor: SessionUser | null | undefined, id: string) {
  assertStaffActor(actor)

  if (id === (actor as SessionUser).id) {
    throw err(403, "You cannot delete your own account")
  }

  const profile = await getProfile(id)
  if (!profile) throw err(404, "User not found")
  if (profile.role === "STUDENT") {
    throw err(400, "Student accounts are managed from the Students page")
  }

  assertCanManageRole(actor as SessionUser, profile.role)

  if (profile.role === "ADMIN" && (await countAdminsExcept(id)) < 1) {
    throw err(409, "Cannot delete the last administrator account")
  }

  if (profile.role === "TEACHER") {
    // Full cascade, matching the destructive confirm shown in the UI.
    await turso.batch([
      { sql: "delete from course_teachers where teacherid = ?", args: [id] },
      { sql: "delete from teacher_commissions where teacherid = ?", args: [id] },
      { sql: "delete from payroll_records where teacherid = ?", args: [id] },
      { sql: "delete from teacher_contracts where teacherid = ?", args: [id] },
      { sql: "delete from teachers where id = ?", args: [id] },
      { sql: "delete from profiles where id = ?", args: [id] },
    ])
  } else {
    await turso.execute({ sql: "delete from profiles where id = ?", args: [id] })
  }

  return { success: true }
}