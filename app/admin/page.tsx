"use client"

import type { User, Student, Payment, Expense, Fee, PayrollRecord, Income, Course, InstitutionSettings } from "@/lib/types"
import { Users, GraduationCap, BookOpen, TrendingUp, DollarSign, CreditCard, Receipt, AlertTriangle, Loader2, Wallet, BarChart3 } from "lucide-react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getItems } from "@/lib/api"

interface PaymentWithStudentName extends Payment {
  studentName: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    outstandingBalances: 0,
    totalIncome: 0,
    totalExpenses: 0,
    cashBalance: 0,
    studentsInDebt: 0,
  })
  const [recentPayments, setRecentPayments] = useState<PaymentWithStudentName[]>([])
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [currency, setCurrency] = useState("KES")
  const [courseCount, setCourseCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [users, students, payments, expenses, fees, settings, payroll, income, courses] = await Promise.all([
          getItems<User>("users"),
          getItems<Student>("students"),
          getItems<Payment>("payments"),
          getItems<Expense>("expenses"),
          getItems<Fee>("fees"),
          getItems<InstitutionSettings>("institutionSettings"),
          getItems<PayrollRecord>("payrollRecords"),
          getItems<Income>("income"),
          getItems<Course>("courses"),
        ])
        if (settings.length > 0) setCurrency(settings[0].currency || "KES")

        const studentNameMap = new Map(students.map(s => [s.id, `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Unknown"]))

        const activeStudents = students.filter(s => s.status === "ACTIVE" || !s.status)
        const totalIncome = payments.reduce((sum, p) => sum + Number(p.amount), 0) + income.filter(i => i.category !== "FEES").reduce((sum, i) => sum + Number(i.amount), 0)
        const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
        const outstandingFees = fees.filter(f => f.status !== "PAID")
        const totalOutstanding = outstandingFees.reduce((sum, f) => sum + Number(f.balance || 0), 0)
        const studentsInDebt = outstandingFees.length
        const courseCount = courses.length

        setStats({
          totalStudents: students.length,
          activeStudents: activeStudents.length,
          outstandingBalances: totalOutstanding,
          totalIncome,
          totalExpenses,
          cashBalance: totalIncome - totalExpenses,
          studentsInDebt,
        })
        setCourseCount(courseCount)

        const paymentWithStudentName = payments.map(p => ({
          ...p,
          studentName: studentNameMap.get(p.studentId) || "Unknown",
        }))

        setRecentPayments(
          paymentWithStudentName
            .sort((a, b) => new Date(b.paymentDate || b.createdAt || "").getTime() - new Date(a.paymentDate || a.createdAt || "").getTime())
            .slice(0, 5)
        )
        setRecentExpenses(
          expenses
            .sort((a, b) => new Date(b.expenseDate || b.createdAt || "").getTime() - new Date(a.expenseDate || a.createdAt || "").getTime())
            .slice(0, 5)
        )
      } catch (error) {
        console.error("Failed to fetch stats", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStudents}</div>
              <p className="text-xs text-muted-foreground">{stats.activeStudents} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Income Collected</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{currency} {stats.totalIncome.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total payments received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <CreditCard className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{currency} {stats.totalExpenses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All time expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{currency} {stats.cashBalance.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Income - Expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Balances</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{currency} {stats.outstandingBalances.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{stats.studentsInDebt} students in debt</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courseCount}</div>
              <p className="text-xs text-muted-foreground">Active courses</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Payments</CardTitle>
              <CardDescription>Latest student fee payments</CardDescription>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No payments recorded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.studentName}</TableCell>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Expenses</CardTitle>
              <CardDescription>Latest institution expenses</CardDescription>
            </CardHeader>
            <CardContent>
              {recentExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No expenses recorded yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentExpenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.category.replace("_", " ")}</TableCell>
                        <TableCell>{currency} {Number(e.amount).toLocaleString()}</TableCell>
                        <TableCell>{e.expenseDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
  </>
  )
}
