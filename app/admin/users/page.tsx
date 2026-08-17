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
import { getItems, deleteItem, createUser, generateStudentNumber, updateItem, addItem, deleteStudent } from "@/lib/api"
import { AuthGuard } from "@/components/auth-guard"
import type { User, UserRole, Student, Teacher, Class } from "@/lib/types"
import { Users, Plus, Trash2, Download, Loader2, Pencil } from "lucide-react"
import { useEffect, useState } from "react"

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "ADMIN" as UserRole,
    studentNumber: "",
    enrollmentYear: new Date().getFullYear(),
    classId: "",
    academicYear: 1,
    parentPhone: "",
    staffId: "",
    department: "",
    specialization: "",
    createLoginAccount: true,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [usersData, classesData] = await Promise.all([
        getItems<User>("users"),
        getItems<Class>("classes")
      ])
      setUsers(usersData)
      setClasses(classesData)
    } catch (error) {
      console.error("Failed to load data", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async (user: User) => {
    setEditingUser(user)

    // Fetch additional data based on role
    let additionalData: any = {}

    if (user.role === "STUDENT") {
      const students = await getItems<Student>("students")
      const student = students.find(s => s.id === user.id)
      if (student) {
        additionalData = {
          studentNumber: student.studentNumber,
          classId: student.classId,
          academicYear: student.academicYear,
          parentPhone: student.parentPhone || "",
        }
      }
    } else if (user.role === "TEACHER") {
      const teachers = await getItems<Teacher>("teachers")
      const teacher = teachers.find(t => t.id === user.id)
      if (teacher) {
        additionalData = {
          staffId: teacher.staffId,
          department: teacher.department,
          specialization: teacher.specialization,
        }
      }
    }

    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: "", // Don't populate password for security
      role: user.role,
      enrollmentYear: new Date().getFullYear(),
      ...additionalData,
      classId: additionalData.classId || "",
      academicYear: additionalData.academicYear || 1,
      studentNumber: additionalData.studentNumber || "",
      parentPhone: additionalData.parentPhone || "",
      staffId: additionalData.staffId || "",
      department: additionalData.department || "",
      specialization: additionalData.specialization || "",
      createLoginAccount: true,
    })
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (editingUser) {
        // Update existing user
        console.log("Updating user profile:", editingUser.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
        })

        try {
          await updateItem("users", editingUser.id, {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
          })
          console.log("Profile updated successfully")
        } catch (profileError: any) {
          console.error("Failed to update profile:", profileError)
          throw new Error(`Failed to update profile: ${profileError.message || profileError}`)
        }

        // Update role-specific data
        if (formData.role === "STUDENT") {
          console.log("Updating student data:", editingUser.id, {
            classId: formData.classId,
            academicYear: formData.academicYear,
            parentPhone: formData.parentPhone,
          })

          try {
            // First check if student record exists
            const students = await getItems<Student>("students")
            const studentExists = students.some(s => s.id === editingUser.id)

            if (studentExists) {
              await updateItem("students", editingUser.id, {
                classId: formData.classId,
                academicYear: formData.academicYear,
                parentPhone: formData.parentPhone,
              })
              console.log("Student data updated successfully")
            } else {
              // Create student record if it doesn't exist
              console.log("Student record doesn't exist, creating it...")
              await addItem("students", {
                id: editingUser.id,
                studentNumber: generateStudentNumber(),
                enrollmentYear: new Date().getFullYear(),
                classId: formData.classId,
                academicYear: formData.academicYear,
                parentPhone: formData.parentPhone,
              })
              console.log("Student record created successfully")
            }
          } catch (studentError: any) {
            console.error("Failed to update student data:", studentError)
            throw new Error(`Failed to update student data: ${studentError.message || studentError}`)
          }
        } else if (formData.role === "TEACHER") {
          console.log("Updating teacher data:", editingUser.id, {
            staffId: formData.staffId,
            department: formData.department,
            specialization: formData.specialization,
          })

          try {
            // First check if teacher record exists
            const teachers = await getItems<Teacher>("teachers")
            const teacherExists = teachers.some(t => t.id === editingUser.id)

            if (teacherExists) {
              await updateItem("teachers", editingUser.id, {
                staffId: formData.staffId,
                department: formData.department,
                specialization: formData.specialization,
              })
              console.log("Teacher data updated successfully")
            } else {
              // Create teacher record if it doesn't exist
              console.log("Teacher record doesn't exist, creating it...")
              await addItem("teachers", {
                id: editingUser.id,
                staffId: formData.staffId,
                department: formData.department,
                specialization: formData.specialization,
              })
              console.log("Teacher record created successfully")
            }
          } catch (teacherError: any) {
            console.error("Failed to update teacher data:", teacherError)
            throw new Error(`Failed to update teacher data: ${teacherError.message || teacherError}`)
          }
        }

        alert("User updated successfully!")
      } else {
        // Create new user
        const newUser = { ...formData }
        if (newUser.role === "STUDENT") {
          newUser.studentNumber = generateStudentNumber()
        }

        await createUser(newUser)
        alert("User created successfully!")
      }

      setIsDialogOpen(false)
      setEditingUser(null)
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        role: "ADMIN",
        studentNumber: "",
        enrollmentYear: new Date().getFullYear(),
        classId: "",
        academicYear: 1,
        parentPhone: "",
        staffId: "",
        department: "",
        specialization: "",
        createLoginAccount: true,
      })
      loadData()
    } catch (error: any) {
      console.error(editingUser ? "Failed to update user" : "Failed to create user", error)
      const errorMessage = error.message || (editingUser ? "Failed to update user. Please make sure you've run the RLS policy migration (fix_rls_policies.sql)" : "Failed to create user")
      alert(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    const user = users.find(u => u.id === id)
    const isStudent = user?.role === "STUDENT"
    const confirmMsg = isStudent
      ? "Delete this student? This will remove ALL their records — fees, attendance, exam results, enrollments. This cannot be undone."
      : "Are you sure you want to delete this user?"
    if (confirm(confirmMsg)) {
      try {
        if (isStudent) {
          await deleteStudent(id)
        } else {
          await deleteItem("users", id)
        }
        loadData()
      } catch (error) {
        console.error("Failed to delete user", error)
        alert("Failed to delete user: " + (error instanceof Error ? error.message : "Unknown error"))
      }
    }
  }

  const handleExport = () => {
    // For export, we might need more details (like student class name).
    // Currently 'users' state only has profile data.
    // We'd need to fetch full student/teacher details or join them.
    // For now, let's export what we have in the table.

    const data = users.map(user => ({
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
    const rows = data.map(row => Object.values(row).join(","))
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "users_export.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <AuthGuard allowedRoles={["ADMIN", "MANAGER"]}>
    <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>Manage system users and their roles</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open)
                  if (!open) {
                    setEditingUser(null)
                    setFormData({
                      firstName: "",
                      lastName: "",
                      email: "",
                      password: "",
                      role: "ADMIN",
                      studentNumber: "",
                      enrollmentYear: new Date().getFullYear(),
                      classId: "",
                      academicYear: 1,
                      parentPhone: "",
                      staffId: "",
                      department: "",
                      specialization: "",
                      createLoginAccount: true,
                    })
                  }
                }}>
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
                          {editingUser ? "Update user information" : "Create a new user account"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="role">Role</Label>
                            <Select
                            value={formData.role}
                            onValueChange={(value: UserRole) => setFormData({
                              ...formData, role: value,
                              studentNumber: "", classId: "", academicYear: 1, parentPhone: "",
                              staffId: "", department: "", specialization: "",
                            })}
                            disabled={!!editingUser}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ADMIN">Admin</SelectItem>
                              <SelectItem value="TEACHER">Teacher</SelectItem>
                              <SelectItem value="SECRETARY">Secretary</SelectItem>
                              <SelectItem value="MANAGER">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                          {editingUser && (
                            <p className="text-xs text-muted-foreground">Role cannot be changed after creation</p>
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
                          <Label htmlFor="password">{editingUser ? "New Password (leave blank to keep current)" : "Password"}</Label>
                          <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required={!editingUser}
                            placeholder={editingUser ? "Leave blank to keep current password" : ""}
                          />
                        </div>

                        {formData.role === "STUDENT" && (
                          <>
                            {/* Student Number is auto-generated */}
                            <div className="grid gap-2">
                              <Label htmlFor="academicYear">Grade Level</Label>
                              <Select
                                value={formData.academicYear.toString()}
                                onValueChange={(value) =>
                                  setFormData({ ...formData, academicYear: Number.parseInt(value), classId: "" })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
                                    <SelectItem key={grade} value={grade.toString()}>
                                      Grade {grade}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="classId">Class</Label>
                              <Select
                                value={formData.classId}
                                onValueChange={(value) => setFormData({ ...formData, classId: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a class" />
                                </SelectTrigger>
                                <SelectContent>
                                  {classes
                                    .filter((cls) => cls.gradeLevel === formData.academicYear)
                                    .map((cls) => (
                                      <SelectItem key={cls.id} value={cls.id}>
                                        {cls.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="parentPhone">Parent Phone Number</Label>
                              <Input
                                id="parentPhone"
                                type="tel"
                                value={formData.parentPhone}
                                onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                                placeholder="+252 XX XXX XXXX"
                                required
                              />
                            </div>
                          </>
                        )}

                        {formData.role === "TEACHER" && (
                          <>
                            <div className="grid gap-2">
                              <Label htmlFor="staffId">Staff ID</Label>
                              <Input
                                id="staffId"
                                value={formData.staffId}
                                onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                                placeholder="e.g., TCH001"
                                required
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="department">Department</Label>
                              <Input
                                id="department"
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                placeholder="e.g., Science"
                                required
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="specialization">Specialization</Label>
                              <Input
                                id="specialization"
                                value={formData.specialization}
                                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                placeholder="e.g., Mathematics & Physics"
                                required
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
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </AuthGuard>
  )
}
