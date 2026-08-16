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
