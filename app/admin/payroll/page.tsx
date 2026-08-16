"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getItems, addItem, updateItem, deleteItem, processPayroll, getTeacherCommissionSummaries, recordCommissionPayment } from "@/lib/api"
import type { Teacher, TeacherContract, PayrollRecord, InstitutionSettings, EnrollmentProgress, Course, Student, TeacherCommissionSummary } from "@/lib/types"
import { Plus, Trash2, Loader2, Pencil, Wallet, Calendar } from "lucide-react"
import { useEffect, useState } from "react"

export default function PayrollPage() {
  const [contracts, setContracts] = useState<TeacherContract[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentProgress[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [currency, setCurrency] = useState("KES")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false)
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<TeacherContract | null>(null)
  const [contractForm, setContractForm] = useState({
    teacherId: "", compensationType: "SALARY" as string, salaryAmount: "",
    commissionRate: "", commissionPerStudent: "", bankName: "", bankAccount: "",
    bankCode: "", taxId: "", startDate: "", status: "ACTIVE",
  })
  const [payForm, setPayForm] = useState({
    teacherId: "", contractId: "", amount: "", periodStart: "", periodEnd: "",
    payDate: new Date().toISOString().split("T")[0], payType: "SALARY" as string, notes: "",
  })
  const [commissionSummaries, setCommissionSummaries] = useState<TeacherCommissionSummary[]>([])
  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false)
  const [commissionForm, setCommissionForm] = useState({
    teacherId: "", teacherName: "", amount: "", payDate: new Date().toISOString().split("T")[0], notes: "",
  })

  useEffect(() => { loadData() }, [])

  const loadCommissionSummaries = async () => {
    try {
      const summaries = await getTeacherCommissionSummaries()
      setCommissionSummaries(summaries)
    } catch (error) {
      console.error("Failed to load commission summaries", error)
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [c, t, p, settings, enr, crs] = await Promise.all([
        getItems<TeacherContract>("teacherContracts"),
        getItems<Teacher>("teachers"),
        getItems<PayrollRecord>("payrollRecords"),
        getItems<InstitutionSettings>("institutionSettings"),
        getItems<EnrollmentProgress>("enrollmentProgress"),
        getItems<Course>("courses"),
      ])
      setContracts(c)
      setTeachers(t)
      setPayrollRecords(p)
      setEnrollments(enr)
      setCourses(crs)
      if (settings.length > 0) setCurrency(settings[0].currency)
      await loadCommissionSummaries()
    } catch (error) {
      console.error("Failed to load", error)
    } finally {
      setIsLoading(false)
    }
  }

  const countStudentsForTeacher = (teacherId: string): number => {
    const teacherCourses = courses.filter(c => c.teacherId === teacherId)
    const courseIds = new Set(teacherCourses.map(c => c.id))
    return enrollments.filter(e => courseIds.has(e.courseId)).length
  }

  const handleContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const data: any = {
        teacherId: contractForm.teacherId,
        compensationType: contractForm.compensationType,
        status: contractForm.status,
      }
      if (contractForm.compensationType === "SALARY") {
        data.salaryAmount = Number.parseFloat(contractForm.salaryAmount)
      } else {
        data.commissionRate = contractForm.commissionRate ? Number.parseFloat(contractForm.commissionRate) : null
        data.commissionPerStudent = contractForm.commissionPerStudent ? Number.parseFloat(contractForm.commissionPerStudent) : null
      }
      if (contractForm.bankName) data.bankName = contractForm.bankName
      if (contractForm.bankAccount) data.bankAccount = contractForm.bankAccount
      if (contractForm.bankCode) data.bankCode = contractForm.bankCode
      if (contractForm.taxId) data.taxId = contractForm.taxId
      if (contractForm.startDate) data.startDate = contractForm.startDate

      if (editingContract) {
        await updateItem("teacherContracts", editingContract.id, data)
      } else {
        await addItem("teacherContracts", data)
      }
      setIsContractDialogOpen(false)
      resetContractForm()
      loadData()
    } catch (error: any) {
      alert(error.message || "Failed to save contract")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await processPayroll(
        payForm.teacherId, payForm.contractId, Number.parseFloat(payForm.amount),
        payForm.periodStart, payForm.periodEnd, payForm.payDate,
        payForm.payType as "SALARY" | "COMMISSION", payForm.notes || undefined,
      )
      setIsPayDialogOpen(false)
      setPayForm({ teacherId: "", contractId: "", amount: "", periodStart: "", periodEnd: "", payDate: new Date().toISOString().split("T")[0], payType: "SALARY", notes: "" })
      loadData()
    } catch (error: any) {
      alert(error.message || "Failed to process payroll")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCommissionPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await recordCommissionPayment(
        commissionForm.teacherId,
        Number.parseFloat(commissionForm.amount),
        commissionForm.payDate,
        commissionForm.notes || undefined,
      )
      setIsCommissionDialogOpen(false)
      setCommissionForm({ teacherId: "", teacherName: "", amount: "", payDate: new Date().toISOString().split("T")[0], notes: "" })
      await loadCommissionSummaries()
    } catch (error: any) {
      alert(error.message || "Failed to record commission payment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetContractForm = () => {
    setEditingContract(null)
    setContractForm({ teacherId: "", compensationType: "SALARY", salaryAmount: "", commissionRate: "", commissionPerStudent: "", bankName: "", bankAccount: "", bankCode: "", taxId: "", startDate: "", status: "ACTIVE" })
  }

  const teacherName = (id: string) => {
    const t = teachers.find(t => t.id === id)
    return t ? `${t.firstName} ${t.lastName}` : "Unknown"
  }

  const activeContracts = contracts.filter(c => c.status === "ACTIVE")

  if (isLoading) {
    return (
      <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    )
  }

  return (
    <>
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Contracts</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{activeContracts.length}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Paid (All Time)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{currency} {payrollRecords.filter(r => r.status === "PAID").reduce((s, r) => s + Number(r.amount), 0).toLocaleString()}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Teachers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{teachers.length}</div></CardContent></Card>
        </div>

        <Tabs defaultValue="contracts">
          <TabsList className="mb-4">
            <TabsTrigger value="contracts">Teacher Contracts</TabsTrigger>
            <TabsTrigger value="payments">Payroll Payments</TabsTrigger>
            <TabsTrigger value="commission">Teacher Commission</TabsTrigger>
          </TabsList>

          <TabsContent value="contracts">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>Compensation Contracts</CardTitle><CardDescription>Set up salary or commission for teachers</CardDescription></div>
                  <Dialog open={isContractDialogOpen} onOpenChange={(o) => { setIsContractDialogOpen(o); if (!o) resetContractForm() }}>
                    <DialogTrigger asChild>
                      <Button><Plus className="h-4 w-4 mr-2" />New Contract</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handleContractSubmit}>
                        <DialogHeader><DialogTitle>{editingContract ? "Edit Contract" : "New Contract"}</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label>Teacher</Label>
                            <Select value={contractForm.teacherId} onValueChange={(v) => setContractForm({ ...contractForm, teacherId: v })}>
                              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                              <SelectContent>
                                {teachers.map(t => (<SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Compensation Type</Label>
                            <Select value={contractForm.compensationType} onValueChange={(v) => setContractForm({ ...contractForm, compensationType: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SALARY">Fixed Salary</SelectItem>
                                <SelectItem value="COMMISSION">Commission Based</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {contractForm.compensationType === "SALARY" ? (
                            <div className="grid gap-2">
                              <Label>Monthly Salary ({currency})</Label>
                              <Input type="number" value={contractForm.salaryAmount} onChange={(e) => setContractForm({ ...contractForm, salaryAmount: e.target.value })} required />
                            </div>
                          ) : (
                            <>
                              <div className="grid gap-2">
                                <Label>Commission Rate (%)</Label>
                                <Input type="number" value={contractForm.commissionRate} onChange={(e) => setContractForm({ ...contractForm, commissionRate: e.target.value })} placeholder="e.g. 10" />
                              </div>
                              <div className="grid gap-2">
                                <Label>Per Student Amount ({currency})</Label>
                                <Input type="number" value={contractForm.commissionPerStudent} onChange={(e) => setContractForm({ ...contractForm, commissionPerStudent: e.target.value })} placeholder="e.g. 500" />
                              </div>
                            </>
                          )}
                          <div className="grid gap-2">
                            <Label>Start Date</Label>
                            <Input type="date" value={contractForm.startDate} onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })} />
                          </div>
                          <div className="border-t pt-4">
                            <p className="text-sm font-medium mb-2">Bank Details (Optional)</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="grid gap-2"><Label>Bank Name</Label><Input value={contractForm.bankName} onChange={(e) => setContractForm({ ...contractForm, bankName: e.target.value })} /></div>
                              <div className="grid gap-2"><Label>Account Number</Label><Input value={contractForm.bankAccount} onChange={(e) => setContractForm({ ...contractForm, bankAccount: e.target.value })} /></div>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={contractForm.status} onValueChange={(v) => setContractForm({ ...contractForm, status: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingContract ? "Update" : "Create"}
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
                    <TableRow><TableHead>Teacher</TableHead><TableHead>Type</TableHead><TableHead>Amount/Rate</TableHead><TableHead>Bank</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No contracts</TableCell></TableRow>
                    ) : contracts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.teacherName || teacherName(c.teacherId)}</TableCell>
                        <TableCell><Badge variant="outline">{c.compensationType}</Badge></TableCell>
                        <TableCell>{c.compensationType === "SALARY" ? `${currency} ${Number(c.salaryAmount || 0).toLocaleString()}/mo` : `${c.commissionRate || 0}% + ${currency} ${c.commissionPerStudent || 0}/student`}</TableCell>
                        <TableCell className="text-xs">{c.bankName || "-"}</TableCell>
                        <TableCell><Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingContract(c)
                              setContractForm({
                                teacherId: c.teacherId, compensationType: c.compensationType,
                                salaryAmount: c.salaryAmount?.toString() || "",
                                commissionRate: c.commissionRate?.toString() || "",
                                commissionPerStudent: c.commissionPerStudent?.toString() || "",
                                bankName: c.bankName || "", bankAccount: c.bankAccount || "",
                                bankCode: c.bankCode || "", taxId: c.taxId || "",
                                startDate: c.startDate || "", status: c.status,
                              })
                              setIsContractDialogOpen(true)
                            }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              if (confirm("Delete this contract?")) { await deleteItem("teacherContracts", c.id); loadData() }
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>Payroll History</CardTitle><CardDescription>Record and view teacher payouts</CardDescription></div>
                  <Dialog open={isPayDialogOpen} onOpenChange={(o) => { setIsPayDialogOpen(o); if (!o) setPayForm({ teacherId: "", contractId: "", amount: "", periodStart: "", periodEnd: "", payDate: new Date().toISOString().split("T")[0], payType: "SALARY", notes: "" }) }}>
                    <DialogTrigger asChild>
                      <Button><Calendar className="h-4 w-4 mr-2" />Process Payroll</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handlePaySubmit}>
                        <DialogHeader><DialogTitle>Process Payroll Payment</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label>Teacher</Label>
                             <Select value={payForm.teacherId} onValueChange={(v) => {
                               const activeContracts = contracts.filter(c => c.teacherId === v && c.status === "ACTIVE")
                               const bestContract = activeContracts[0]
                               const cType = bestContract?.compensationType || "SALARY"
                               let cAmount = ""
                               if (cType === "SALARY") {
                                 cAmount = bestContract?.salaryAmount?.toString() || ""
                               } else if (cType === "COMMISSION" && bestContract) {
                                 const studentCount = countStudentsForTeacher(v)
                                 const perStudent = Number(bestContract.commissionPerStudent || 0)
                                 cAmount = (studentCount * perStudent).toString()
                               }
                               setPayForm({
                                 ...payForm, teacherId: v,
                                 contractId: bestContract?.id || "",
                                 payType: cType,
                                 amount: cAmount,
                               })
                             }}>
                              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                              <SelectContent>
                                {teachers.map(t => (<SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Pay Type</Label>
                            <Select value={payForm.payType} onValueChange={(v) => setPayForm({ ...payForm, payType: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SALARY">Salary</SelectItem>
                                <SelectItem value="COMMISSION">Commission</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Amount ({currency})</Label>
                            <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="grid gap-2"><Label>Period Start</Label><Input type="date" value={payForm.periodStart} onChange={(e) => setPayForm({ ...payForm, periodStart: e.target.value })} required /></div>
                            <div className="grid gap-2"><Label>Period End</Label><Input type="date" value={payForm.periodEnd} onChange={(e) => setPayForm({ ...payForm, periodEnd: e.target.value })} required /></div>
                          </div>
                          <div className="grid gap-2">
                            <Label>Payment Date</Label>
                            <Input type="date" value={payForm.payDate} onChange={(e) => setPayForm({ ...payForm, payDate: e.target.value })} required />
                          </div>
                          <div className="grid gap-2">
                            <Label>Notes (Optional)</Label>
                            <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Process Payment"}
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
                    <TableRow><TableHead>Date</TableHead><TableHead>Teacher</TableHead><TableHead>Type</TableHead><TableHead>Period</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRecords.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No payroll records</TableCell></TableRow>
                    ) : payrollRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.payDate}</TableCell>
                        <TableCell className="font-medium">{r.teacherName || teacherName(r.teacherId)}</TableCell>
                        <TableCell><Badge variant="outline">{r.payType}</Badge></TableCell>
                        <TableCell className="text-xs">{r.periodStart} to {r.periodEnd}</TableCell>
                        <TableCell className="font-medium">{currency} {Number(r.amount).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={r.status === "PAID" ? "default" : r.status === "PENDING" ? "secondary" : "destructive"}>{r.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={async () => {
                            if (confirm("Delete this payroll record?")) { await deleteItem("payrollRecords", r.id); loadData() }
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commission">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div><CardTitle>Teacher Commission</CardTitle><CardDescription>Students assigned, commission earned, and remaining balance per teacher</CardDescription></div>
                  <Button variant="outline" onClick={loadCommissionSummaries}><Loader2 className="h-4 w-4 mr-2" />Refresh</Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Teacher</TableHead><TableHead>Students Assigned</TableHead><TableHead>Total Commission Earned</TableHead><TableHead>Amount Paid</TableHead><TableHead>Remaining Balance</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionSummaries.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No commission summaries</TableCell></TableRow>
                    ) : commissionSummaries.map((s) => (
                      <TableRow key={s.teacherId}>
                        <TableCell className="font-medium">{s.teacherName}</TableCell>
                        <TableCell>{s.totalStudentsAssigned}</TableCell>
                        <TableCell>{currency} {Number(s.totalCommissionEarned).toLocaleString()}</TableCell>
                        <TableCell>{currency} {Number(s.amountPaid).toLocaleString()}</TableCell>
                        <TableCell className={Number(s.remainingBalance) > 0 ? "font-medium text-red-600" : "font-medium"}>{currency} {Number(s.remainingBalance).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => {
                            setCommissionForm({ teacherId: s.teacherId, teacherName: s.teacherName, amount: s.remainingBalance?.toString() || "", payDate: new Date().toISOString().split("T")[0], notes: "" })
                            setIsCommissionDialogOpen(true)
                          }}>
                            <Wallet className="h-4 w-4 mr-1" />Pay Commission
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={isCommissionDialogOpen} onOpenChange={(o) => { setIsCommissionDialogOpen(o); if (!o) setCommissionForm({ teacherId: "", teacherName: "", amount: "", payDate: new Date().toISOString().split("T")[0], notes: "" }) }}>
              <DialogContent>
                <form onSubmit={handleCommissionPaySubmit}>
                  <DialogHeader><DialogTitle>Pay Commission to {commissionForm.teacherName}</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Amount ({currency})</Label>
                      <Input type="number" value={commissionForm.amount} onChange={(e) => setCommissionForm({ ...commissionForm, amount: e.target.value })} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Payment Date</Label>
                      <Input type="date" value={commissionForm.payDate} onChange={(e) => setCommissionForm({ ...commissionForm, payDate: e.target.value })} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Notes (Optional)</Label>
                      <Input value={commissionForm.notes} onChange={(e) => setCommissionForm({ ...commissionForm, notes: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Record Payment"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
  </>
  )
}
