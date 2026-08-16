"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LayoutDashboard, BookOpen, Users, Settings } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/teacher", icon: LayoutDashboard },
  { name: "My Courses", href: "/teacher/courses", icon: BookOpen },
  { name: "Students", href: "/teacher/attendance", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
]

const titles: Record<string, string> = {
  "/teacher": "Dashboard",
  "/teacher/courses": "My Courses",
  "/teacher/attendance": "My Students",
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const title = titles[pathname] || "Dashboard"

  return (
    <AuthGuard allowedRoles={["TEACHER"]}>
      <DashboardLayout navigation={navigation} title={title}>
        {children}
      </DashboardLayout>
    </AuthGuard>
  )
}
