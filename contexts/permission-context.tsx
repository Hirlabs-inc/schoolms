"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useUser } from "@/contexts/user-context"
import { getStoredToken } from "@/lib/auth-client"
import type { UserRole } from "@/lib/types"

/**
 * Client-side permission cache.
 *
 * Mirrors the server-side `hasPermission` logic from `lib/permissions.ts`
 * but runs entirely on the client, fetching the current user's role-permission
 * grants from `/api/admin/permissions/{role}`.
 */

export type PermissionKey = string

interface PermissionContextType {
  hasPermission: (permission: PermissionKey) => boolean
  hasAnyPermission: (permissions: PermissionKey[]) => boolean
  hasAllPermissions: (permissions: PermissionKey[]) => boolean
  isLoading: boolean
  refreshPermissions: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

// Permission keys used by the navigation / feature areas.
const PERMISSION_KEYS = [
  "view_dashboard",
  "view_students",
  "add_students",
  "delete_students",
  "view_courses",
  "add_courses",
  "delete_courses",
  "view_teachers",
  "add_teachers",
  "delete_teachers",
  "view_fees",
  "manage_fees",
  "view_expenses",
  "add_expenses",
  "view_income",
  "add_income",
  "view_payroll",
  "manage_payroll",
  "view_reports",
  "manage_users",
  "manage_permissions",
  "view_backup",
  "manage_settings",
  "view_attendance",
] as const

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser()
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  const fetchPermissions = async (role: UserRole) => {
    try {
      const token = getStoredToken()
      const res = await fetch(`/api/admin/permissions/${role}`, {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      })
      if (!res.ok) throw new Error("Failed to fetch permissions")
      const data = await res.json() as {
        permissions: Array<{ permission: string; granted: boolean }>
      }
      const granted = new Set(
        data.permissions
          .filter((p) => p.granted)
          .map((p) => p.permission as PermissionKey)
      )
      setPermissions(granted)
    } catch {
      // On error, fall back to defaults — ADMIN gets everything, others get nothing
      // extra beyond what the API returns.
      if (user?.role === "ADMIN" || user?.role === "MANAGER") {
        setPermissions(new Set(PERMISSION_KEYS))
      } else {
        setPermissions(new Set())
      }
    } finally {
      setIsLoading(false)
    }
  }

  const refreshPermissions = async () => {
    if (user) {
      setIsLoading(true)
      await fetchPermissions(user.role)
    }
  }

  useEffect(() => {
    if (isUserLoading) return
    if (!user) {
      setPermissions(new Set())
      setIsLoading(false)
      return
    }
    void fetchPermissions(user.role)
  }, [user, isUserLoading])

  const value: PermissionContextType = {
    hasPermission: (permission: PermissionKey) => permissions.has(permission),
    hasAnyPermission: (perms: PermissionKey[]) => perms.some((p) => permissions.has(p)),
    hasAllPermissions: (perms: PermissionKey[]) => perms.every((p) => permissions.has(p)),
    isLoading,
    refreshPermissions,
  }

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}

export function usePermissions() {
  const context = useContext(PermissionContext)
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionProvider")
  }
  return context
}
