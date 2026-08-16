"use client"

import type React from "react"

import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getItems, addItem, updateItem, deleteItem, getCurrentUser, getStudentFeeSummary, updateOverdueFees } from "@/lib/api"
import type { Student, Fee, Payment, Course, InstitutionSettings, Income } from "@/lib/types"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { DollarSign, Plus, Trash2, Loader2, Printer, Search, Pencil } from "lucide-react"
import { useEffect, useState } from "react"

function generateReceiptNumber(): string {
  const date = new Date()
  const y = date.getFullYear().toString().slice(-2)
  const m = (date.getMonth() + 1).toString().padStart(2, "0")
  const d = date.getDate().toString().padStart(2, "0")
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
  return `RCP-${y}${m}${d}-${rand}`
}

export default function FeesPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currency, setCurrency] = useState("KES")

  // Fee assignment dialog
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false)
  const [isEditingFee, setIsEditingFee] = useState(false)
  const [feeForm, setFeeForm] = useState({ id: "", studentId: "", courseId: "", totalFee: "", dueDate: "" })

  // Payment dialog
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isEditingPayment, setIsEditingPayment] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ id: "", feeId: "", studentId: "", amount: "", paymentMethod: "CASH", receiptNumber: "", notes: "", paymentDate: new Date().toISOString().split("T")[0] })
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null)

  // Receipt dialog
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false)
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null)

  const [searchTerm, setSearchTerm] = useState("")

  // Student fee summary
  const [summaryStudentId, setSummaryStudentId] = useState("")
  const [summary, setSummary] = useState<{ totalFee: number; amountPaid: number; balance: number; nextDueDate: string | null | undefined; status: string; payments: Payment[] } | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      await updateOverdueFees()
      const [studentsData, coursesData, feesData, paymentsData, settings] = await Promise.all([
        getItems<Student>("students"),
        getItems<Course>("courses"),
        getItems<Fee>("fees"),
        getItems<Payment>("payments"),
        getItems<InstitutionSettings>("institutionSettings"),
      ])
      if (settings.length > 0) setCurrency(settings[0].currency || "KES")
      setStudents(studentsData)
      setCourses(coursesData)
      setFees(feesData)
      setPayments(paymentsData)
    } catch (error) {
      console.error("Failed to load data", error)
    } finally {
      setIsLoading(false)
    }
  }

  // --- Fee CRUD ---
  const handleAddFee = () => {
    setIsEditingFee(false)
    setFeeForm({ id: "", studentId: "", courseId: "", totalFee: "", dueDate: "" })
    setIsFeeDialogOpen(true)
  }

  const handleEditFee = (fee: Fee) => {
    setIsEditingFee(true)
    setFeeForm({
      id: fee.id,
      studentId: fee.studentId,
      courseId: fee.courseId,
      totalFee: fee.totalFee.toString(),
      dueDate: fee.dueDate || "",
    })
    setIsFeeDialogOpen(true)
  }

  const handleSubmitFee = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const total = Number.parseFloat(feeForm.totalFee)
      if (isEditingFee) {
        const fee = fees.find(f => f.id === feeForm.id)
        const paidSoFar = fee ? Number(fee.totalFee) - Number(fee.balance) : 0
        const newBalance = total - paidSoFar
        const newStatus = newBalance <= 0 ? "PAID" : newBalance < total ? "PARTIAL" : "PENDING"
        await updateItem("fees", feeForm.id, {
          courseId: feeForm.courseId,
          totalFee: total,
          balance: newBalance,
          dueDate: feeForm.dueDate || null,
          status: newStatus,
        })
      } else {
        await addItem("fees", {
          studentId: feeForm.studentId,
          courseId: feeForm.courseId,
          totalFee: total,
          balance: total,
          dueDate: feeForm.dueDate || null,
          status: "PENDING",
        })
      }
      setIsFeeDialogOpen(false)
      loadData()
    } catch (error: any) {
      alert(error.message || "Failed to save fee")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteFee = async (id: string) => {
    if (!confirm("Delete this fee assignment? This will also remove all associated payments.")) return
    try {
      // Delete associated income records and payments for this fee
      const feePayments = payments.filter(p => p.feeId === id)
      for (const p of feePayments) {
        const allIncome = await getItems<Income>("income")
        const matchedIncome = allIncome.find(i => i.receiptNumber === p.receiptNumber)
        if (matchedIncome) await deleteItem("income", matchedIncome.id)
        await deleteItem("payments", p.id)
      }
      await deleteItem("fees", id)
      loadData()
    } catch (error) {
      alert("Failed to delete fee")
    }
  }

  // --- Payment CRUD ---
  const recalcFeeBalance = async (feeId: string) => {
    const fee = fees.find(f => f.id === feeId)
    if (!fee) return
    const allPayments = [...payments]
    const feePayments = allPayments.filter(p => p.feeId === feeId)
    const totalPaid = feePayments.reduce((s, p) => s + Number(p.amount), 0)
    const newBalance = Number(fee.totalFee) - totalPaid
    const newStatus = newBalance <= 0 ? "PAID" : newBalance < Number(fee.totalFee) ? "PARTIAL" : "PENDING"
    await updateItem("fees", feeId, { balance: Math.max(0, newBalance), status: newStatus })
  }

  const openPaymentDialog = (fee: Fee) => {
    setIsEditingPayment(false)
    setSelectedFee(fee)
    setPaymentForm({
      id: "", feeId: fee.id, studentId: fee.studentId,
      amount: "", paymentMethod: "CASH",
      receiptNumber: generateReceiptNumber(), notes: "",
      paymentDate: new Date().toISOString().split("T")[0],
    })
    setIsPaymentDialogOpen(true)
  }

  const handleEditPayment = (payment: Payment) => {
    setIsEditingPayment(true)
    setSelectedFee(fees.find(f => f.id === payment.feeId) || null)
    setPaymentForm({
      id: payment.id,
      feeId: payment.feeId,
      studentId: payment.studentId,
      amount: payment.amount.toString(),
      paymentMethod: payment.paymentMethod,
      receiptNumber: payment.receiptNumber,
      notes: payment.notes || "",
      paymentDate: payment.paymentDate,
    })
    setIsPaymentDialogOpen(true)
  }

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      if (isEditingPayment) {
        // Get the original payment to check if receipt number changed
        const originalPayment = payments.find(p => p.id === paymentForm.id)
        const receiptChanged = originalPayment && originalPayment.receiptNumber !== paymentForm.receiptNumber

        await updateItem("payments", paymentForm.id, {
          amount: Number.parseFloat(paymentForm.amount),
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          receiptNumber: paymentForm.receiptNumber,
          notes: paymentForm.notes,
        })
        await recalcFeeBalance(paymentForm.feeId)

        // Update corresponding income record
        const existingIncome = await getItems<Income>("income")
        if (receiptChanged && originalPayment) {
          // Delete old income record with old receipt number
          const oldIncome = existingIncome.find(i => i.receiptNumber === originalPayment.receiptNumber)
          if (oldIncome) await deleteItem("income", oldIncome.id)
          // Create new income record with new receipt number
          const studentName = getStudentName(paymentForm.studentId)
          const currentUser = await getCurrentUser()
          await addItem("income", {
            category: "FEES",
            amount: Number.parseFloat(paymentForm.amount),
            description: `Fee payment - ${studentName}`,
            incomeDate: paymentForm.paymentDate,
            receiptNumber: paymentForm.receiptNumber,
            createdBy: currentUser?.id || "",
          })
        } else {
          const matched = existingIncome.find(i => i.receiptNumber === paymentForm.receiptNumber)
          if (matched) {
            await updateItem("income", matched.id, {
              amount: Number.parseFloat(paymentForm.amount),
              incomeDate: paymentForm.paymentDate,
            })
          }
        }
      } else {
        const receiptNumber = paymentForm.receiptNumber || generateReceiptNumber()
        await addItem("payments", {
          studentId: paymentForm.studentId,
          feeId: paymentForm.feeId,
          amount: Number.parseFloat(paymentForm.amount),
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod as "CASH" | "M_PESA" | "BANK",
          receiptNumber,
          notes: paymentForm.notes || "",
        })
        // Update fee balance
        await recalcFeeBalance(paymentForm.feeId)
        // Auto-create income record
        const studentName = getStudentName(paymentForm.studentId)
        const currentUser = await getCurrentUser()
        await addItem("income", {
          category: "FEES",
          amount: Number.parseFloat(paymentForm.amount),
          description: `Fee payment - ${studentName}`,
          incomeDate: paymentForm.paymentDate,
          receiptNumber,
          createdBy: currentUser?.id || "",
        })
      }
      setIsPaymentDialogOpen(false)
      loadData()
    } catch (error: any) {
      alert(error.message || "Failed to save payment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeletePayment = async (payment: Payment) => {
    if (!confirm("Delete this payment? The fee balance will be recalculated.")) return
    try {
      // Delete corresponding income record
      const allIncome = await getItems<Income>("income")
      const matchedIncome = allIncome.find(i => i.receiptNumber === payment.receiptNumber)
      if (matchedIncome) {
        await deleteItem("income", matchedIncome.id)
      }
      await deleteItem("payments", payment.id)
      await recalcFeeBalance(payment.feeId)
      loadData()
    } catch (error) {
      alert("Failed to delete payment")
    }
  }

  // --- Receipt ---
  const openReceipt = (payment: Payment) => {
    setReceiptPayment(payment)
    setIsReceiptDialogOpen(true)
  }

  const handlePrintReceipt = () => {
    if (!receiptPayment) return
    const studentName = getStudentName(receiptPayment.studentId)
    const printWindow = window.open("", "_blank")
    if (!printWindow) { alert("Please allow pop-ups to print receipt"); return }
    printWindow.document.write(`
      <html><head><title>Receipt ${receiptPayment.receiptNumber}</title>
      <style>
        @page { margin: 0.25in; }
        body { font-family: "Segoe UI", Arial, sans-serif; margin: 0; padding: 0; color: #111; }
        .receipt { max-width: 380px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding-bottom: 12px; border-bottom: 2px solid #1a1a2e; margin-bottom: 12px; }
        .header .name { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: -0.02em; }
        .header .title { font-size: 11px; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px; padding: 8px; background: #f3f4f6; border-radius: 4px; }
        .meta .lbl { color: #6b7280; }
        .meta .val { font-weight: 600; font-family: monospace; }
        .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
        .row .lbl { color: #6b7280; }
        .row .val { font-weight: 500; text-align: right; }
        .divider { height: 1px; background: #e5e7eb; margin: 6px 0; }
        .amount { display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #1a1a2e; color: #fff; border-radius: 4px; margin: 4px 0; }
        .amount .lbl { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .amount .val { font-size: 18px; font-weight: 700; }
        .footer { text-align: center; font-size: 11px; color: #9ca3af; padding-top: 10px; border-top: 1px solid #e5e7eb; margin-top: 10px; }
        .footer .thanks { font-size: 13px; font-weight: 600; color: #111; margin-bottom: 2px; }
      </style></head><body>
      <div class="receipt">
        <div class="header">
          <div class="name">Trainify Technology Training Institute</div>
          <div class="title">Official Payment Receipt</div>
        </div>
        <div class="meta">
          <div><div class="lbl">Receipt #</div><div class="val">${receiptPayment.receiptNumber}</div></div>
          <div style="text-align:right"><div class="lbl">Date</div><div class="val">${receiptPayment.paymentDate}</div></div>
        </div>
        <div class="row"><span class="lbl">Student</span><span class="val">${studentName}</span></div>
        <div class="row"><span class="lbl">Payment Method</span><span class="val">${receiptPayment.paymentMethod.replace("_", " ")}</span></div>
        <div class="divider"></div>
        <div class="amount"><span class="lbl">Amount Paid</span><span class="val">${currency} ${Number(receiptPayment.amount).toLocaleString()}</span></div>
        <div class="divider"></div>
        ${receiptPayment.notes ? `<div class="row"><span class="lbl">Notes</span><span class="val">${receiptPayment.notes}</span></div><div class="divider"></div>` : ""}
        <div class="footer">
          <div class="thanks">Thank you for your payment</div>
          <div>Trainify Technology Training Institute</div>
          <div>Receipt #${receiptPayment.receiptNumber}</div>
        </div>
      </div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const getStudentName = (id: string) => {
    const s = students.find(s => s.id === id)
    return s ? `${s.firstName} ${s.lastName}` : "Unknown"
  }

  const getCourseName = (id: string) => {
    const c = courses.find(c => c.id === id)
    return c ? c.name : "Unknown"
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PAID: "bg-green-100 text-green-700",
      PARTIAL: "bg-yellow-100 text-yellow-700",
      PENDING: "bg-gray-100 text-gray-700",
      OVERDUE: "bg-red-100 text-red-700",
      NONE: "bg-gray-100 text-gray-500",
    }
    return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${colors[status] || ""}`}>{status}</span>
  }

  const loadStudentSummary = async (studentId: string) => {
    setSummaryStudentId(studentId)
    if (!studentId) { setSummary(null); return }
    setIsSummaryLoading(true)
    setSummary(null)
    try {
      const data = await getStudentFeeSummary(studentId)
      setSummary(data)
    } catch (error) {
      console.error("Failed to load student summary", error)
      setSummary(null)
    } finally {
      setIsSummaryLoading(false)
    }
  }

  const isDueSoon = (fee: Fee) => {
    if (fee.status === "PAID" || fee.status === "OVERDUE" || !fee.dueDate || Number(fee.balance) <= 0) return false
    const due = new Date(fee.dueDate + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 && diff <= 7
  }

  const overdueStudentCount = fees.filter(f => f.status === "OVERDUE").length

  const feeRowClasses = (fee: Fee) => {
    if (fee.status === "OVERDUE") return "bg-red-50/60"
    if (isDueSoon(fee)) return "bg-amber-50/60"
    return ""
  }

  const feeStatus = (fee: Fee) => {
    if (fee.status === "OVERDUE") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">OVERDUE</Badge>
    if (isDueSoon(fee)) return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">DUE SOON</Badge>
    if (fee.status === "PAID") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">PAID</Badge>
    return statusBadge(fee.status)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    )
  }

  return (
    <>
    {overdueStudentCount > 0 && (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        <span className="font-medium">{overdueStudentCount} student(s) have overdue balances</span>
      </div>
    )}
    <Tabs defaultValue="fees">
      <TabsList className="mb-4">
        <TabsTrigger value="fees">Fee Assignments</TabsTrigger>
        <TabsTrigger value="payments">Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="fees">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Student Fee Summary</CardTitle>
                <CardDescription>Select a student to view total fee, balance, next due date, and payment history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 max-w-sm">
                  <Select value={summaryStudentId} onValueChange={loadStudentSummary}>
                    <SelectTrigger><SelectValue placeholder="Select a student..." /></SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isSummaryLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading fee summary...
                  </div>
                )}
                {summary && !isSummaryLoading && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Total Course Fee</div>
                        <div className="mt-1 text-xl font-bold">{currency} {summary.totalFee.toLocaleString()}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Amount Paid</div>
                        <div className="mt-1 text-xl font-bold text-green-600">{currency} {summary.amountPaid.toLocaleString()}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Remaining Balance</div>
                        <div className={`mt-1 text-xl font-bold ${summary.balance > 0 ? "text-red-600" : "text-gray-900"}`}>{currency} {summary.balance.toLocaleString()}</div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Next Payment Due</div>
                        <div className="mt-1 text-xl font-bold">{summary.nextDueDate || "—"}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      {statusBadge(summary.status)}
                    </div>
                    <div className="mt-6">
                      <h3 className="mb-3 text-sm font-semibold">Payment History</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Receipt #</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.payments.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center h-20 text-muted-foreground">No payments recorded</TableCell></TableRow>
                          ) : (
                            summary.payments.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell>{p.paymentDate}</TableCell>
                                <TableCell className="font-medium">{currency} {Number(p.amount).toLocaleString()}</TableCell>
                                <TableCell>{p.paymentMethod.replace("_", " ")}</TableCell>
                                <TableCell className="font-mono text-xs">{p.receiptNumber}</TableCell>
                                <TableCell>{p.notes || "—"}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
                {!summary && !isSummaryLoading && summaryStudentId && (
                  <div className="text-sm text-muted-foreground">No fee summary available for this student.</div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Student Fees</CardTitle>
                    <CardDescription>Assign course fees and track payments</CardDescription>
                  </div>
                  <Button onClick={handleAddFee}>
                    <Plus className="h-4 w-4 mr-2" /> Assign Fee
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by student name..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Total Fee</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fees.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No fees assigned yet</TableCell></TableRow>
                    ) : (
                      fees.map((fee) => {
                        const paid = Number(fee.totalFee) - Number(fee.balance)
                        return (
                          <TableRow key={fee.id} className={feeRowClasses(fee)}>
                            <TableCell className="font-medium">{getStudentName(fee.studentId)}</TableCell>
                            <TableCell>{fee.courseName || getCourseName(fee.courseId)}</TableCell>
                            <TableCell>{currency} {Number(fee.totalFee).toLocaleString()}</TableCell>
                            <TableCell className="text-green-600">{currency} {paid.toLocaleString()}</TableCell>
                            <TableCell className={`font-medium ${Number(fee.balance) > 0 ? "text-red-600" : ""}`}>{currency} {Number(fee.balance).toLocaleString()}</TableCell>
                            <TableCell>{feeStatus(fee)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openPaymentDialog(fee)}>
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleEditFee(fee)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteFee(fee.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>All recorded payments (click Edit to modify, Delete to remove)</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt #</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No payments recorded yet</TableCell></TableRow>
                    ) : (
                      payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.receiptNumber}</TableCell>
                          <TableCell className="font-medium">{getStudentName(p.studentId)}</TableCell>
                          <TableCell>{currency} {Number(p.amount).toLocaleString()}</TableCell>
                          <TableCell>{p.paymentMethod.replace("_", " ")}</TableCell>
                          <TableCell>{p.paymentDate}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openReceipt(p)}>
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleEditPayment(p)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeletePayment(p)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Fee Dialog (Add/Edit) */}
        <Dialog open={isFeeDialogOpen} onOpenChange={(open) => { if (!open) setIsFeeDialogOpen(false) }}>
          <DialogContent>
            <form onSubmit={handleSubmitFee}>
              <DialogHeader>
                <DialogTitle>{isEditingFee ? "Edit Fee" : "Assign Course Fee"}</DialogTitle>
                <DialogDescription>
                  {isEditingFee ? "Update fee amount or due date" : "Set the fee for a student's course"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {!isEditingFee && (
                  <div className="grid gap-2">
                    <Label>Student</Label>
                    <Select value={feeForm.studentId} onValueChange={(v) => {
                      const student = students.find(s => s.id === v)
                      const cId = student?.courseId || ""
                      const course = courses.find(c => c.id === cId)
                      setFeeForm({ ...feeForm, studentId: v, courseId: cId, totalFee: course?.fee?.toString() || "" })
                    }} required>
                      <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label>Course</Label>
                  <Select value={feeForm.courseId} onValueChange={(v) => {
                    const course = courses.find(c => c.id === v)
                    setFeeForm({ ...feeForm, courseId: v, totalFee: course?.fee?.toString() || feeForm.totalFee })
                  }} required>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} {c.fee ? `- ${currency} ${c.fee}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Total Fee ({currency})</Label>
                  <Input type="number" value={feeForm.totalFee} onChange={(e) => setFeeForm({ ...feeForm, totalFee: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Due Date (Optional)</Label>
                  <Input type="date" value={feeForm.dueDate} onChange={(e) => setFeeForm({ ...feeForm, dueDate: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFeeDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEditingFee ? "Update Fee" : "Assign Fee"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Payment Dialog (Add/Edit) */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => { if (!open) setIsPaymentDialogOpen(false) }}>
          <DialogContent>
            <form onSubmit={handleSubmitPayment}>
              <DialogHeader>
                <DialogTitle>{isEditingPayment ? "Edit Payment" : "Record Payment"}</DialogTitle>
                <DialogDescription>
                  {selectedFee && `Student: ${getStudentName(selectedFee.studentId)} | Balance: ${currency} ${Number(selectedFee.balance).toLocaleString()}`}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Amount ({currency})</Label>
                  <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentForm.paymentMethod} onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="M_PESA">M-Pesa</SelectItem>
                      <SelectItem value="BANK">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Payment Date</Label>
                  <Input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Receipt Number</Label>
                  <Input value={paymentForm.receiptNumber} onChange={(e) => setPaymentForm({ ...paymentForm, receiptNumber: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label>Notes (Optional)</Label>
                  <Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isEditingPayment ? "Update Payment" : "Record Payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Receipt Dialog */}
        <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <VisuallyHidden>
                <DialogTitle>Payment Receipt</DialogTitle>
              </VisuallyHidden>
            </DialogHeader>
            {receiptPayment && (
              <div className="receipt-container">
                <div className="receipt-header">
                  <div className="institution-name">Trainify Technology Training Institute</div>
                  <div className="receipt-title">Official Payment Receipt</div>
                </div>

                <div className="receipt-meta">
                  <div>
                    <div className="label">Receipt #</div>
                    <div className="value">{receiptPayment.receiptNumber}</div>
                  </div>
                  <div className="text-right">
                    <div className="label">Date</div>
                    <div className="value">{receiptPayment.paymentDate}</div>
                  </div>
                </div>

                <div className="receipt-row">
                  <span className="label">Student</span>
                  <span className="value">{getStudentName(receiptPayment.studentId)}</span>
                </div>

                <div className="receipt-row">
                  <span className="label">Payment Method</span>
                  <span className="value">{receiptPayment.paymentMethod.replace("_", " ")}</span>
                </div>

                <div className="receipt-divider" />

                <div className="receipt-amount">
                  <span className="label">Amount Paid</span>
                  <span className="value">{currency} {Number(receiptPayment.amount).toLocaleString()}</span>
                </div>

                <div className="receipt-divider" />

                {receiptPayment.notes && (
                  <>
                    <div className="receipt-row">
                      <span className="label">Notes</span>
                      <span className="value">{receiptPayment.notes}</span>
                    </div>
                    <div className="receipt-divider" />
                  </>
                )}

                <div className="receipt-footer">
                  <div className="thank-you">Thank you for your payment</div>
                  <div>Trainify Technology Training Institute</div>
                  <div>Receipt #{receiptPayment.receiptNumber}</div>
                </div>

                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={handlePrintReceipt} className="w-full">
                    <Printer className="h-4 w-4 mr-2" /> Print Receipt
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
  </>
  )
}
