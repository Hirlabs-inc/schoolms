"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getItems } from "@/lib/api"
import type { Course, Student, InstitutionSettings } from "@/lib/types"
import { BookOpen, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useUser } from "@/contexts/user-context"

export default function TeacherCoursesPage() {
  const { user } = useUser()
  const [courses, setCourses] = useState<(Course & { students?: any[] })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currency, setCurrency] = useState("KES")

  useEffect(() => { if (user) loadData() }, [user])

  const loadData = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const [allCourses, allStudents, allFees, settings] = await Promise.all([
        getItems<Course>("courses"),
        getItems<Student>("students"),
        getItems<Fee>("fees"),
        getItems<InstitutionSettings>("institutionSettings"),
      ])
      if (settings.length > 0) setCurrency(settings[0].currency || "KES")
      const myCourses = allCourses.filter(c => c.teacherId === user.id)
      const enriched = myCourses.map(c => ({
        ...c,
        students: allStudents.filter((s: any) => s.courseId === c.id),
      }))
      setCourses(enriched)
    } catch (error) {
      console.error("Failed to load courses", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">No courses assigned to you.</CardContent>
          </Card>
        ) : (
          courses.map((course) => (
            <Card key={course.id} className="mb-4">
              <CardHeader>
                <CardTitle>{course.name} <Badge variant="outline" className="ml-2">{course.code}</Badge></CardTitle>
                <CardDescription>Duration: {course.duration || "N/A"} | Fee: {currency} {Number(course.fee || 0).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent>
                <h4 className="text-sm font-medium mb-2">Enrolled Students ({course.students?.length || 0})</h4>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {course.students?.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No students enrolled</TableCell></TableRow>
                    ) : (
                      course.students?.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                          <TableCell>{s.email}</TableCell>
                          <TableCell>{s.phone || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
  </>
  )
}
