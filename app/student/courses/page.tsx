"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getItems, getCurrentUser } from "@/lib/api"
import type { Course, InstitutionSettings } from "@/lib/types"
import { BookOpen, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

export default function StudentCoursesPage() {
  const [course, setCourse] = useState<Course | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currency, setCurrency] = useState("KES")

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const sessionUser = await getCurrentUser()
      if (sessionUser && sessionUser.role === "STUDENT") {
        const [students, courses, settingsArr] = await Promise.all([
          getItems<any>("students"),
          getItems<Course>("courses"),
          getItems<InstitutionSettings>("institutionSettings"),
        ])
        if (settingsArr.length > 0) setCurrency(settingsArr[0].currency || "KES")
        const myStudent = students.find((s: any) => s.id === sessionUser.id)
        if (myStudent?.courseId) {
          const found = courses.find(c => c.id === myStudent.courseId)
          setCourse(found || null)
        }
      }
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
        ) : course ? (
          <Card>
            <CardHeader>
              <CardTitle>{course.name}</CardTitle>
              <CardDescription>Code: {course.code}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{course.duration || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-medium">{currency} {Number(course.fee || 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No course assigned. Contact the institute.
            </CardContent>
          </Card>
        )}
  </>
  )
}
