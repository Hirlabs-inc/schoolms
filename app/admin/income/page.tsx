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
import { getItems, addItem, updateItem, deleteItem, getIncomeSummary } from "@/lib/api"
import type { Income, Payment, InstitutionSettings } from "@/lib/types"
import { TrendingUp, Plus, Trash2, Loader2, Search, Pencil } from "lucide-react"
import { useEffect, useState } from "react"

const INCOME_CATEGORIES = ["FEES", "GRANTS", "DONATIONS", "OTHER"] as const

export default function IncomePage() {
  const [incomeList, setIncomeList] = useState<Income[]>([])
  const [summary, setSummary] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currency, setCurrency] = useState("KES")
  const [formData, setFormData] = useState({
    category: "OTHER", amount: "", description: "",
    incomeDate: new Date().toISOString().split("T")[0], receiptNumber: "",
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [data, settings, summaryData, payments] = await Promise.all([
        getItems<Income>("income"),
        getItems<InstitutionSettings>("institutionSettings"),
        getIncomeSummary(new Date().getFullYear()),
        getItems<Payment>("payments"),
      ])
      let incomeData = data
      // Backfill income records for existing payments that don't have one
      const missingPayments = payments.filter(p => !data.find(i => i.receiptNumber === p.receiptNumber))
      if (missingPayments.length > 0) {
        await Promise.all(missingPayments.map(p =>
          addItem<Income>("income", {
            category: "FEES",
            amount: Number(p.amount),
            description: `Fee payment - Receipt ${p.receiptNumber}`,
            incomeDate: p.paymentDate,
            receiptNumber: p.receiptNumber,
          })
        ))
        const [updatedData] = await Promise.all([getItems<Income>("income")])
        incomeData = updatedData
      }
      setIncomeList(incomeData)
      setSummary(summaryData)
      if (settings.length > 0) setCurrency(settings[0].currency)
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
        category: formData.category, amount: Number.parseFloat(formData.amount),
        description: formData.description, incomeDate: formData.incomeDate,
        receiptNumber: formData.receiptNumber || null,
      }
      if (editingIncome) {
        await updateItem("income", editingIncome.id, data)
      } else {
        await addItem("income", data)
      }
      setIsDialogOpen(false)
      setEditingIncome(null)
      setFormData({ category: "OTHER", amount: "", description: "", incomeDate: new Date().toISOString().split("T")[0], receiptNumber: "" })
      loadData()
    } catch (error: any) {
      alert(error.message || "Failed to save")
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalAll = incomeList.reduce((s, i) => s + Number(i.amount), 0)
  const filtered = incomeList.filter(i => i.description.toLowerCase().includes(searchTerm.toLowerCase()))

  if (isLoading) {
    return (
      <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    )
  }

  return (
    <>
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Income (Year)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{currency} {totalAll.toLocaleString()}</div></CardContent></Card>
          {INCOME_CATEGORIES.map((cat) => {
            const total = incomeList.filter(i => i.category === cat).reduce((s, i) => s + Number(i.amount), 0)
            return total > 0 ? (
              <Card key={cat}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{cat}</CardTitle></CardHeader><CardContent><div className="text-lg font-bold">{currency} {total.toLocaleString()}</div></CardContent></Card>
            ) : null
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Income Records</CardTitle><CardDescription>Track all revenue sources</CardDescription></div>
              <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) { setEditingIncome(null); setFormData({ category: "OTHER", amount: "", description: "", incomeDate: new Date().toISOString().split("T")[0], receiptNumber: "" }) } }}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Income</Button></DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSubmit}>
                    <DialogHeader><DialogTitle>{editingIncome ? "Edit Income" : "Record Income"}</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {INCOME_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Amount ({currency})</Label>
                        <Input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                      </div>
                      <div className="grid gap-2">
                        <Label>Description</Label>
                        <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} required />
                      </div>
                      <div className="grid gap-2">
                        <Label>Date</Label>
                        <Input type="date" value={formData.incomeDate} onChange={(e) => setFormData({ ...formData, incomeDate: e.target.value })} required />
                      </div>
                      <div className="grid gap-2">
                        <Label>Receipt Number (Optional)</Label>
                        <Input value={formData.receiptNumber} onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingIncome ? "Update" : "Record"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search income..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>Receipt</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No income recorded</TableCell></TableRow>
                ) : filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.incomeDate}</TableCell>
                    <TableCell><Badge>{i.category}</Badge></TableCell>
                    <TableCell>{i.description}</TableCell>
                    <TableCell className="font-medium">{currency} {Number(i.amount).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{i.receiptNumber || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingIncome(i); setFormData({ category: i.category, amount: i.amount.toString(), description: i.description, incomeDate: i.incomeDate, receiptNumber: i.receiptNumber || "" }); setIsDialogOpen(true) }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={async () => { if (confirm("Delete this record?")) { await deleteItem("income", i.id); loadData() } }}>
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
  </>
  )
}
