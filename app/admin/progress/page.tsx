"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getItems, addItem, updateItem, deleteItem, getEnrollmentStats } from "@/lib/api"
import type { EnrollmentProgress, InstitutionSettings, Student, Course } from "@/lib/types"
import { Plus, Trash2, Loader2, Pencil, BarChart3 } from "lucide-react"
import { useEffect, useState } from "react"

const PROGRESS_STATUSES = ["ENROLLED", "IN_PROGRESS", "COMPLETED", "DROPPED"] as const

function calcAutoProgress(startDate: string, durationStr: string): number {
  if (!startDate || !durationStr) return 0
  const start = new Date(startDate)
  if (isNaN(start.getTime())) return 0

  const durationDays = parseDuration(durationStr)
  if (durationDays <= 0) return 0

  const now = new Date()
  const elapsedDays = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.min(100, Math.round((elapsedDays / durationDays) * 100))
}

function parseDuration(duration: string): number {
  const cleaned = duration.toLowerCase().trim()
  const monthMatch = cleaned.match(/(\d+)\s*month/i)
  if (monthMatch) return Number.parseInt(monthMatch[1]) * 30
  const yearMatch = cleaned.match(/(\d+)\s*year/i)
  if (yearMatch) return Number.parseInt(yearMatch[1]) * 365
  const weekMatch = cleaned.match(/(\d+)\s*week/i)
  if (weekMatch) return Number.parseInt(weekMatch[1]) * 7
  const dayMatch = cleaned.match(/(\d+)\s*day/i)
  if (dayMatch) return Number.parseInt(dayMatch[1])
  return 0
}

