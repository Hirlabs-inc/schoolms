"use client"

import type React from "react"

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
import { Badge } from "@/components/ui/badge"
import { getItems, addItem, updateItem, deleteItem } from "@/lib/api"
import type { Expense, InstitutionSettings } from "@/lib/types"
import { DollarSign, Plus, Trash2, Loader2, Search, Pencil } from "lucide-react"
import { useEffect, useState } from "react"

const EXPENSE_CATEGORIES = [
  "RENT", "SALARIES", "INTERNET", "ELECTRICITY", "MARKETING",
  "OFFICE_SUPPLIES", "TRANSPORT", "MISCELLANEOUS",
] as const

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [currency, setCurrency] = useState("KES")
  const [formData, setFormData] = useState({
    category: "MISCELLANEOUS",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().split("T")[0],
    receiptNumber: "",
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [data, settings] = await Promise.all([
        getItems<Expense>("expenses"),
        getItems<InstitutionSettings>("institutionSettings"),
      ])
      setExpenses(data)
      if (settings.length > 0) setCurrency(settings[0].currency)
    } catch (error) {
      console.error("Failed to load expenses", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const expenseData = {
        category: formData.category,
        amount: Number.parseFloat(formData.amount),
        description: formData.description,
        expenseDate: formData.expenseDate,
        receiptNumber: formData.receiptNumber || null,
      }

      if (editingExpense) {
        await updateItem("expenses", editingExpense.id, expenseData)
      } else {
        await addItem("expenses", expenseData)
      }

      setIsDialogOpen(false)
      setEditingExpense(null)
      setFormData({
        category: "MISCELLANEOUS", amount: "", description: "",
        expenseDate: new Date().toISOString().split("T")[0], receiptNumber: "",
      })
      loadData()
    } catch (error: any) {
      alert(error.message || "Failed to save expense")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description,
      expenseDate: expense.expenseDate,
      receiptNumber: expense.receiptNumber || "",
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm("Delete this expense?")) {
      try {
        await deleteItem("expenses", id)
        loadData()
      } catch (error) {
        alert("Failed to delete expense")
      }
    }
  }

  const totalByCategory = (cat: string) =>
    expenses.filter(e => e.category === cat).reduce((sum, e) => sum + Number(e.amount), 0)

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === "all" || e.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
    )
  }

  return (
    <>
    <div className="grid gap-4 md:grid-cols-4 mb-6">
          {EXPENSE_CATEGORIES.map((cat) => {
            const total = totalByCategory(cat)
            return total > 0 ? (
              <Card key={cat}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{cat.replace("_", " ")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">{currency} {total.toLocaleString()}</div>
                </CardContent>
              </Card>
            ) : null
          })}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Expenses</CardTitle>
                <CardDescription>Record and manage institution expenses</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open)
                if (!open) { setEditingExpense(null); setFormData({ category: "MISCELLANEOUS", amount: "", description: "", expenseDate: new Date().toISOString().split("T")[0], receiptNumber: "" }) }
              }}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Add Expense</Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>{editingExpense ? "Edit Expense" : "Record Expense"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Category</Label>
                        <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat.replace("_", " ")}</SelectItem>
                            ))}
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
                        <Input type="date" value={formData.expenseDate} onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })} required />
                      </div>
                      <div className="grid gap-2">
                        <Label>Receipt Number (Optional)</Label>
                        <Input value={formData.receiptNumber} onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingExpense ? "Update" : "Record Expense"}
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
                <Input placeholder="Search expenses..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="w-[200px]">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No expenses recorded</TableCell></TableRow>
                ) : (
                  filteredExpenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.expenseDate}</TableCell>
                      <TableCell><Badge variant="outline">{e.category.replace("_", " ")}</Badge></TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell className="font-medium">{currency} {Number(e.amount).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{e.receiptNumber || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
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
  </>
  )
}
