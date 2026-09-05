"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { AuthGuard } from "@/components/auth-guard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useUser } from "@/contexts/user-context"
import type { UserRole } from "@/lib/types"
import { Users, BookOpen, DollarSign, CreditCard, LayoutDashboard, TrendingUp, Wallet, BarChart3, Settings, Database, Shield, FileText, ClipboardList } from "lucide-react"

// Navigation items mapped 1:1 to permissions.
const navigation = [
  { name: "Dashboard",        href: "/admin",                icon: LayoutDashboard, permission: "view_dashboard"  },
  { name: "Students",         href: "/admin/students",       icon: Users,              permission: "view_students"   },
  { name: "Courses",          href: "/admin/courses",        icon: BookOpen,           permission: "view_courses"  },
  { name: "Fees",             href: "/admin/fees",           icon: DollarSign,         permission: "view_fees"       },
  { name: "Expenses",         href: "/admin/expenses",       icon: CreditCard,         permission: "view_expenses"   },
  { name: "Income",           href: "/admin/income",         icon: TrendingUp,         permission: "view_income"     },
  { name: "Payroll",          href: "/admin/payroll",        icon: Wallet,             permission: "view_payroll"    },
  { name: "Progress",         href: "/admin/progress",       icon: BarChart3,          permission: "view_dashboard"  },
  { name: "Reports",          href: "/admin/reports",        icon: TrendingUp,         permission: "view_reports"    },
  { name: "Exams",            href: "/admin/exams",          icon: ClipboardList,      permission: "view_exams"      },
  { name: "Users",              href: "/admin/users",          icon: Users,              permission: "manage_users"    },
  { name: "Permissions",      href: "/admin/permissions",    icon: Shield,             permission: "manage_permissions" },
  { name: "Backup",           href: "/admin/backup",         icon: Database,           permission: "view_backup"     },
  { name: "Settings",         href: "/settings",             icon: Settings,           permission: "manage_settings"  },
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
  "/admin/exams": "Exam Management",
  "/admin/users": "User Management",
  "/admin/permissions": "Role Permissions",
  "/admin/backup": "Backup & Restore",
}

/**
 * Server-free fallback: when the permissions API is unreachable (e.g. on
 * first load / network error), the original role-based nav filtering is used
 * so the UI degrades gracefully instead of showing an empty sidebar.
 */
const fallbackNavForRole = (role: UserRole) => {
  if (role === "ADMIN" || role === "MANAGER") return navigation
  if (role === "SECRETARY") {
    return navigation.filter((item) =>
      ["/admin", "/admin/students", "/admin/courses", "/admin/fees", "/admin/income", "/admin/expenses", "/admin/payroll", "/admin/progress", "/admin/users", "/settings"].includes(item.href)
    )
  }
  return []
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, isLoading } = useUser()
  const title = titles[pathname] || "Dashboard"

  // Resolve the effective permission set for the current user's role from the
  // API (which merges DB overrides + defaults). Falls back to role-based
  // filtering when the API is unavailable.
  const [navItems, setNavItems] = useState(navigation)

  useEffect(() => {
    if (!user) {
      setNavItems([])
      return
    }
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/permissions/${user.role}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        })
        if (!res.ok) throw new Error("permissions fetch failed")
        const data = await res.json() as { permissions: Array<{ permission: string; granted: boolean }> }
        const granted = new Set(
          data.permissions.filter((p) => p.granted).map((p) => p.permission)
        )
        setNavItems(navigation.filter((item) => granted.has(item.permission)))
      } catch {
        // Fallback: use the original role-based nav.
        setNavItems(fallbackNavForRole(user.role))
      }
    })()
  }, [user])

  if (isLoading) return null

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER", "SECRETARY"]}>
      <DashboardLayout navigation={navItems} title={title}>
        {children}
      </DashboardLayout>
    </AuthGuard>
  )
}
