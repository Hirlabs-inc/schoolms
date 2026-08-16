"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getItems } from "@/lib/api"
import type { Course, Student } from "@/lib/types"
import { BookOpen, Users, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useUser } from "@/contexts/user-context"

export default function TeacherDashboard() {
  const { user } = useUser()
  const [stats, setStats] = useState({ myCourses: 0, totalStudents: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { if (user) loadData() }, [user])

  const loadData = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const [courses, students] = await Promise.all([
        getItems<Course>("courses"),
        getItems<Student>("students"),
      ])
      const myCourses = courses.filter(c => c.teacherId === user.id)
      setStats({ myCourses: myCourses.length, totalStudents: students.length })
    } catch (error) {
      console.error("Failed to load data", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
        {isLoading  ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">My Courses</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.myCourses}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.totalStudents}</div></CardContent>
            </Card>
          </div>
        )}
  </>
  )
}
