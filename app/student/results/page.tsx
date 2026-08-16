"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getItems, getCurrentUser } from "@/lib/api"
import type { Payment, Fee, InstitutionSettings } from "@/lib/types"
import { Loader2, Printer } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export default function StudentPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currency, setCurrency] = useState("KES")

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const sessionUser = await getCurrentUser()
      if (sessionUser && sessionUser.role === "STUDENT") {
        const [allPayments, allFees, settings] = await Promise.all([
          getItems<Payment>("payments"),
          getItems<Fee>("fees"),
          getItems<InstitutionSettings>("institutionSettings"),
        ])
        setPayments(allPayments.filter(p => p.studentId === sessionUser.id))
        setFees(allFees.filter(f => f.studentId === sessionUser.id))
        if (settings.length > 0) setCurrency(settings[0].currency)
      }
    } catch (error) {
      console.error("Failed to load payments", error)
    } finally {
      setIsLoading(false)
    }
  }

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const totalBalance = fees.reduce((s, f) => s + Number(f.balance || 0), 0)

  return (
    <>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{currency} {totalPaid.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{currency} {totalBalance.toLocaleString()}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Payment Records</CardTitle>
                <CardDescription>All your fee payments</CardDescription>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No payments yet</p>
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
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.receiptNumber}</TableCell>
                          <TableCell>{currency} {Number(p.amount).toLocaleString()}</TableCell>
                          <TableCell><Badge variant="outline">{p.paymentMethod.replace("_", " ")}</Badge></TableCell>
                          <TableCell>{p.paymentDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
  </>
  )
}
