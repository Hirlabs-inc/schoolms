"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useUser } from "@/contexts/user-context"
import type { UserRole } from "@/lib/types"
import { Users, BookOpen, DollarSign, CreditCard, LayoutDashboard, TrendingUp, Wallet, BarChart3, Settings, Database } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Students", href: "/admin/students", icon: Users },
  { name: "Courses", href: "/admin/courses", icon: BookOpen },
  { name: "Fees", href: "/admin/fees", icon: DollarSign },
  { name: "Expenses", href: "/admin/expenses", icon: CreditCard },
  { name: "Income", href: "/admin/income", icon: TrendingUp },
  { name: "Payroll", href: "/admin/payroll", icon: Wallet },
  { name: "Progress", href: "/admin/progress", icon: BarChart3 },
  { name: "Reports", href: "/admin/reports", icon: TrendingUp },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Backup", href: "/admin/backup", icon: Database },
  { name: "Settings", href: "/settings", icon: Settings },
]

const titles: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/students": "Student Management",
  "/admin/courses": "Course Management",
  "/admin/fees": "Fee Management",
  "/admin/expenses": "Expense Management",
  "/admin/income": "Income Tracking",
  "/admin/payroll": "Payroll Management",
  "/admin/progress": "Enrollment Progress",
  "/admin/reports": "Financial Reports",
  "/admin/users": "User Management",
  "/admin/backup": "Backup & Restore",
}

const allowedNavForRole = (role: UserRole) => {
  if (role === "ADMIN" || role === "MANAGER") return navigation
  if (role === "SECRETARY") {
    return navigation.filter((item) =>
      ["/admin", "/admin/students", "/admin/fees", "/admin/payroll", "/admin/progress"].includes(item.href)
    )
  }
  return []
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useUser()
  const title = titles[pathname] || "Dashboard"
  const navItems = user ? allowedNavForRole(user.role) : []

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER", "SECRETARY"]}>
      <DashboardLayout navigation={navItems} title={title}>
        {children}
      </DashboardLayout>
    </AuthGuard>
  )
}
