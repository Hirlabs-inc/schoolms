"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { adminCreateUser, adminDeleteUser, adminUpdateUser, getCurrentUser, getItems } from "@/lib/api"
import { AuthGuard } from "@/components/auth-guard"
import type { User, UserRole, Teacher } from "@/lib/types"
import { Plus, Trash2, Download, Loader2, Pencil } from "lucide-react"
import { useEffect, useState } from "react"

const STAFF_ROLES: UserRole[] = ["ADMIN", "TEACHER", "SECRETARY", "MANAGER"]

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "TEACHER" as UserRole,
  staffId: "",
  department: "",
  specialization: "",
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    loadData()
  }, [])

  // The users page manages STAFF accounts (ADMIN / MANAGER / SECRETARY /
  // TEACHER). Students are managed on the Students page.
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [allUsers, me] = await Promise.all([getItems<User>("users"), getCurrentUser()])
      setUsers(allUsers.filter((u) => u.role !== "STUDENT"))
      setCurrentUserId(me?.id ?? null)
      setIsAdmin(me?.role === "ADMIN")
    } catch (error) {
      console.error("Failed to load data", error)
    } finally {
      setIsLoading(false)
    }
  }

  const canManage = (user: User) => isAdmin || user.role !== "ADMIN"

  const resetForm = () => setFormData(emptyForm)

  const handleEdit = async (user: User) => {
    setEditingUser(user)

    let extra: Record<string, string> = {}
    if (user.role === "TEACHER") {
      const teachers = await getItems<Teacher>("teachers")
      const teacher = teachers.find((t) => t.id === user.id)
      if (teacher) {
        extra = {
          staffId: teacher.staffId || "",
          department: teacher.department || "",
          specialization: teacher.specialization || "",
        }
      }
    }

    setFormData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      password: "",
      role: user.role,
      staffId: extra.staffId || "",
      department: extra.department || "",
      specialization: extra.specialization || "",
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const password = formData.password
      if (password && password.length < 6) {
        throw new Error("Password must be at least 6 characters")
      }

      if (editingUser) {
        const patch: Record<string, any> = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          role: formData.role,
        }
        if (password) patch.password = password
        if (formData.role === "TEACHER") {
          patch.staffId = formData.staffId
          patch.department = formData.department
          patch.specialization = formData.specialization
        }
        await adminUpdateUser(editingUser.id, patch)
        alert("User updated successfully!")
      } else {
        if (!password) throw new Error("Password is required")
        const payload: Record<string, any> = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password,
          role: formData.role,
        }
        if (formData.role === "TEACHER") {
          payload.staffId = formData.staffId
          payload.department = formData.department
          payload.specialization = formData.specialization
        }
        await adminCreateUser(payload)
        alert("User created successfully!")
      }

      setIsDialogOpen(false)
      setEditingUser(null)
      resetForm()
      loadData()
    } catch (error: any) {
      const context = editingUser ? "update" : "create"
      console.error(`Failed to ${context} user`, error)
      alert(error.message || `Failed to ${context} user`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (user: User) => {
    const name = `${user.firstName} ${user.lastName}`.trim() || user.email
    const msg =
      user.role === "TEACHER"
        ? `Delete teacher "${name}"? This also removes their course assignments, contracts, payroll and commission records. This cannot be undone.`
        : `Are you sure you want to delete ${name} (${user.role})? This cannot be undone.`
    if (!confirm(msg)) return
    try {
      await adminDeleteUser(user.id)
      loadData()
    } catch (error: any) {
      console.error("Failed to delete user", error)
      alert(error.message || "Failed to delete user")
    }
  }

  const handleExport = () => {
    const data = users.map((user) => ({
      FirstName: user.firstName,
      LastName: user.lastName,
      Email: user.email,
      Role: user.role,
    }))
    if (data.length === 0) {
      alert("No users to export")
      return
    }
    const headers = Object.keys(data[0]).join(",")
    const rows = data.map((row) => Object.values(row).join(","))
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "users_export.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isSelf = (user: User) => user.id === currentUserId

  const editingSelf = !!editingUser && editingUser.id === currentUserId

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage staff accounts and their roles</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open)
                  if (!open) {
                    setEditingUser(null)
                    resetForm()
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
                      <DialogDescription>
                        {editingUser ? "Update staff account information" : "Create a new staff account"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={formData.role}
                          onValueChange={(value: UserRole) =>
                            setFormData({ ...formData, role: value })
                          }
                          disabled={editingSelf || (editingUser?.role === "ADMIN" && !isAdmin)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAFF_ROLES.filter((r) => r !== "ADMIN" || isAdmin).map((r) => (
                              <SelectItem key={r} value={r}>
                                {r.charAt(0) + r.slice(1).toLowerCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {editingSelf && (
                          <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
                        )}
                        {editingUser?.role === "ADMIN" && !isAdmin && (
                          <p className="text-xs text-muted-foreground">Only administrators can edit admin accounts.</p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="password">
                          {editingUser ? "New Password (leave blank to keep current)" : "Password"}
                        </Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          required={!editingUser}
                          autoComplete="new-password"
                          placeholder={editingUser ? "Leave blank to keep current" : "At least 6 characters"}
                        />
                      </div>

                      {formData.role === "TEACHER" && (
                        <>
                          <div className="grid gap-2">
                            <Label htmlFor="staffId">Staff ID</Label>
                            <Input
                              id="staffId"
                              value={formData.staffId}
                              onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                              placeholder="e.g., TCH001 (auto-generated if blank)"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="department">Department</Label>
                            <Input
                              id="department"
                              value={formData.department}
                              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                              placeholder="e.g., ICT"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="specialization">Specialization</Label>
                            <Input
                              id="specialization"
                              value={formData.specialization}
                              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                              placeholder="e.g., Web Development"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : editingUser ? (
                          "Update User"
                        ) : (
                          "Create User"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const self = isSelf(user)
                  const manageable = canManage(user)
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                        {self && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit"
                            disabled={!manageable}
                            onClick={() => handleEdit(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={self ? "You cannot delete your own account" : "Delete"}
                            disabled={self || !manageable}
                            onClick={() => handleDelete(user)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No staff accounts yet. Click &quot;Add User&quot; to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AuthGuard>
  )
}
