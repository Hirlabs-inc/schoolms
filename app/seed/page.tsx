"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { turso } from "@/lib/turso-client"
import { hashPassword } from "@/lib/auth-client"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

async function seedUser(data: any) {
  const id = crypto.randomUUID()
  const pw = await hashPassword(data.password)
  await turso.execute({
    sql: "insert or ignore into profiles (id, email, password, role, firstName, lastName) values (?, ?, ?, ?, ?, ?)",
    args: [id, data.email, pw, data.role, data.firstName, data.lastName],
  })
  const check = await turso.execute({ sql: "select id from profiles where email = ?", args: [data.email] })
  const userId = (check.rows[0]?.id || id) as string

  if (data.role === "TEACHER") {
    await turso.execute({
      sql: "insert or ignore into teachers (id, staffId, department, specialization) values (?, ?, ?, ?)",
      args: [userId, data.staffId || "TCH001", data.department || "ICT", data.specialization || "General"],
    })
  }
  return true
}

export default function SeedPage() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string[]>([])
  const [error, setError] = useState("")

  const addStatus = (msg: string) => setStatus(prev => [...prev, msg])

  const handleSeed = async () => {
    setLoading(true)
    setStatus([])
    setError("")

    try {
      addStatus("Creating Admin user...")
      await seedUser({ email: "admin@school.edu", password: "admin123", role: "ADMIN", firstName: "John", lastName: "Admin" })
      addStatus("✅ Admin user ready (admin@school.edu / admin123)")

      addStatus("Creating Teacher user...")
      await seedUser({ email: "teacher@school.edu", password: "teacher123", role: "TEACHER", firstName: "Sarah", lastName: "Johnson", staffId: "TCH001", department: "ICT", specialization: "Web Development" })
      addStatus("✅ Teacher user ready (teacher@school.edu / teacher123)")

      addStatus("Creating Student user...")
      await seedUser({ email: "student@school.edu", password: "student123", role: "STUDENT", firstName: "Michael", lastName: "Smith" })
      addStatus("✅ Student user ready (student@school.edu / student123)")

      addStatus("Setting up institution...")
      await turso.execute({
        sql: "insert or replace into institution_settings (id, name, currency, receiptHeader, contactEmail, contactPhone) values (?, ?, ?, ?, ?, ?)",
        args: ["main", "Trainify Technology Training Institute", "KES", "Official Payment Receipt", "info@trainify.com", "+254700000000"],
      })
      addStatus("✅ Institution settings saved")

      addStatus("Seeding role permissions...")
      const roles: Array<{ role: string; permission: string; granted: boolean }> = []
      const defaults = {
        ADMIN: true, MANAGER: true,
        SECRETARY: {
          view_dashboard: true, view_students: true, add_students: true, delete_students: false,
          view_courses: true, add_courses: false, delete_courses: false,
          view_teachers: false, add_teachers: false, delete_teachers: false,
          view_fees: true, manage_fees: false, view_expenses: true, add_expenses: false,
          view_income: true, add_income: false, view_payroll: true, manage_payroll: false,
          view_reports: true, manage_users: false, view_backup: false, manage_settings: false,
          manage_permissions: false, view_exams: true, add_exams: false, view_results: true, add_results: false,
        },
        TEACHER: false, STUDENT: false,
      }
      const allPerms = [
        "view_dashboard","view_students","add_students","delete_students","view_courses","add_courses","delete_courses",
        "view_teachers","add_teachers","delete_teachers","view_fees","manage_fees","view_expenses","add_expenses",
        "view_income","add_income","view_payroll","manage_payroll","view_reports","manage_users","view_backup",
        "manage_settings","manage_permissions","view_exams","add_exams","view_results","add_results",
      ]
      for (const role of ["ADMIN", "MANAGER", "SECRETARY", "TEACHER", "STUDENT"] as const) {
        for (const perm of allPerms) {
          let granted: boolean
          if (role === "ADMIN" || role === "MANAGER") granted = true
          else if (role === "TEACHER" || role === "STUDENT") granted = false
          else granted = (defaults.SECRETARY as any)[perm] ?? false
          roles.push({ role, permission: perm, granted })
        }
      }
      // Upsert each permission row.
      for (const r of roles) {
        await turso.execute({
          sql: "insert or replace into role_permissions (role, permission, granted) values (?, ?, ?)",
          args: [r.role, r.permission, r.granted ? 1 : 0],
        })
      }
      addStatus("✅ Role permissions seeded")

      addStatus("Done! You can now login.")
    } catch (err: any) {
      console.error(err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Database Seeding</CardTitle>
          <CardDescription>Initialize Trainify with demo users.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 p-4 rounded-md text-sm text-yellow-800 border border-yellow-200">
            <p>This will create demo users for Trainify Technology Training Institute:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Admin:</strong> admin@school.edu / admin123</li>
              <li><strong>Teacher:</strong> teacher@school.edu / teacher123</li>
              <li><strong>Student:</strong> student@school.edu / student123</li>
            </ul>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-2 bg-white">
            {status.length === 0 && <p className="text-sm text-gray-400 italic">Ready to seed...</p>}
            {status.map((msg, i) => (
              <div key={i} className="text-sm text-gray-600 flex items-center gap-2">
                {msg.includes("✅") ? <CheckCircle className="h-3 w-3 text-green-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />}
                {msg}
              </div>
            ))}
          </div>

          <Button onClick={handleSeed} className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Seeding...</> : "Seed Database"}
          </Button>

          <Button variant="outline" className="w-full" onClick={() => window.location.href = "/login"}>
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
