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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getItems, addItem, updateItem, deleteItem, registerStudent, computeCommissionForEnrollment, deleteStudent } from "@/lib/api"
import type { Student, Course, Fee, EnrollmentProgress } from "@/lib/types"
import { Users, BookOpen, DollarSign, CreditCard, Plus, Trash2, Pencil, Search, TrendingUp, Wallet, BarChart3, Loader2, Eye } from "lucide-react"
import { useEffect, useState } from "react"

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [feesMap, setFeesMap] = useState<Record<string, Fee>>({})
  const [enrollments, setEnrollments] = useState<EnrollmentProgress[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([])
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    gender: "",
    courseId: "",
    admissionDate: "",
    expectedCompletionDate: "",
    status: "ACTIVE" as string,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [studentsData, coursesData, feesData, enrollmentData] = await Promise.all([
        getItems<Student>("students"),
        getItems<Course>("courses"),
        getItems<Fee>("fees"),
        getItems<EnrollmentProgress>("enrollmentProgress"),
      ])
      setStudents(studentsData)
      setCourses(coursesData)
      setEnrollments(enrollmentData)
      const feesMap: Record<string, Fee> = {}
      for (const f of feesData) {
        feesMap[f.studentId] = f
      }
      setFeesMap(feesMap)
    } catch (error) {
      console.error("Failed to load data", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (student: Student) => {
    setEditingStudent(student)
    const studentEnrollments = enrollments.filter(e => e.studentId === student.id)
    const enrolledCourseIds = studentEnrollments.map(e => e.courseId)
    setSelectedCourseIds(enrolledCourseIds.length > 0 ? enrolledCourseIds : (student.courseId ? [student.courseId] : []))
    setFormData({
      firstName: student.firstName || "",
      lastName: student.lastName || "",
      email: student.email || "",
      phone: student.phone || student.parentPhone || "",
      gender: student.gender || "",
      courseId: enrolledCourseIds[0] || student.courseId || "",
      admissionDate: student.admissionDate || "",
      expectedCompletionDate: student.expectedCompletionDate || "",
      status: student.status || "ACTIVE",
    })
    setIsDialogOpen(true)
  }

  const handleView = (student: Student) => {
    setSelectedStudent(student)
    setIsViewDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (selectedCourseIds.length === 0) {
      alert("Please select at least one course")
      setIsSubmitting(false)
      return
    }

    try {
      const primaryCourseId = selectedCourseIds[0]
      const studentData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        gender: formData.gender,
        courseId: primaryCourseId,
        admissionDate: formData.admissionDate,
        expectedCompletionDate: formData.expectedCompletionDate,
        status: formData.status,
      }

      let studentId = editingStudent?.id

      if (editingStudent) {
        // Students are linked to `profiles` (only if they have a login); update name/email there.
        await updateItem("profiles", editingStudent.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
        })
        await updateItem("students", editingStudent.id, studentData)
        // Recreate enrollment records for all selected courses.
        const oldEnrollments = enrollments.filter((en) => en.studentId === editingStudent!.id)
        for (const en of oldEnrollments) {
          await deleteItem("enrollmentProgress", en.id)
        }
        for (const courseId of selectedCourseIds) {
          await addItem("enrollmentProgress", {
            studentId,
            courseId,
            progressPercent: 0,
            status: "ENROLLED",
            startDate: formData.admissionDate || null,
            notes: null,
          })
          try {
            await computeCommissionForEnrollment(studentId, courseId)
          } catch (err) {
            const m = (err as Error)?.message || ""
            if (!m.includes("Commission configuration")) throw err
          }
        }
        alert("Student updated successfully!")
      } else {
        const result = await registerStudent({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          ...studentData,
        }) as { success: boolean; userId: string }
        studentId = result?.userId

        // Enroll in every selected course + compute per-teacher commission.
        for (const courseId of selectedCourseIds) {
          await addItem("enrollmentProgress", {
            studentId,
            courseId,
            progressPercent: 0,
            status: "ENROLLED",
            startDate: formData.admissionDate || null,
            notes: null,
          })
          try {
            await computeCommissionForEnrollment(studentId, courseId)
          } catch (err) {
            const m = (err as Error)?.message || ""
            if (!m.includes("Commission configuration")) throw err
          }
        }
        alert("Student created successfully!")
      }

      setIsDialogOpen(false)
      setEditingStudent(null)
      setSelectedCourseIds([])
      setFormData({
        firstName: "", lastName: "", email: "",
        phone: "", gender: "", courseId: "", admissionDate: "",
        expectedCompletionDate: "", status: "ACTIVE",
      })
      loadData()
    } catch (error: any) {
      alert(error.message || "Failed to save student")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this student? This will remove all their records (fees, attendance, exam results, enrollments).")) {
      try {
        await deleteStudent(id)
        loadData()
      } catch (error) {
        console.error("Failed to delete student", error)
        alert("Failed to delete student")
      }
    }
  }

  const getCourseName = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId)
    return course ? course.name : "N/A"
  }

  const statusColor = (status?: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-700"
      case "COMPLETED": return "bg-blue-100 text-blue-700"
      case "DROPPED": return "bg-red-100 text-red-700"
      default: return "bg-gray-100 text-gray-700"
    }
  }

  const filteredStudents = students.filter((s) => {
    const name = `${s.firstName} ${s.lastName}`.toLowerCase()
    return name.includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.phone?.includes(searchTerm)
  })

  return (
    <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Students</CardTitle>
                <CardDescription>Manage student registrations</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open)
                if (!open) {
                  setEditingStudent(null)
                  setSelectedCourseIds([])
                  setFormData({
                    firstName: "", lastName: "", email: "",
                    phone: "", gender: "", courseId: "", admissionDate: "",
                    expectedCompletionDate: "", status: "ACTIVE",
                  })
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>{editingStudent ? "Edit Student" : "Register New Student"}</DialogTitle>
                      <DialogDescription>
                        {editingStudent ? "Update student information" : "Register a new student in the system"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="email">Email (Optional)</Label>
                        <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+254 XXX XXX XXX" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Courses Enrolled</Label>
                        <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                          {courses.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No courses available</p>
                          ) : (
                            courses.map((c) => {
                              const isChecked = selectedCourseIds.includes(c.id)
                              return (
                                <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded p-1">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedCourseIds(selectedCourseIds.filter(id => id !== c.id))
                                      } else {
                                        setSelectedCourseIds([...selectedCourseIds, c.id])
                                      }
                                    }}
                                  />
                                  <span className="text-sm flex-1">{c.name} ({c.code})</span>
                                  <span className="text-xs text-muted-foreground">{c.duration || ""}</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                        {selectedCourseIds.length > 0 && (
                          <p className="text-xs text-muted-foreground">{selectedCourseIds.length} course(s) selected</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="admissionDate">Admission Date</Label>
                          <Input id="admissionDate" type="date" value={formData.admissionDate} onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="expectedCompletionDate">Expected Completion</Label>
                          <Input id="expectedCompletionDate" type="date" value={formData.expectedCompletionDate} onChange={(e) => setFormData({ ...formData, expectedCompletionDate: e.target.value })} />
                        </div>
                      </div>
                      {editingStudent && (
                        <div className="grid gap-2">
                          <Label htmlFor="status">Status</Label>
                          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ACTIVE">Active</SelectItem>
                              <SelectItem value="COMPLETED">Completed</SelectItem>
                              <SelectItem value="DROPPED">Dropped</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingStudent ? "Update Student" : "Register Student"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No students found</TableCell>
                    </TableRow>
                  ) : (
                      filteredStudents.map((s) => {
                        const fee = feesMap[s.id]
                        const balance = fee ? Number(fee.balance) : 0
                        const totalFee = fee ? Number(fee.totalFee) : 0
                        return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                        <TableCell>{s.phone || s.parentPhone || "-"}</TableCell>
                        <TableCell>{getCourseName(s.courseId || "")}</TableCell>
                        <TableCell>
                          {fee ? (
                            <span className={`font-medium ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                              KSh {balance.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No fee set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColor(s.status)}`}>
                            {s.status || "ACTIVE"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleView(s)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      )})
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Student Profile</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Full Name</Label>
                    <p className="font-medium">{selectedStudent.firstName} {selectedStudent.lastName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p className="font-medium">{selectedStudent.email || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Phone</Label>
                    <p className="font-medium">{selectedStudent.phone || selectedStudent.parentPhone || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Gender</Label>
                    <p className="font-medium">{selectedStudent.gender || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Admission Date</Label>
                    <p className="font-medium">{selectedStudent.admissionDate || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Expected Completion</Label>
                    <p className="font-medium">{selectedStudent.expectedCompletionDate || "-"}</p>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <Label className="text-muted-foreground text-xs mb-2 block">Enrollments ({enrollments.filter(e => e.studentId === selectedStudent.id).length} courses)</Label>
                  {(() => {
                    const studentEnrollments = enrollments.filter(e => e.studentId === selectedStudent.id)
                    if (studentEnrollments.length === 0) {
                      return <p className="text-sm text-muted-foreground">No course enrollments recorded</p>
                    }
                    return (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Course</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentEnrollments.map(enr => (
                            <TableRow key={enr.id}>
                              <TableCell className="font-medium">{enr.courseName || getCourseName(enr.courseId)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={enr.progressPercent} className="h-2 w-20" />
                                  <span className="text-xs">{enr.progressPercent}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={enr.status === "COMPLETED" ? "default" : enr.status === "DROPPED" ? "destructive" : "secondary"}>
                                  {enr.status.replace("_", " ")}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )
                  })()}
                </div>

                <div className="border-t pt-3">
                  <Label className="text-muted-foreground text-xs mb-2 block">Fee Summary</Label>
                  {(() => {
                    const fee = feesMap[selectedStudent.id]
                    if (!fee) return <p className="text-sm text-muted-foreground">No fee assigned</p>
                    const paid = Number(fee.totalFee) - Number(fee.balance)
                    return (
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">Total Fee</p>
                          <p className="font-bold">KSh {Number(fee.totalFee).toLocaleString()}</p>
                        </div>
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">Paid</p>
                          <p className="font-bold text-green-600">KSh {paid.toLocaleString()}</p>
                        </div>
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <p className="text-xs text-muted-foreground">Balance</p>
                          <p className="font-bold text-red-600">KSh {Number(fee.balance).toLocaleString()}</p>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
  </>
  )
}
