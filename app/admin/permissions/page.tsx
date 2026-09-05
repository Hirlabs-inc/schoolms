"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AuthGuard } from "@/components/auth-guard"
import { Shield, RefreshCw, Save, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Permission } from "@/lib/permissions"
import { ALL_PERMISSIONS } from "@/lib/permissions"
import { fetchRolePermissions, saveRolePermissions, resetRolePermissions } from "@/lib/api"

type Role = "ADMIN" | "MANAGER" | "SECRETARY" | "TEACHER" | "STUDENT"
const ROLES: Role[] = ["ADMIN", "MANAGER", "SECRETARY", "TEACHER", "STUDENT"]
const MANAGED_ROLES: Role[] = ["ADMIN", "MANAGER", "SECRETARY"]

interface PermissionRow {
  permission: string
  label: string
  group: string
  granted: boolean
}

interface RolePermissions {
  role: Role
  permissions: PermissionRow[]
}

export default function PermissionsPage() {
  const [activeRole, setActiveRole] = useState<Role>("SECRETARY")
  const [rolesData, setRolesData] = useState<Record<string, RolePermissions>>({})
  const [modified, setModified] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [saveResult, setSaveResult] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Load all roles once.
  useEffect(() => {
    loadRole(activeRole)
  }, [activeRole])

  const loadRole = async (role: Role) => {
    if (rolesData[role]) return // already loaded for this role
    setIsLoading(true)
    try {
      const data = await fetchRolePermissions(role)
      setRolesData((prev) => ({ ...prev, [role]: { role, permissions: data.permissions } }))
    } catch (e: any) {
      console.error(e)
      setSaveResult({ type: "error", text: e.message || "Failed to load permissions" })
    } finally {
      setIsLoading(false)
    }
  }

  const currentPerms = rolesData[activeRole]?.permissions ?? []

  const togglePermission = (perm: string, granted: boolean) => {
    const updated = rolesData[activeRole].permissions.map((p) =>
      p.permission === perm ? { ...p, granted } : p
    )
    setRolesData((prev) => ({
      ...prev,
      [activeRole]: { ...prev[activeRole], permissions: updated },
    }))
    setModified((prev) => ({ ...prev, [activeRole]: true }))
    setSaveResult(null)
  }

  const saveChanges = async () => {
    const perms = rolesData[activeRole]?.permissions
    if (!perms) return
    setIsSaving(true)
    setSaveResult(null)
    try {
      await saveRolePermissions(activeRole, perms.map((p) => ({ permission: p.permission, granted: p.granted })))
      setModified((prev) => ({ ...prev, [activeRole]: false }))
      setSaveResult({ type: "success", text: `Permissions for ${activeRole} saved.` })
    } catch (e: any) {
      setSaveResult({ type: "error", text: e.message || "Save failed" })
    } finally {
      setIsSaving(false)
    }
  }

  const resetRole = async () => {
    if (!confirm(`Reset all permissions for ${activeRole} to defaults? This removes all custom overrides.`)) return
    setIsResetting(true)
    setSaveResult(null)
    try {
      await resetRolePermissions(activeRole)
      // Reload from DB.
      setRolesData((prev) => {
        const newPrev = { ...prev }
        delete newPrev[activeRole]
        return newPrev
      })
      setModified((prev) => ({ ...prev, [activeRole]: false }))
      setSaveResult({ type: "success", text: `Permissions for ${activeRole} reset to defaults.` })
      loadRole(activeRole)
    } catch (e: any) {
      setSaveResult({ type: "error", text: e.message || "Reset failed" })
    } finally {
      setIsResetting(false)
    }
  }

  const grouped = (): Record<string, PermissionRow[]> => {
    const groups: Record<string, PermissionRow[]> = {}
    for (const p of currentPerms) {
      if (!groups[p.group]) groups[p.group] = []
      groups[p.group].push(p)
    }
    return groups
  }

  const g = grouped()

  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-7 w-7" />
              Role Permissions
            </h1>
            <p className="text-muted-foreground">
              Define granular permissions for each role. Changes take effect immediately for all
              users of that role.
            </p>
          </div>

          <div className="flex gap-2">
            <Select
              value={activeRole}
              onValueChange={(v: string) => setActiveRole(v as Role)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.charAt(0) + r.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {modified[activeRole] && (
              <Button variant="outline" onClick={saveChanges} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
            )}

            <Button variant="outline" onClick={resetRole} disabled={isResetting || !!modified[activeRole]}>
              {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Reset to Defaults
            </Button>
          </div>
        </div>

        {saveResult && (
          <Alert variant={saveResult.type === "success" ? "default" : "destructive"}>
            {saveResult.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>{saveResult.type === "success" ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{saveResult.text}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {activeRole.charAt(0) + activeRole.slice(1).toLowerCase()} Permissions
              </CardTitle>
              <CardDescription>
                Toggle individual permissions. {activeRole === "ADMIN" && "Admin role has all permissions — overrides disabled."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(g).map(([groupName, perms]) => (
                  <div key={groupName}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                      {groupName}
                    </h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_auto] gap-4 py-2 text-sm font-medium">
                        <span>Permission</span>
                        <span>Granted</span>
                      </div>
                      {perms.map((p) => (
                        <div
                          key={p.permission}
                          className="grid grid-cols-[1fr_auto] gap-4 items-center py-2 border-b last:border-0"
                        >
                          <div className="space-y-1">
                            <span className="font-medium">{p.label}</span>
                            <p className="text-xs text-muted-foreground">{p.permission}</p>
                          </div>
                          <Switch
                            checked={p.granted}
                            onCheckedChange={(checked) =>
                              togglePermission(p.permission, checked)
                            }
                            disabled={activeRole === "ADMIN"}
                            aria-label={`${p.label} for ${activeRole}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthGuard>
  )
}
