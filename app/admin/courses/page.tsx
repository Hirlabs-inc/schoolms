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
import { getItems, getItemsSafe, addItem, updateItem, deleteItem, getCourseTeachers, assignTeacherToCourse, removeTeacherFromCourse } from "@/lib/api"
import type { Course, Student, Fee, InstitutionSettings, Teacher, EnrollmentProgress } from "@/lib/types"
import { Plus, Trash2, Pencil, Search, Filter, Loader2, AlertTriangle, Users, Eye } from "lucide-react"
import { useEffect, useState } from "react"
import { usePagination } from "@/hooks/use-pagination"
import { DataPagination } from "@/components/data-pagination"

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentProgress[]>([])
  const [courseTeachersMap, setCourseTeachersMap] = useState<Record<string, string[]>>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [viewingCourse, setViewingCourse] = useState<Course | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    code: "",
    fee: "",
    duration: "",
    teacherIds: [] as string[],
  })

  const [currency, setCurrency] = useState("KES")

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Courses are the page's primary data; the rest are secondary lookups that
      // must not blank the page when the role lacks a permission (e.g. a
      // secretary has view_courses but not view_teachers).
      const [data, settings, teachersData, studentsData, enrollmentData] = await Promise.all([
        getItems<Course>("courses"),
        getItemsSafe<InstitutionSettings>("institutionSettings"),
        getItemsSafe<Teacher>("teachers"),
        getItemsSafe<Student>("students"),
        getItemsSafe<EnrollmentProgress>("enrollmentProgress"),
      ])
      setCourses(data)
      setTeachers(teachersData)
      setStudents(studentsData)
      setEnrollments(enrollmentData)
      if (settings.length > 0 && settings[0].currency) {
        setCurrency(settings[0].currency)
      }
      // Load assigned teachers per course (non-fatal if it fails)
      const map: Record<string, string[]> = {}
      await Promise.all(
        data.map(async (c) => {
          try {
            map[c.id] = await getCourseTeachers(c.id)
          } catch {
            map[c.id] = []
          }
        })
      )
      setCourseTeachersMap(map)
    } catch (error) {
      console.error("Failed to load courses", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = () => {
    setIsEditing(false)
    setFormData({ id: "", name: "", code: "", fee: "", duration: "", teacherIds: [] })
    setIsDialogOpen(true)
  }

  const handleEdit = (course: Course) => {
    setIsEditing(true)
    setFormData({
      id: course.id,
      name: course.name,
      code: course.code,
      fee: course.fee?.toString() || "",
      duration: course.duration || "",
      teacherIds: courseTeachersMap[course.id] || [],
    })
    setIsDialogOpen(true)
  }

  const handleView = (course: Course) => {
    setViewingCourse(course)
    setIsViewDialogOpen(true)
  }

  /** Students enrolled in a course via enrollment records (plus the legacy primary courseId). */
  const enrolledStudentsForCourse = (courseId: string): Student[] => {
    const ids = new Set<string>()
    for (const e of enrollments) if (e.courseId === courseId) ids.add(e.studentId)
    for (const s of students) if (s.courseId === courseId) ids.add(s.id)
    return students.filter((s) => ids.has(s.id))
  }

  const toggleTeacher = (teacherId: string) => {
    setFormData((f) => ({
      ...f,
      teacherIds: f.teacherIds.includes(teacherId)
        ? f.teacherIds.filter((t) => t !== teacherId)
        : [...f.teacherIds, teacherId],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const data = {
        name: formData.name,
        code: formData.code.toUpperCase(),
        fee: formData.fee ? Number.parseFloat(formData.fee) : null,
        duration: formData.duration || null,
      }

      if (isEditing) {
        await updateItem("courses", formData.id, data)
        // Sync teacher assignments
        const current = courseTeachersMap[formData.id] || []
        const next = formData.teacherIds
        for (const tid of next) {
          if (!current.includes(tid)) await assignTeacherToCourse(formData.id, tid)
        }
        for (const tid of current) {
          if (!next.includes(tid)) await removeTeacherFromCourse(formData.id, tid)
        }
      } else {
        const created = await addItem("courses", data)
        const newId = (created as any).id || (created as any).data?.id
        if (newId && formData.teacherIds.length) {
          for (const tid of formData.teacherIds) await assignTeacherToCourse(newId, tid)
        }
      }

      setIsDialogOpen(false)
      loadData()
    } catch (error: any) {
      alert(error.message || "Failed to save course")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      // Check for dependent records
      const [allStudents, allFees] = await Promise.all([
        getItems<Student>("students"),
        getItems<Fee>("fees"),
      ])
      const linkedStudents = allStudents.filter((s: any) => s.courseId === id)
      const linkedFees = allFees.filter(f => f.courseId === id)
      const totalLinked = linkedStudents.length + linkedFees.length

      let msg = "Delete this course?"
      if (totalLinked > 0) {
        msg += `\n\nThis will also unlink:`
        if (linkedStudents.length) msg += `\n- ${linkedStudents.length} student(s)`
        if (linkedFees.length) msg += `\n- ${linkedFees.length} fee record(s)`
      }
      if (!confirm(msg)) return

      // Unlink dependent records
      for (const s of linkedStudents) {
        await updateItem("students", (s as any).id, { courseId: null })
      }
      for (const f of linkedFees) {
        await deleteItem("fees", f.id)
      }

      await deleteItem("courses", id)
      loadData()
    } catch (error: any) {
      alert(error?.message || "Failed to delete course")
    }
  }

  const filteredCourses = courses.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const coursesPag = usePagination(filteredCourses, 10)

  return (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Courses</CardTitle>
                <CardDescription>Manage training courses, fees, and duration</CardDescription>
              </div>
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Course
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="relative mb-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or code..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Fee ({currency})</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Teachers</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coursesPag.total === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                          No courses found
                        </TableCell>
                      </TableRow>
                    ) : (
                      coursesPag.pageItems.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell className="font-medium">
                            <button type="button" className="text-left hover:underline" onClick={() => handleView(course)}>
                              {course.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{course.code}</Badge>
                          </TableCell>
                          <TableCell>
                            {course.fee ? (
                              <span className="font-medium">{currency} {Number(course.fee).toLocaleString()}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{course.duration || "-"}</TableCell>
                          <TableCell>
                            {(() => {
                              const ids = courseTeachersMap[course.id] || []
                              if (!ids.length) return <span className="text-muted-foreground">-</span>
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {ids.slice(0, 2).map((tid) => {
                                    const t = teachers.find((x) => x.id === tid)
                                    return (
                                      <Badge key={tid} variant="secondary" className="text-xs">
                                        {t ? `${t.firstName} ${t.lastName}` : tid.slice(0, 6)}
                                      </Badge>
                                    )
                                  })}
                                  {ids.length > 2 && <Badge variant="secondary" className="text-xs">+{ids.length - 2}</Badge>}
                                </div>
                              )
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleView(course)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(course)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(course.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <DataPagination page={coursesPag.page} pageCount={coursesPag.pageCount} total={coursesPag.total} pageSize={coursesPag.pageSize} onPageChange={coursesPag.setPage} />
              </>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Course" : "Add Course"}</DialogTitle>
                    <DialogDescription>
                      {isEditing ? "Update course information" : "Add a new training course"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Course Name</Label>
                      <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="code">Course Code</Label>
                      <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. WD-101" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="fee">Course Fee ({currency})</Label>
                      <Input id="fee" type="number" value={formData.fee} onChange={(e) => setFormData({ ...formData, fee: e.target.value })} placeholder="e.g. 25000" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="duration">Duration</Label>
                      <Input id="duration" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} placeholder="e.g. 3 months" />
                    </div>
                    <div className="grid gap-2">
                      <Label className="flex items-center gap-1"><Users className="h-4 w-4" /> Assigned Teachers (each earns per-student commission)</Label>
                      {teachers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No teachers available. Add teachers first.</p>
                      ) : (
                        <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                          {teachers.map((t) => {
                            const checked = formData.teacherIds.includes(t.id)
                            return (
                              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleTeacher(t.id)}
                                  className="h-4 w-4 accent-primary"
                                />
                                <span>{t.firstName} {t.lastName}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEditing ? "Update" : "Add Course"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{viewingCourse?.name}</DialogTitle>
                  <DialogDescription>
                    {viewingCourse && (
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono">{viewingCourse.code}</Badge>
                        {viewingCourse.duration && <span>{viewingCourse.duration}</span>}
                        {viewingCourse.fee ? <span>{currency} {Number(viewingCourse.fee).toLocaleString()}</span> : null}
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                {viewingCourse && (() => {
                  const enrolled = enrolledStudentsForCourse(viewingCourse.id)
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {enrolled.length} enrolled student(s)
                      </div>
                      {enrolled.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No students enrolled yet.</p>
                      ) : (
                        <div className="max-h-80 overflow-y-auto rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Admission No.</TableHead>
                                <TableHead>Student</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {enrolled.map((s) => {
                                const enr = enrollments.find((e) => e.studentId === s.id && e.courseId === viewingCourse.id)
                                return (
                                  <TableRow key={s.id}>
                                    <TableCell className="font-mono text-xs">{s.studentNumber || "—"}</TableCell>
                                    <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                                    <TableCell>{s.phone || s.parentPhone || "-"}</TableCell>
                                    <TableCell>
                                      {enr ? (
                                        <div className="flex items-center gap-2">
                                          <Progress value={enr.progressPercent} className="h-2 w-16" />
                                          <span className="text-xs">{enr.progressPercent}%</span>
                                        </div>
                                      ) : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell>
                                      {enr ? (
                                        <Badge variant={enr.status === "COMPLETED" ? "default" : enr.status === "DROPPED" ? "destructive" : "secondary"}>
                                          {enr.status.replace("_", " ")}
                                        </Badge>
                                      ) : "—"}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
  )
}
