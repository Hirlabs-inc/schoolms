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
import { getItems, addItem, updateItem, deleteItem } from "@/lib/api"
import type { Course, Student, Fee, Exam, InstitutionSettings } from "@/lib/types"
import { Plus, Trash2, Pencil, Search, Filter, Loader2, AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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
  })

  const [currency, setCurrency] = useState("KES")

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [data, settings] = await Promise.all([
        getItems<Course>("courses"),
        getItems<InstitutionSettings>("institutionSettings"),
      ])
      setCourses(data)
      if (settings.length > 0 && settings[0].currency) {
        setCurrency(settings[0].currency)
      }
    } catch (error) {
      console.error("Failed to load courses", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = () => {
    setIsEditing(false)
    setFormData({ id: "", name: "", code: "", fee: "", duration: "" })
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
    })
    setIsDialogOpen(true)
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
      } else {
        await addItem("courses", data)
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
      const [allStudents, allFees, allExams] = await Promise.all([
        getItems<Student>("students"),
        getItems<Fee>("fees"),
        getItems<Exam>("exams"),
      ])
      const linkedStudents = allStudents.filter((s: any) => s.courseId === id)
      const linkedFees = allFees.filter(f => f.courseId === id)
      const linkedExams = allExams.filter(e => e.courseId === id)
      const totalLinked = linkedStudents.length + linkedFees.length + linkedExams.length

      let msg = "Delete this course?"
      if (totalLinked > 0) {
        msg += `\n\nThis will also unlink:`
        if (linkedStudents.length) msg += `\n- ${linkedStudents.length} student(s)`
        if (linkedFees.length) msg += `\n- ${linkedFees.length} fee record(s)`
        if (linkedExams.length) msg += `\n- ${linkedExams.length} exam(s)`
      }
      if (!confirm(msg)) return

      // Unlink dependent records
      for (const s of linkedStudents) {
        await updateItem("students", (s as any).id, { courseId: null })
      }
      for (const f of linkedFees) {
        await deleteItem("fees", f.id)
      }
      for (const e of linkedExams) {
        await deleteItem("exams", e.id)
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
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                          No courses found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCourses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell className="font-medium">{course.name}</TableCell>
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
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
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
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEditing ? "Update" : "Add Course"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
  )
}
