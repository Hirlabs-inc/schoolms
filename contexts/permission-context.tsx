"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { useUser } from "./user-context"
import { getStoredToken } from "@/lib/auth-client"

export type PermissionKey =
  | "view_dashboard"
  | "view_students"
  | "add_students"
  | "delete_students"
  | "view_courses"
  | "add_courses"
  | "delete_courses"
  | "view_teachers"
  | "add_teachers"
  | "delete_teachers"
  | "view_fees"
  | "manage_fees"
  | "view_expenses"
  | "add_expenses"
  | "view_income"
  | "add_income"
  | "view_payroll"
  | "manage_payroll"
  | "view_reports"
  | "manage_users"
  | "view_backup"
  | "manage_settings"
  | "manage_permissions"
  | "view_exams"
  | "add_exams"
  | "view_results"
  | "add_results"

interface PermissionContextType {
  permissions: Set<string>
  isLoading: boolean
  hasPermission: (permission: PermissionKey | string) => boolean
  hasAnyPermission: (permissions: Array<PermissionKey | string>) => boolean
  hasAllPermissions: (permissions: Array<PermissionKey | string>) => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const [permissions, setPermissions] = useState<Set<string>>(() => {
    if (typeof window === "undefined" || !user) return new Set()
    if (user.role === "ADMIN") {
      return new Set([
        "view_dashboard", "view_students", "add_students", "delete_students",
        "view_courses", "add_courses", "delete_courses",
        "view_teachers", "add_teachers", "delete_teachers",
        "view_fees", "manage_fees", "view_expenses", "add_expenses",
        "view_income", "add_income", "view_payroll", "manage_payroll",
        "view_reports", "manage_users", "view_backup", "manage_settings",
        "manage_permissions", "view_exams", "add_exams", "view_results", "add_results",
      ])
    }
    return new Set()
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const loadPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(new Set())
      setIsLoading(false)
      return
    }

    if (user.role === "ADMIN") {
      setPermissions(new Set([
        "view_dashboard", "view_students", "add_students", "delete_students",
        "view_courses", "add_courses", "delete_courses",
        "view_teachers", "add_teachers", "delete_teachers",
        "view_fees", "manage_fees", "view_expenses", "add_expenses",
        "view_income", "add_income", "view_payroll", "manage_payroll",
        "view_reports", "manage_users", "view_backup", "manage_settings",
        "manage_permissions", "view_exams", "add_exams", "view_results", "add_results",
      ]))
      setIsLoading(false)
      return
    }

    try {
      const token = getStoredToken()
      const res = await fetch("/api/permissions/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = (await res.json()) as { role: string; permissions: string[] }
        setPermissions(new Set(data.permissions))
      } else {
        setPermissions(new Set())
      }
    } catch {
      setPermissions(new Set())
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const hasPermission = useCallback(
    (permission: PermissionKey | string): boolean => {
      if (!user) return false
      if (user.role === "ADMIN") return true
      return permissions.has(permission)
    },
    [user, permissions]
  )

  const hasAnyPermission = useCallback(
    (perms: Array<PermissionKey | string>): boolean => {
      if (!user) return false
      if (user.role === "ADMIN") return true
      return perms.some((p) => permissions.has(p))
    },
    [user, permissions]
  )

  const hasAllPermissions = useCallback(
    (perms: Array<PermissionKey | string>): boolean => {
      if (!user) return false
      if (user.role === "ADMIN") return true
      return perms.every((p) => permissions.has(p))
    },
    [user, permissions]
  )

  const value = useMemo(
    () => ({
      permissions,
      isLoading,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      refreshPermissions: loadPermissions,
    }),
    [permissions, isLoading, hasPermission, hasAnyPermission, hasAllPermissions, loadPermissions]
  )

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export function usePermissions() {
  const context = useContext(PermissionContext)
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionProvider")
  }
  return context
}
