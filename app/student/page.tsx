"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getItems, getCurrentUser } from "@/lib/api"
import type { Fee, Payment, Course, InstitutionSettings } from "@/lib/types"
import { BookOpen, DollarSign, Loader2, CheckCircle, Clock } from "lucide-react"
import { useEffect, useState } from "react"

export default function StudentDashboard() {
  const [stats, setStats] = useState({
    enrolledCourses: 0,
    totalPaid: 0,
    totalBalance: 0,
    feesPaid: 0,
    feesPending: 0,
  })
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [currency, setCurrency] = useState("KES")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const sessionUser = await getCurrentUser()
      if (sessionUser && sessionUser.role === "STUDENT") {
        const [students, allCourses, allFees, allPayments, settings] = await Promise.all([
          getItems<any>("students"),
          getItems<Course>("courses"),
          getItems<Fee>("fees"),
          getItems<Payment>("payments"),
          getItems<InstitutionSettings>("institutionSettings"),
        ])
        if (settings.length > 0) setCurrency(settings[0].currency || "KES")

        const myStudent = students.find((s: any) => s.id === sessionUser.id)
        const myFees = allFees.filter(f => f.studentId === sessionUser.id)
        const myPayments = allPayments.filter(p => p.studentId === sessionUser.id)
        const totalPaid = myPayments.reduce((s, p) => s + Number(p.amount), 0)
        const totalBalance = myFees.reduce((s, f) => s + Number(f.balance || 0), 0)
        const paidFees = myFees.filter(f => f.status === "PAID").length
        const pendingFees = myFees.filter(f => f.status !== "PAID").length

        setStats({
          enrolledCourses: myStudent?.courseId ? 1 : 0,
          totalPaid,
          totalBalance,
          feesPaid: paidFees,
          feesPending: pendingFees,
        })

        setRecentPayments(myPayments.sort((a, b) =>
          new Date(b.paymentDate || b.createdAt || "").getTime() - new Date(a.paymentDate || a.createdAt || "").getTime()
        ).slice(0, 5))
      }
    } catch (error) {
      console.error("Failed to load data", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    )
  }

  return (
    <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrolled Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enrolledCourses}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{currency} {stats.totalPaid.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{currency} {stats.totalBalance.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fees</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.feesPaid} Paid / {stats.feesPending} Pending</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Your latest fee payments</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.receiptNumber}</TableCell>
                      <TableCell>{currency} {Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell>{p.paymentMethod.replace("_", " ")}</TableCell>
                      <TableCell>{p.paymentDate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
  </>
  )
}