export default function ProgressPage() {
  const [records, setRecords] = useState<EnrollmentProgress[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [stats, setStats] = useState<any>({ total: 0, byStatus: [], avgProgress: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<EnrollmentProgress | null>(null)
  const [formData, setFormData] = useState({
    studentId: "", courseId: "", progressPercent: "0", status: "ENROLLED",
    startDate: "", notes: "",
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [r, s, c, statsData] = await Promise.all([
        getItems<EnrollmentProgress>("enrollmentProgress"),
        getItems<Student>("students"),
        getItems<Course>("courses"),
        getEnrollmentStats(),
      ])
      setRecords(r)
      setStudents(s)
      setCourses(c)
      setStats(statsData)

      // Auto-update stored progress and status from course duration calculations
      for (const record of r) {
        const course = c.find(co => co.id === record.courseId)
        if (course?.duration && record.startDate && record.status !== "DROPPED") {
          const calcPct = calcAutoProgress(record.startDate, course.duration)
          const currentPct = Number(record.progressPercent)
          const shouldBeCompleted = calcPct >= 100
          const statusChanged = shouldBeCompleted && record.status !== "COMPLETED"
          if (calcPct !== currentPct || statusChanged) {
            await updateItem("enrollmentProgress", record.id, {
              progressPercent: calcPct,
              status: shouldBeCompleted ? "COMPLETED" : calcPct > 0 ? "IN_PROGRESS" : record.status,
              updatedAt: new Date().toISOString(),
            }).catch(() => {})
            // Update local record so UI reflects changes immediately
            record.progressPercent = calcPct
            if (shouldBeCompleted) record.status = "COMPLETED"
            else if (calcPct > 0 && record.status === "ENROLLED") record.status = "IN_PROGRESS"
          }
        }
      }
    } catch (error) {
      console.error("Failed to load", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const data = {
        studentId: formData.studentId, courseId: formData.courseId,
        progressPercent: Number.parseInt(formData.progressPercent),
        status: formData.status, startDate: formData.startDate || null,
        notes: formData.notes || null,
      }
      if (editingRecord) {
        await updateItem("enrollmentProgress", editingRecord.id, { ...data, updatedAt: new Date().toISOString() })
      } else {
        await addItem("enrollmentProgress", data)
      }
      setIsDialogOpen(false)
      setEditingRecord(null)
      setFormData({ studentId: "", courseId: "", progressPercent: "0", status: "ENROLLED", startDate: "", notes: "" })
      loadData()
    } catch (error: any) {
      alert(error.message || "Failed to save")
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "ENROLLED": return "secondary"
      case "IN_PROGRESS": return "default"
      case "COMPLETED": return "default"
      case "DROPPED": return "destructive"
      default: return "secondary"
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    )
  }

  return (
    <>
        {courses.filter(c => !c.duration).length > 0 && (
          <div className="mb-4 text-sm p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
            <strong>Note:</strong> {courses.filter(c => !c.duration).length} course(s) are missing a <strong>duration</strong>. Auto-progress calculation requires courses to have a duration (e.g., &quot;3 months&quot;).{' '}
            <a href="/admin/courses" className="underline font-medium">Set durations here</a>.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Enrollments</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Avg Progress</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Math.round(Number(stats.avgProgress))}%</div></CardContent></Card>
          {stats.byStatus?.map((s: any) => (
            <Card key={s.status}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{s.status.replace("_", " ")}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s.cnt}</div></CardContent></Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Course Progress Tracking</CardTitle><CardDescription>Auto-calculated from course duration &amp; enrollment date. Records are created automatically when students enroll in courses.</CardDescription></div>
              <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) { setEditingRecord(null); setFormData({ studentId: "", courseId: "", progressPercent: "0", status: "ENROLLED", startDate: "", notes: "" }) } }}>
                <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Manual Add</Button></DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSubmit}>
                    <DialogHeader><DialogTitle>{editingRecord ? "Edit Progress" : "Manual Enrollment Record"}</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Student</Label>
                        <Select value={formData.studentId} onValueChange={(v) => {
                          const student = students.find(s => s.id === v)
                          setFormData({ ...formData, studentId: v, courseId: student?.courseId || formData.courseId })
                        }}>
                          <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                          <SelectContent>
                            {students.map((s) => (<SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Course</Label>
                        <Select value={formData.courseId} onValueChange={(v) => setFormData({ ...formData, courseId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                          <SelectContent>
                            {courses.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name} ({c.code}) {c.duration ? `- ${c.duration}` : ""}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        {(() => {
                          const course = courses.find(c => c.id === formData.courseId)
                          if (course?.duration && formData.startDate) {
                            const autoPct = calcAutoProgress(formData.startDate, course.duration)
                            return (
                              <p className="text-xs text-muted-foreground">
                                Auto-calculated: {autoPct}% (based on {course.duration} from {formData.startDate})
                                <Button variant="link" size="sm" className="h-auto p-0 ml-1 text-xs" onClick={(e) => {
                                  e.preventDefault()
                                  setFormData({ ...formData, progressPercent: autoPct.toString(), status: autoPct >= 100 ? "COMPLETED" : formData.status })
                                }}>Apply</Button>
                              </p>
                            )
                          }
                          return null
                        })()}
                      </div>
                      <div className="grid gap-2">
                        <Label>Start Date</Label>
                        <Input type="date" value={formData.startDate} onChange={(e) => {
                          const date = e.target.value
                          const course = courses.find(c => c.id === formData.courseId)
                          if (course?.duration) {
                            const autoPct = calcAutoProgress(date, course.duration)
                            setFormData({ ...formData, startDate: date, progressPercent: autoPct.toString(), status: autoPct >= 100 ? "COMPLETED" : formData.status })
                          } else {
                            setFormData({ ...formData, startDate: date })
                          }
                        }} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Progress %</Label>
                        <Input type="number" min="0" max="100" value={formData.progressPercent} onChange={(e) => {
                          const val = e.target.value
                          setFormData({ ...formData, progressPercent: val, status: val === "100" ? "COMPLETED" : formData.status })
                        }} required />
                      </div>
                      <div className="grid gap-2">
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v, progressPercent: v === "COMPLETED" ? "100" : formData.progressPercent })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PROGRESS_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Notes</Label>
                        <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingRecord ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Student</TableHead><TableHead>Course</TableHead><TableHead>Progress</TableHead><TableHead>Status</TableHead><TableHead>Start Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No progress records</TableCell></TableRow>
                ) : records.map((r) => {
                  const course = courses.find(c => c.id === r.courseId)
                  const autoProgress = course?.duration && r.startDate
                    ? calcAutoProgress(r.startDate, course.duration)
                    : Number(r.progressPercent)
                  const displayProgress = autoProgress
                  return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.studentName}</TableCell>
                    <TableCell>
                      <div>{r.courseName}</div>
                      {course?.duration && <div className="text-[10px] text-muted-foreground">{course.duration} course</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={displayProgress} className="w-24" />
                        <span className="text-xs">{displayProgress}%</span>
                      </div>
                      {course?.duration && r.startDate && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {displayProgress >= 100 ? "Completed" : `${new Date(r.startDate).toLocaleDateString()} → ${course.duration}`}
                        </div>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={statusColor(r.status) as any}>{r.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell>{r.startDate || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingRecord(r)
                          setFormData({
                            studentId: r.studentId, courseId: r.courseId,
                            progressPercent: r.progressPercent.toString(),
                            status: r.status, startDate: r.startDate || "", notes: r.notes || "",
                          })
                          setIsDialogOpen(true)
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={async () => {
                          if (confirm("Delete this record?")) { await deleteItem("enrollmentProgress", r.id); loadData() }
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )})}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
  </>
  )
}
