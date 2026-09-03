"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LayoutDashboard, BookOpen, ReceiptText, Settings } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/student", icon: LayoutDashboard },
  { name: "My Courses", href: "/student/courses", icon: BookOpen },
  { name: "My Payments", href: "/student/results", icon: ReceiptText },
  { name: "Settings", href: "/settings", icon: Settings },
]

const titles: Record<string, string> = {
  "/student": "Student Dashboard",
  "/student/courses": "My Courses",
  "/student/results": "My Payments",
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = titles[pathname] || "Student Portal"

  return (
    <AuthGuard allowedRoles={["STUDENT"]}>
      <DashboardLayout navigation={navigation} title={title}>
        {children}
      </DashboardLayout>
    </AuthGuard>
  )
}
