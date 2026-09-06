"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { login, fetchRolePermissions } from "@/lib/api"
import { useUser } from "@/contexts/user-context"
import { GraduationCap, Loader2 } from "lucide-react"
import Link from "next/link"

// Map permission -> preferred admin route. Used to pick the first page a user
// is allowed to see after login, so they never land on a page they can't access.
const PERMISSION_ROUTE: Record<string, string> = {
  view_dashboard: "/admin",
  view_students: "/admin/students",
  view_courses: "/admin/courses",
  view_fees: "/admin/fees",
  view_expenses: "/admin/expenses",
  view_income: "/admin/income",
  view_payroll: "/admin/payroll",
  view_reports: "/admin/reports",
  view_exams: "/admin/exams",
  manage_users: "/admin/users",
  manage_permissions: "/admin/permissions",
  view_backup: "/admin/backup",
}

// First admin route to try for each role (used for TEACHER/STUDENT where we
// don't need to check permissions).
const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  ADMIN: "/admin",
  MANAGER: "/admin",
  SECRETARY: "/admin",
  TEACHER: "/teacher",
  STUDENT: "/student",
}

export default function LoginPage() {
  const router = useRouter()
  const { refreshUser } = useUser()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function redirectToRoleDashboard(role: string) {
    // For teacher/student, redirect directly — no permission check needed.
    if (role === "TEACHER" || role === "STUDENT") {
      router.push(ROLE_DEFAULT_ROUTE[role] || "/admin")
      return
    }

    // For admin roles, fetch permissions and redirect to the first page
    // they're allowed to see. This prevents landing on /admin when
    // view_dashboard is false.
    try {
      const data = await fetchRolePermissions(role)
      const granted = new Set(
        data.permissions.filter((p) => p.granted).map((p) => p.permission)
      )

      // Find the first permission the user can access, in priority order.
      const orderedPerms = Object.keys(PERMISSION_ROUTE)
      let target = null
      for (const perm of orderedPerms) {
        if (granted.has(perm)) {
          target = PERMISSION_ROUTE[perm]
          break
        }
      }

      router.push(target || ROLE_DEFAULT_ROUTE[role] || "/admin")
    } catch {
      // If the permissions API fails, fall back to the role default.
      router.push(ROLE_DEFAULT_ROUTE[role] || "/admin")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const user = await login(email, password)
      if (user) {
        await refreshUser()
        await redirectToRoleDashboard(user.role)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Trainify Technology Training Institute</h1>
          <p className="text-muted-foreground">Sign in to access your portal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign In"}
              </Button>
            </form>


          </CardContent>
        </Card>
      </div>
    </div>
  )
}
