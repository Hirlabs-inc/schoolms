"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { usePermissions, type PermissionKey } from "@/contexts/permission-context"
import type { UserRole } from "@/lib/types"
import { Loader2 } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  permission?: PermissionKey | string
  permissions?: Array<PermissionKey | string>
  requireAll?: boolean
}

export function AuthGuard({
  children,
  allowedRoles,
  permission,
  permissions,
  requireAll = false,
}: AuthGuardProps) {
  const router = useRouter()
  const { user, isLoading: isUserLoading } = useUser()
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading: isPermsLoading } = usePermissions()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    if (isUserLoading || isPermsLoading) return

    if (!user) {
      router.push("/login")
      return
    }

    // ADMIN always has full access
    if (user.role === "ADMIN") {
      setIsAuthorized(true)
      setIsChecking(false)
      return
    }

    // Check permissions if specified
    let permissionGranted: boolean | null = null
    if (permission) {
      permissionGranted = hasPermission(permission)
    } else if (permissions && permissions.length > 0) {
      permissionGranted = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions)
    }

    // Check roles if specified
    const roleMatches = allowedRoles ? allowedRoles.includes(user.role) : null

    // Determine final authorization
    let authorized = true
    if (permissionGranted !== null && roleMatches !== null) {
      // If both are provided, either having the role or the permission grants access
      authorized = permissionGranted || roleMatches
    } else if (permissionGranted !== null) {
      authorized = permissionGranted
    } else if (roleMatches !== null) {
      authorized = roleMatches
    }

    if (!authorized) {
      router.push("/unauthorized")
      return
    }

    setIsAuthorized(true)
    setIsChecking(false)
  }, [
    user,
    isUserLoading,
    isPermsLoading,
    allowedRoles,
    permission,
    permissions,
    requireAll,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    router,
  ])

  if (isUserLoading || isPermsLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthorized) return null

  return <>{children}</>
}
