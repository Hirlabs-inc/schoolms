import { NextRequest, NextResponse } from "next/server"
import { turso } from "@/lib/turso"
import { hashPassword, isSameOrigin } from "@/lib/auth"

// POST /api/dev/seed — creates demo accounts/settings/permissions.
// DISABLED in production (returns 404). Hashing happens server-side so the
// bcrypt library is never shipped to the browser.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const steps: string[] = []

  const demoUsers = [
    { email: "admin@school.edu", password: "admin12345", role: "ADMIN", firstName: "John", lastName: "Admin" },
    { email: "teacher@school.edu", password: "teacher12345", role: "TEACHER", firstName: "Sarah", lastName: "Johnson" },
    { email: "student@school.edu", password: "student12345", role: "STUDENT", firstName: "Michael", lastName: "Smith" },
  ]

  for (const u of demoUsers) {
    const password = await hashPassword(u.password)
    await turso.execute({
      sql: "insert or ignore into profiles (id, email, password, role, firstName, lastName) values (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), u.email, password, u.role, u.firstName, u.lastName],
    })
    const found = await turso.execute({ sql: "select id from profiles where email = ?", args: [u.email] })
    const id = (found.rows[0] as any)?.id
    if (u.role === "TEACHER" && id) {
      await turso.execute({
        sql: "insert or ignore into teachers (id, staffId, department, specialization) values (?, ?, ?, ?)",
        args: [id, "TCH001", "ICT", "Web Development"],
      })
    }
    steps.push(`✅ ${u.role} user ready (${u.email})`)
  }

  await turso.execute({
    sql: "insert or replace into institution_settings (id, name, currency, receiptHeader, contactEmail, contactPhone) values (?, ?, ?, ?, ?, ?)",
    args: ["main", "Trainify Technology Training Institute", "KES", "Official Payment Receipt", "info@trainify.com", "+254700000000"],
  })
  steps.push("✅ Institution settings saved")

  const secretaryDefaults: Record<string, boolean> = {
    view_dashboard: true, view_students: true, add_students: true, delete_students: true,
    view_courses: true, view_fees: true, manage_fees: true, view_expenses: true,
    view_income: true, add_income: true, view_payroll: true, view_reports: true,
  }
  const allPerms = [
    "view_dashboard", "view_students", "add_students", "delete_students", "view_courses", "add_courses", "delete_courses",
    "view_teachers", "add_teachers", "delete_teachers", "view_fees", "manage_fees", "view_expenses", "add_expenses",
    "view_income", "add_income", "view_payroll", "manage_payroll", "view_reports", "manage_users", "view_backup",
    "manage_settings", "manage_permissions",
  ]
  for (const role of ["ADMIN", "MANAGER", "SECRETARY", "TEACHER", "STUDENT"] as const) {
    for (const perm of allPerms) {
      const granted =
        role === "ADMIN" || role === "MANAGER" ? true
          : role === "TEACHER" || role === "STUDENT" ? false
            : secretaryDefaults[perm] ?? false
      await turso.execute({
        sql: "insert or replace into role_permissions (role, permission, granted) values (?, ?, ?)",
        args: [role, perm, granted],
      })
    }
  }
  steps.push("✅ Role permissions seeded")

  return NextResponse.json({ success: true, steps })
}
