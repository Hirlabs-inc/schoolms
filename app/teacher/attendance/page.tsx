"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getItems } from "@/lib/api"
import type { Course, Student } from "@/lib/types"
import { Loader2, Search } from "lucide-react"
import { useEffect, useState } from "react"
import { useUser } from "@/contexts/user-context"
import { Input } from "@/components/ui/input"

export default function TeacherStudentsPage() {
  const { user } = useUser()
  const [students, setStudents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => { if (user) loadData() }, [user])

  const loadData = async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const [allCourses, allStudents] = await Promise.all([
        getItems<Course>("courses"),
        getItems<Student>("students"),
      ])
      const myCourseIds = allCourses.filter(c => c.teacherId === user.id).map(c => c.id)
      const myStudents = allStudents.filter((s: any) => myCourseIds.includes(s.courseId || ""))
      setStudents(myStudents)
    } catch (error) {
      console.error("Failed to load data", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = students.filter((s: any) =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Enrolled Students</CardTitle>
              <CardDescription>Students enrolled in your courses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search students..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No students found</TableCell></TableRow>
                  ) : (
                    filtered.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell>{s.phone || "-"}</TableCell>
                        <TableCell><Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{s.status || "ACTIVE"}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
  </>
  )
}
